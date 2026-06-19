import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function findNgrok(): string {
  const isWin = process.platform === 'win32';

  // Check PATH first
  try {
    execSync(isWin ? 'where ngrok' : 'which ngrok', { stdio: 'ignore' });
    return 'ngrok';
  } catch { }

  const username = process.env.USERNAME || process.env.USER || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const homeDir = path.join('C:', 'Users', username);
  const candidates = isWin
    ? [
        path.join(homeDir, 'ngrok.exe'),                // C:\Users\<user>\ngrok.exe
        path.join(localAppData, 'ngrok', 'ngrok.exe'),
        path.join('C:', 'ProgramData', 'scoop', 'shims', 'ngrok.exe'),
        path.join(homeDir, 'scoop', 'shims', 'ngrok.exe'),
        path.join(homeDir, 'AppData', 'Local', 'ngrok', 'ngrok.exe'),
        path.join(process.cwd(), 'node_modules', '.bin', 'ngrok.cmd'),
      ]
    : ['/usr/local/bin/ngrok', '/opt/homebrew/bin/ngrok'];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Try via npx
  try {
    execSync('npx --yes ngrok --version', { stdio: 'ignore', timeout: 15000 });
    return 'npx ngrok';
  } catch { }

  return '';
}

export async function startTunnel(port: number): Promise<string> {
  const ngrokPath = findNgrok();
  if (!ngrokPath) {
    throw new Error(
      'ngrok not found. Install it:\n' +
      '  winget install ngrok\n' +
      '  or download from https://ngrok.com/download\n\n' +
      'Then authenticate: ngrok config add-authtoken YOUR_TOKEN'
    );
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ngrokPath, ['http', String(port), '--log=stdout'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('ngrok timed out. Output:\n' + output.slice(-500)));
    }, 15000);

    const onData = (data: Buffer) => {
      output += data.toString();
      const m = output.match(/url=https?:\/\/[^\s]+/);
      if (m) {
        clearTimeout(timeout);
        resolve(m[0].replace('url=', ''));
      }
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
    proc.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`ngrok exited with code ${code}\n${output.slice(-300)}`));
      }
    });
  });
}
