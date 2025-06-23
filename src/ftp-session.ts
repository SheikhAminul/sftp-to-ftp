import * as net from 'net'
import * as path from 'path'
import { SSHFileSystem } from 'fs-tunnel'

export interface FTPSessionOptions {
	authenticationNeeded: boolean
}

export class FTPSession {
	private socket: net.Socket
	private sshFS: SSHFileSystem
	private cwd: string
	private dataSocket: net.Socket | null
	private dataServer: net.Server | null
	private renameFrom: string | null
	private pasvMode: boolean
	private transferType: string
	private options: { loggedIn: boolean, username: string } = { loggedIn: false, username: '' }

	constructor(
		socket: net.Socket,
		sshFS: SSHFileSystem,
		options: FTPSessionOptions
	) {
		this.options.loggedIn = options?.authenticationNeeded ? false : true

		this.socket = socket
		this.sshFS = sshFS
		this.cwd = '/'
		this.dataSocket = null
		this.dataServer = null
		this.renameFrom = null
		this.pasvMode = false
		this.transferType = 'A'

		this.setupHandlers()
		this.send(220, 'FTP-SSH Bridge Ready')
	}

	private setupHandlers(): void {
		this.socket.on('data', this.handleData.bind(this))
		this.socket.on('close', this.cleanup.bind(this))
		this.socket.on('error', this.cleanup.bind(this))
	}

	private handleData(data: Buffer): void {
		const lines = data.toString().trim().split('\r\n')
		lines.forEach(line => {
			if (line.trim()) {
				const [cmd, ...args] = line.trim().split(' ')
				this.handleCommand(cmd.toUpperCase(), args.join(' '))
			}
		})
	}

	private async handleCommand(cmd: string, args: string): Promise<void> {
		console.log(`FTP Command: ${cmd} ${cmd === 'PASS' ? '*****' : args}`)

		if (!this.options.loggedIn && !['USER', 'PASS', 'QUIT'].includes(cmd)) {
			this.send(530, 'Please login with USER and PASS')
			return
		}

		try {
			switch (cmd) {
				case 'USER':
					if (this.options.loggedIn) {
						this.send(230, 'Already logged in')
						return
					}
					this.options.username = args
					this.send(331, 'Password required')
					break
				case 'PASS':
					if (this.options.loggedIn) {
						this.send(230, 'Already logged in')
						return
					}
					if (!this.options.username) {
						this.send(503, 'Login with USER first')
						return
					}
					try {
						await this.sshFS.connectWithCredentials(this.options.username, args)
						this.options.loggedIn = true
						this.send(230, 'Login successful')
					} catch {
						this.options.username = ''
						this.send(530, 'Login authentication failed')
					}
					break
				case 'SYST':
					this.send(215, 'UNIX Type: L8')
					break
				case 'FEAT':
					this.send(211, 'Features:\r\n SIZE\r\n MDTM\r\n MLST\r\n MLSD\r\n211 End')
					break
				case 'PWD':
					this.send(257, `"${this.cwd}"`)
					break
				case 'TYPE':
					this.transferType = args.toUpperCase()
					this.send(200, `Type set to ${this.transferType}`)
					break
				case 'MODE':
					this.send(200, 'Mode set')
					break
				case 'STRU':
					this.send(200, 'Structure set')
					break
				case 'CWD':
					await this.handleCWD(args)
					break
				case 'CDUP':
					await this.handleCWD('..')
					break
				case 'PASV':
					await this.handlePASV()
					break
				case 'PORT':
					this.handlePORT(args)
					break
				case 'LIST':
					await this.handleLIST(args)
					break
				case 'NLST':
					await this.handleNLST(args)
					break
				case 'MLSD':
					await this.handleMLSD(args)
					break
				case 'MLST':
					await this.handleMLST(args)
					break
				case 'RETR':
					await this.handleRETR(args)
					break
				case 'STOR':
					await this.handleSTOR(args)
					break
				case 'APPE':
					await this.handleAPPE(args)
					break
				case 'DELE':
					await this.handleDELE(args)
					break
				case 'MKD':
				case 'XMKD':
					await this.handleMKD(args)
					break
				case 'RMD':
				case 'XRMD':
					await this.handleRMD(args)
					break
				case 'RNFR':
					this.handleRNFR(args)
					break
				case 'RNTO':
					await this.handleRNTO(args)
					break
				case 'SIZE':
					await this.handleSIZE(args)
					break
				case 'MDTM':
					await this.handleMDTM(args)
					break
				case 'QUIT':
					this.send(221, 'Goodbye')
					this.socket.end()
					this.sshFS.disconnect()
					break
				case 'NOOP':
					this.send(200, 'OK')
					break
				default:
					this.send(502, 'Command not implemented')
			}
		} catch (err) {
			console.error(`Error in ${cmd}:`, err)
			this.send(550, (err as Error).message || 'Command failed')
		}
	}

