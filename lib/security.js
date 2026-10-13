import { timingSafeEqual } from 'node:crypto';

export function redact(value) {
  return String(value || '').replace(/(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9]{6,})/g, '[redacted]')
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\/Users\/[^/\s]+/g, '~');
}
export function sameOrigin(req) {
  const host = String(req.headers.host || '');
  let local;
  try { local = new URL('http://' + host); } catch { return false; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) return false;
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false;
  const origin = req.headers.origin;
  if (!origin || origin === 'null' || origin === 'dsh-app://app') return true;
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.host === local.host;
  } catch { return false; }
}
export function verifyNonce(actual, expected) {
  if (typeof actual !== 'string' || actual.length !== expected.length) return false;
  const left = Buffer.from(actual); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function validateAccount(login) {
  if (typeof login !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login)) throw new Error('账号名称无效');
  return login;
}
export function validateRepo(value) {
  const text = String(value || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const parts = text.split('/');
  if (parts.length !== 2) throw new Error('请输入 owner/repository 或 GitHub 仓库地址');
  validateAccount(parts[0]);
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(parts[1]) || ['.', '..'].includes(parts[1])) throw new Error('仓库名称无效');
  return parts.join('/');
}
export async function readJson(req) {
  let bytes = 0; let text = '';
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 8192) throw new Error('请求内容过长');
    text += chunk;
  }
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求格式无效');
  return value;
}
// gh may return token fields even when token output is masked. Whitelist at the boundary.
export function accountReport(raw) {
  const accounts = [];
  for (const [host, list] of Object.entries(raw?.hosts || {})) {
    if (host !== 'github.com' || !Array.isArray(list)) continue;
    for (const item of list) {
      accounts.push({ host, login: String(item.login || ''), active: item.active === true,
        state: String(item.state || 'unknown'), gitProtocol: item.gitProtocol === 'ssh' ? 'ssh' : 'https',
        tokenSource: String(item.tokenSource || 'unknown'),
        scopes: String(item.scopes || '').split(/[,\s]+/).filter(Boolean),
        error: item.error ? redact(typeof item.error === 'object' ? item.error.message || '授权验证失败' : item.error).slice(0, 400) : null });
    }
  }
  return accounts;
}
