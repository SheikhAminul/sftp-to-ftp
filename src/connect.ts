#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
const parseArgs = () => Object.fromEntries(Array.from(process.argv.slice(2).join(' ').matchAll(/--([^\s]+)(?:\s+(\S+))?/g),
	([_, key, val]) => [key, val ?? true]
))
import { SSHToFTPBridge } from '.'

/*
	You can open CLI/terminal and run the following command and enter the necessary information to create the SSH to FTP bridge:
	npx sftp-to-ftp

	You can also pass the necessary arguments directly in the command line. For example:
	npx sftp-to-ftp --ssh-host 192.168.0.105 --ssh-port 22 --ssh-user root --ssh-pass PWD --ftp-host 127.0.0.1 --ftp-port 21

	If authentication is not needed, you can leave the SSH username and password empty:
	npx sftp-to-ftp --ssh-host 192.168.0.105 --ssh-port 22 --ftp-host 127.0.0.1 --ftp-port 21
*/

(async () => {
	const args = parseArgs()

	const cli = createInterface({ input, output })

	try {
		if (!args['ssh-host']) {
			args['ssh-host'] = await cli.question('Enter SSH host/IP: ')
			if (!args['ssh-host']) throw 'The SSH host is necessary to connect!'

			if (!args['ssh-port']) args['ssh-port'] = await cli.question('Enter SSH port (Default: 22): ')

			if (!args['ssh-user']) args['ssh-user'] = await cli.question('Enter SSH username (Leave empty if not needed): ')

			if (!args['ssh-pass']) args['ssh-pass'] = await cli.question('Enter SSH password (Leave empty if not needed): ')

			if (!args['ftp-host']) args['ftp-host'] = await cli.question('Enter FTP host/IP (Default: 127.0.0.1): ')

			if (!args['ftp-port']) args['ftp-port'] = await cli.question('Enter FTP port (Default: 21): ')
		}

		const connection = new SSHToFTPBridge({
			host: args['ssh-host'],
			port: args['ssh-port'] ? parseInt(args['ssh-port']) : 22,
			username: args['ssh-user'] || void 0,
			password: args['ssh-pass'] || void 0
		}, {
			host: args['ftp-host'] || '127.0.0.1',
			port: args['ftp-port'] ? parseInt(args['ftp-port']) : 21
		})

		process.on('SIGINT', () => {
			console.log('\nShutting down gracefully...')
			connection.terminate()
			cli.close()
			process.exit(0)
		})
	} catch (error) {
		console.error(`🔴 Failed to create SSH to FTP connection...\n${error}`)
	} finally {
		cli.close()
	}
})()