	private async handleCWD(dir: string): Promise<void> {
		const newPath = this.resolvePath(dir)
		const stats = await this.sshFS.stat(newPath)

		if (stats.isDirectory) {
			this.cwd = newPath
			this.send(250, `Directory changed to ${newPath}`)
		} else {
			this.send(550, 'Not a directory')
		}
	}

	private async handlePASV(): Promise<void> {
		const server = net.createServer()
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

		const address = server.address() as net.AddressInfo
		const port = address.port
		const ip = '127,0,0,1'
		const p1 = Math.floor(port / 256)
		const p2 = port % 256

		this.dataServer = server
		this.pasvMode = true

		server.on('connection', (socket: net.Socket) => {
			this.dataSocket = socket
			socket.on('error', () => { })
		})

		this.send(227, `Entering Passive Mode (${ip},${p1},${p2})`)
	}

	private handlePORT(args: string): void {
		const parts = args.split(',').map(Number)
		const ip = parts.slice(0, 4).join('.')
		const port = parts[4] * 256 + parts[5]

		this.dataSocket = new net.Socket()
		this.dataSocket.connect(port, ip, () => {
			this.send(200, 'PORT command successful')
		})
		this.pasvMode = false
	}

	private async handleLIST(args: string): Promise<void> {
		const dir = this.resolvePath(args || '.')
		const files = await this.sshFS.readdir(dir)

		await this.waitForDataConnection()
		this.send(150, 'Opening data connection')

		const listing = files.map(file => {
			const perms = file.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--'
			const links = '1'
			const owner = 'user'
			const group = 'group'
			const size = file.size.toString().padStart(12)
			const date = file.mtime.toLocaleDateString('en-US', {
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			}).replace(',', '')
			return `${perms} ${links} ${owner} ${group} ${size} ${date} ${file.name}`
		}).join('\r\n')

		this.dataSocket!.write(listing + '\r\n')
		this.closeDataConnection()
		this.send(226, 'Transfer complete')
	}

	private async handleNLST(args: string): Promise<void> {
		const dir = this.resolvePath(args || '.')
		const files = await this.sshFS.readdir(dir)

		await this.waitForDataConnection()
		this.send(150, 'Opening data connection')

		const listing = files.map(file => file.name).join('\r\n')
		this.dataSocket!.write(listing + '\r\n')
		this.closeDataConnection()
		this.send(226, 'Transfer complete')
	}

	private async handleMLSD(args: string): Promise<void> {
		const dir = this.resolvePath(args || '.')
		const files = await this.sshFS.readdir(dir)

		await this.waitForDataConnection()
		this.send(150, 'Opening data connection')

		const listing = files.map(file => {
			const type = file.isDirectory ? 'type=dir' : 'type=file'
			const size = `size=${file.size}`
			const modify = `modify=${file.mtime.toISOString().replace(/[-:]/g, '').split('.')[0]}`
			return `${type};${size};${modify} ${file.name}`
		}).join('\r\n')

		this.dataSocket!.write(listing + '\r\n')
		this.closeDataConnection()
		this.send(226, 'Transfer complete')
	}

	private async handleMLST(args: string): Promise<void> {
		const filepath = this.resolvePath(args || '.')
		const stats = await this.sshFS.stat(filepath)

		const type = stats.isDirectory ? 'type=dir' : 'type=file'
		const size = `size=${stats.size}`
		const modify = `modify=${stats.mtime.toISOString().replace(/[-:]/g, '').split('.')[0]}`

		this.send(250, `- begin\r\n ${type};${size};${modify} ${args || '.'}\r\n end`)
	}

	private async handleRETR(filename: string): Promise<void> {
		const filepath = this.resolvePath(filename)
		await this.waitForDataConnection()
		this.send(150, 'Opening data connection')

		const readStream = this.sshFS.createReadStream(filepath)
		readStream.pipe(this.dataSocket!)
		readStream.on('end', () => {
			this.closeDataConnection()
			this.send(226, 'Transfer complete')
		})
		readStream.on('error', () => {
			this.closeDataConnection()
			this.send(550, 'Transfer failed')
		})
	}

	private async handleSTOR(filename: string): Promise<void> {
		const filepath = this.resolvePath(filename)

		try {
			const stats = await this.sshFS.stat(filepath)
			if (stats.isDirectory) {
				await this.handleDirectoryTransfer(filepath)
				return
			}
		} catch (err) { }

		await this.waitForDataConnection()
		this.send(150, 'Opening data connection')

		const writeStream = this.sshFS.createWriteStream(filepath)
		this.dataSocket!.pipe(writeStream)
		writeStream.on('close', () => {
			this.closeDataConnection()
			this.send(226, 'Transfer complete')
		})
		writeStream.on('error', () => {
			this.closeDataConnection()
			this.send(550, 'Transfer failed')
		})
	}

