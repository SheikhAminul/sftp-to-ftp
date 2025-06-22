# SFTP-to-FTP Bridge

[![NPM Version](https://img.shields.io/npm/v/sftp-to-ftp.svg?branch=main)](https://www.npmjs.com/package/sftp-to-ftp)
[![Publish Size](https://badgen.net/packagephobia/publish/sftp-to-ftp)](https://packagephobia.now.sh/result?p=sftp-to-ftp)
[![Downloads](https://img.shields.io/npm/dt/sftp-to-ftp)](https://www.npmjs.com/package/sftp-to-ftp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/SheikhAminul/sftp-to-ftp/blob/main/LICENSE)
================

### SSH/SFTP to FTP bridge for seamless file transfers
Create an FTP server that acts as a bridge to any SSH/SFTP server, allowing legacy FTP clients to interact with modern SSH servers. Instantly convert any SSH/SFTP server into an FTP-accessible resource. Perfect for:
- Accessing SFTP directories **directly in Windows File Explorer**.
- Using legacy FTP clients with modern SSH servers.
- Exploring and managing remote files with any FTP-compatible tool.

## Table of Contents

* [Installation](#installation)
* [Usage](#usage)
* [API Reference](#api-reference)
* [Supported Commands](#supported-commands)
* [Contributing](#contributing)
* [License](#license)
* [Author](#author)

## Installation

```bash
npm install sftp-to-ftp
# or globally
npm install -g sftp-to-ftp
```

## Usage

### Command Line Interface (3 Ways to Run)

1. **Interactive Mode** (Prompt for details):
   ```bash
   npx sftp-to-ftp
   ```
   Example output:
   ```
   Enter SSH host: myserver.com
   Enter SSH port (Default: 22): 
   Enter SSH username (Leave empty if not needed): admin
   Enter SSH password (Leave empty if not needed): ********
   Enter FTP port (Default: 21): 2121
   🟢 FTP server listening! ftp://localhost:2121
   ```

> **Windows File Explorer Tip**: Simply enter `ftp://localhost:21` (or your custom port) in the address bar to browse your SFTP server like a local folder!

2. **Direct Arguments** (Fully automated):
   ```bash
   npx sftp-to-ftp --ssh-host 192.168.0.105 --ssh-port 22 --ssh-user root --ssh-pass PWD --ftp-port 21
   ```

3. **Anonymous Mode** (No SSH credentials required if pre-authenticated):
   ```bash
   npx sftp-to-ftp --ssh-host 192.168.0.105 --ssh-port 22 --ftp-port 21
   ```

### Programmatic Usage

```javascript
import { SSHToFTPBridge } from 'sftp-to-ftp';

// Create bridge to SSH server
const bridge = new SSHToFTPBridge(
  {
    host: 'your-ssh-server.com',
    port: 22,
    username: 'your-user',
    password: 'your-pass'
  },
  { port: 2121 } // Optional FTP port
);

// The FTP server is now running on port 2121
// Connect with any FTP client to localhost:2121

// To shutdown:
await bridge.terminate();
```

## API Reference

### Class: SSHToFTPBridge

#### Constructor

```typescript
new SSHToFTPBridge(sshConfig: SSHConfiguration, options?: { port?: number })
```

- `sshConfig` (Object):
  - `host` (string) - SSH server hostname/IP
  - `port` (number) - SSH port (default: 22)
  - `username` (string) - SSH username
  - `password` (string) - SSH password
- `options` (Object, optional):
  - `port` (number) - FTP server port (default: 21)

#### Methods

- `terminate(): Promise<void>` - Shuts down the FTP server and disconnects from SSH

### Class: FTPSession

(Advanced usage - for custom FTP server implementations)

#### Properties
- `authenticated` (boolean) - Session authentication status
- `cwd` (string) - Current working directory
- `transferType` (string) - Current transfer type (A/I)

#### Methods
- `send(code: number, message: string): void` - Send FTP response
- `resolvePath(relativePath: string): string` - Resolve relative paths

## Supported Commands

| Command | Description                      | Status |
|---------|----------------------------------|--------|
| USER    | Authentication username          | ✅     |
| PASS    | Authentication password          | ✅     |
| LIST    | Directory listing                | ✅     |
| RETR    | Download file                    | ✅     |
| STOR    | Upload file                      | ✅     |
| DELE    | Delete file                      | ✅     |
| MKD     | Create directory                 | ✅     |
| RMD     | Remove directory                 | ✅     |
| RNFR    | Rename from                      | ✅     |
| RNTO    | Rename to                        | ✅     |
| CWD     | Change working directory         | ✅     |
| PWD     | Print working directory          | ✅     |
| PASV    | Passive mode transfer            | ✅     |
| PORT    | Active mode transfer             | ✅     |
| TYPE    | Transfer type (A/I)              | ✅     |
| SIZE    | Get file size                    | ✅     |
| MDTM    | Get file modification time       | ✅     |
| QUIT    | Disconnect                       | ✅     |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on the [GitHub repository](https://github.com/SheikhAminul/ssh-sftp-fs).

## License

sftp-to-ftp is licensed under the [MIT license](https://github.com/SheikhAminul/sftp-to-ftp/blob/main/LICENSE).


## Author

|[![@SheikhAminul](https://avatars.githubusercontent.com/u/25372039?v=4&s=96)](https://github.com/SheikhAminul)|
|:---:|
|[@SheikhAminul](https://github.com/SheikhAminul)|