import * as net from 'net'
import { FTPSession } from './ftp-session'
import { SSHFileSystem, SSHConfiguration } from 'fs-tunnel'

export class SSHToFTPBridge {
	private server: net.Server

	public FTPSession!: FTPSession
	public SSHFileSystem!: SSHFileSystem

	constructor(configuration: SSHConfiguration, { port = 21 }: { port?: number } = { port: 21 }) {
		this.server = net.createServer()

		this.server.on('connection', (socket: net.Socket) => {
			this.SSHFileSystem = new SSHFileSystem(configuration)
			this.FTPSession = new FTPSession(socket, this.SSHFileSystem, {
				authenticationNeeded: !(configuration.username && configuration.password)
			})
		})

		this.server.listen(port, '0.0.0.0', () => {
			console.log(`🟢 FTP server listening!\nftp://localhost:${port}`)
		})
	}

	async terminate() {
		this.SSHFileSystem.disconnect()
		this.server.close()
	}
}