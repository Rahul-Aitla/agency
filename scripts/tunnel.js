const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';

function findNgrok() {
  try {
    execSync(isWin ? 'where ngrok' : 'which ngrok', { stdio: 'ignore' });
    return 'ngrok';
  } catch {}

  // Try npx
  try {
    execSync('npx --yes ngrok --version', { stdio: 'ignore', timeout: 15000 });
    return 'npx ngrok';
  } catch {}

  return '';
}

const bin = findNgrok();
if (!bin) {
  console.error(`
╔══════════════════════════════════════════════════════════╗
║  ngrok not found                                        ║
║                                                         ║
║  Install:  winget install ngrok                         ║
║  Or:       https://ngrok.com/download                   ║
║                                                         ║
║  Then authenticate:  ngrok config add-authtoken <token>  ║
╚══════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

const port = process.argv[2] || '3000';
const proc = spawn(bin, ['http', port, '--log=stdout'], { shell: true, stdio: 'inherit' });

console.log(`\nStarting ngrok tunnel to http://localhost:${port}...\n`);
proc.on('exit', (code) => process.exit(code));
