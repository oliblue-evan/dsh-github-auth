import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { redact } from './security.js';

export async function findGh() {
  const names = process.platform === 'win32' ? ['gh.exe'] : ['gh'];
  const dirs = [...String(process.env.PATH || '').split(delimiter), join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  for (const dir of dirs.filter(Boolean)) for (const name of names) {
    const path = join(dir, name);
    try { await access(path, constants.X_OK); return path; } catch { /* next */ }
  }
  return null;
}
export function commandEnvironment() {
  const env = { ...process.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1', TERM: 'dumb' };
  delete env.GH_FORCE_TTY;
  return env;
}
export function run(binary, args, timeout = 15000) {
  return new Promise((resolve) => execFile(binary, args, { env: commandEnvironment(), timeout, maxBuffer: 512 * 1024, windowsHide: true },
    (error, stdout, stderr) => resolve({ code: error ? error.code || 1 : 0, stdout: String(stdout || ''), stderr: redact(stderr || error?.message || '') })));
}
export function startLogin(binary) {
  // No protocol override, no SSH upload, no new scopes, no shell interpolation.
  return spawn(binary, ['auth', 'login', '--hostname', 'github.com', '--web', '--skip-ssh-key'],
    { env: commandEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}
