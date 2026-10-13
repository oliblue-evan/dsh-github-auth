import { randomBytes } from 'node:crypto';
import { createManager } from './lib/manager.js';
import { sameOrigin, verifyNonce, readJson, redact } from './lib/security.js';

export const name = 'github-auth';
export const inject = ['webServer'];

export function createHandler(manager, nonce) {
  return async (req, res) => {
    const send = (code, data) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    if (!sameOrigin(req)) return send(403, { ok: false, error: '请求来源不受信任' });
    if (req.method === 'GET') {
      try { return send(200, { ok: true, nonce, ...(await manager.state()) }); }
      catch (error) { return send(500, { ok: false, error: redact(error.message) }); }
    }
    if (req.method !== 'POST') return send(405, { ok: false, error: '仅支持 GET / POST' });
    if (!verifyNonce(req.headers['x-dsh-github-nonce'], nonce)) return send(403, { ok: false, error: '页面已更新，请刷新后重试' });
    if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) return send(415, { ok: false, error: '请求必须为 JSON' });
    try {
      const body = await readJson(req);
      let result;
      switch (body.action) {
        case 'refresh': result = await manager.state(true); break;
        case 'login': result = await manager.login(body.confirmed); break;
        case 'cancel': result = manager.cancel(body.id); break;
        case 'switch': result = await manager.switchAccount(body.login, body.confirmed); break;
        case 'logout': result = await manager.logout(body.login, body.confirmed); break;
        case 'ssh': result = await manager.checkSSH(); break;
        case 'repo': result = await manager.checkRepo(body.repository); break;
        default: throw new Error('不支持此操作');
      }
      return send(200, { ok: true, nonce, ...result });
    } catch (error) { return send(400, { ok: false, error: redact(error.message).slice(0, 500) }); }
  };
}
export function apply(ctx) {
  const manager = createManager();
  const nonce = randomBytes(32).toString('hex');
  ctx.effect(() => () => manager.dispose(), 'github-auth: processes');
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/github-auth', handler: createHandler(manager, nonce) }), 'github-auth: local API');
}