	private async handleAPPE(filename: string): Promise<void> {
		const filepath = this.resolvePath(filename)
		await this.waitForDataConnection()
		this.send(150, 'Opening data connection')

		let startPos = 0
		try {
			const stats = await this.sshFS.stat(filepath)
			startPos = stats.size
		} catch (err) { }

		const writeStream = this.sshFS.createWriteStream(filepath, {
			flags: 'a',
			start: startPos
		})

		this.dataSocket!.pipe(writeStream)
		writeStream.on('close', () => {
			this.closeDataConnection()
			this.send(226, 'Transfer complete')
		})
		writeStream.on('error', () => {
			this.closeDataConnection()
			this.send(550, 'Transfer failed')
		})
	}

	private async handleDirectoryTransfer(dirPath: string): Promise<void> {
		const files = await this.sshFS.readdir(dirPath)

		for (const file of files) {
			const remotePath = path.posix.join(dirPath, file.name)

			if (file.isDirectory) {
				await this.handleMKD(remotePath)
				await this.handleDirectoryTransfer(remotePath)
			} else {
				await this.handleSTOR(remotePath)
			}
		}
	}

	private async handleDELE(filename: string): Promise<void> {
		const filepath = this.resolvePath(filename)
		await this.sshFS.unlink(filepath)
		this.send(250, 'File deleted')
	}

	private async handleMKD(dirname: string): Promise<void> {
		const dirpath = this.resolvePath(dirname)
		await this.sshFS.mkdir(dirpath)
		this.send(257, `"${dirpath}" created`)
	}

	private async handleRMD(dirname: string): Promise<void> {
		const dirpath = this.resolvePath(dirname)
		await this.sshFS.rmdir(dirpath)
		this.send(250, 'Directory removed')
	}

	private handleRNFR(filename: string): void {
		this.renameFrom = this.resolvePath(filename)
		this.send(350, 'Ready for destination name')
	}

	private async handleRNTO(filename: string): Promise<void> {
		const newPath = this.resolvePath(filename)
		await this.sshFS.rename(this.renameFrom!, newPath)
		this.renameFrom = null
		this.send(250, 'Rename successful')
	}

	private async handleSIZE(filename: string): Promise<void> {
		const filepath = this.resolvePath(filename)
		const stats = await this.sshFS.stat(filepath)
		this.send(213, stats.size.toString())
	}

	private async handleMDTM(filename: string): Promise<void> {
		const filepath = this.resolvePath(filename)
		const stats = await this.sshFS.stat(filepath)
		const timestamp = stats.mtime.toISOString().replace(/[-:]/g, '').slice(0, 14)
		this.send(213, timestamp)
	}

	private resolvePath(relativePath: string): string {
		if (!relativePath || relativePath === '.' || relativePath === '') return this.cwd
		if (relativePath === '..') {
			const parent = path.posix.dirname(this.cwd)
			return parent === this.cwd ? '/' : parent
		}
		if (relativePath.startsWith('/')) {
			const normalized = path.posix.normalize(relativePath)
			return normalized === '.' ? '/' : normalized
		}

		const resolved = path.posix.resolve(this.cwd, relativePath)
		return resolved === '.' ? '/' : resolved
	}

	private async waitForDataConnection(): Promise<void> {
		if (this.dataSocket && (this.dataSocket as any).readyState === 'open') return

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Data connection timeout')), 10000)

			if (this.pasvMode && this.dataServer) {
				this.dataServer.once('connection', (socket: net.Socket) => {
					clearTimeout(timeout)
					this.dataSocket = socket
					resolve()
				})
			} else if (this.dataSocket) {
				if ((this.dataSocket as any).readyState === 'open') {
					clearTimeout(timeout)
					resolve()
				} else {
					this.dataSocket.once('connect', () => {
						clearTimeout(timeout)
						resolve()
					})
				}
			} else {
				reject(new Error('No data connection'))
			}
		})
	}

	private closeDataConnection(): void {
		if (this.dataSocket) {
			this.dataSocket.end()
			this.dataSocket = null
		}
		if (this.dataServer) {
			this.dataServer.close()
			this.dataServer = null
		}
	}

	private send(code: number, message: string): void {
		const response = `${code} ${message}\r\n`
		console.log(`FTP Response: ${response.trim()}`)
		this.socket.write(response)
	}

	private cleanup(): void {
		this.closeDataConnection()
		console.log('FTP session ended')
	}
}