import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { sameOrigin, verifyNonce, validateRepo, validateAccount, redact, accountReport } from '../lib/security.js';
import { createHandler } from '../index.js';

test('同源守卫拒绝外部、端口不同、畸形来源与 cross-site；支持本机 DSH 页面', () => {
  const req = (headers) => ({ headers: { host: 'localhost:19387', ...headers } });
  assert.equal(sameOrigin(req({ origin: 'http://localhost:19387' })), true);
  assert.equal(sameOrigin(req({ origin: 'dsh-app://app' })), true);
  for (const headers of [{ host: 'evil.com' }, { origin: 'https://evil.com' }, { origin: 'http://localhost:999' }, { origin: 'bad' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal(sameOrigin(req(headers)), false);
});
test('令牌、私有路径脱敏；非 ASCII nonce 不会让守卫抛错', () => {
  assert.equal(verifyNonce('é'.repeat(64), 'a'.repeat(64)), false);
  assert.equal(verifyNonce('a'.repeat(64), 'a'.repeat(64)), true);
  assert.equal(verifyNonce(undefined, 'a'.repeat(64)), false);
  assert.ok(!redact('gho_abcdef123456 /Users/private/file').includes('gho_'));
  assert.equal(redact('github_pat_abcdef123456'), '[redacted]');
});
test('账号与仓库参数防止注入，GitHub 地址可转为 owner/name', () => {
  assert.equal(validateRepo('https://github.com/example/repo.git'), 'example/repo');
  for (const value of ['--help', 'a;id', '', 'a'.repeat(40)]) assert.throws(() => validateAccount(value));
  for (const value of ['x/y/z', 'https://evil.com/x/y', 'x/../../key', 'x/y;id', 'x/..']) assert.throws(() => validateRepo(value));
});
test('状态只返回白名单字段，排除 gh 的 token 和非 GitHub 主机', () => {
  const report = accountReport({ hosts: { 'github.com': [{ login: 'user', token: 'gho_secret', active: true, scopes: 'repo, gist', tokenSource: 'keyring', state: 'success' }], 'evil.com': [{ login: 'evil' }] } });
  assert.equal(report.length, 1);
  assert.ok(!JSON.stringify(report).includes('gho_secret'));
  assert.deepEqual(report[0].scopes, ['repo', 'gist']);
});
async function call(handler, body, headers = {}, method = body === undefined ? 'GET' : 'POST') {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method; req.headers = { host: 'localhost:19387', 'content-type': 'application/json', ...headers };
  let status, output;
  await handler(req, { writeHead: (code) => { status = code; }, end: (value) => { output = JSON.parse(value); } });
  return { status, output };
}
test('状态 GET 无副作用；账号修改必须匹配 nonce、JSON、显式确认', async () => {
  let changed = 0;
  const manager = { state: async () => ({ accounts: [] }), login: async (confirmed) => { if (!confirmed) throw Error('confirm'); changed++; return {}; } };
  const handler = createHandler(manager, 'nonce');
  assert.equal((await call(handler)).output.nonce, 'nonce');
  assert.equal((await call(handler, { action: 'login' })).status, 403);
  assert.equal((await call(handler, { action: 'login' }, { 'x-dsh-github-nonce': 'nonce', 'content-type': 'text/plain' })).status, 415);
  assert.equal((await call(handler, { action: 'login' }, { 'x-dsh-github-nonce': 'nonce' })).status, 400);
  assert.equal((await call(handler, { action: 'login', confirmed: true }, { 'x-dsh-github-nonce': 'nonce' })).status, 200);
  assert.equal(changed, 1);
  assert.equal((await call(handler, { action: 'arbitrary-command' }, { 'x-dsh-github-nonce': 'nonce' })).status, 400);
});
test('跨站与超大请求不执行命令', async () => {
  const handler = createHandler({}, 'nonce');
  assert.equal((await call(handler, {}, { origin: 'https://evil.com' })).status, 403);
  assert.equal((await call(handler, { blob: 'x'.repeat(9000) }, { 'x-dsh-github-nonce': 'nonce' })).status, 400);
});
