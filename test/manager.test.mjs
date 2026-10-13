import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createManager } from '../lib/manager.js';

function fixture(source = 'keyring') {
  let current = 'one'; let users = ['one', 'two'];
  let process; const calls = [];
  const manager = createManager({ findGh: async () => '/fake/gh', run: async (binary, args) => {
    calls.push({ binary, args });
    if (args[0] === '--version') return { code: 0, stdout: 'gh version 2.101.0' };
    if (args[1] === 'status') return { code: 0, stdout: JSON.stringify({ hosts: { 'github.com': users.map((login) => ({ login, active: login === current, state: 'success', tokenSource: source, gitProtocol: 'ssh', scopes: 'repo', token: 'gho_secret' })) } }) };
    if (args[1] === 'switch') current = args.at(-1);
    if (args[1] === 'logout') users = users.filter((user) => user !== args.at(-1));
    if (binary === 'ssh') return { code: 1, stdout: '', stderr: "Hi one! You've successfully authenticated, but GitHub does not provide shell access." };
    if (args[0] === 'repo') return { code: 0, stdout: JSON.stringify({ nameWithOwner: 'one/repo', viewerPermission: 'ADMIN', isPrivate: false, url: 'https://github.com/one/repo' }) };
    return { code: 0, stdout: '' };
  }, startLogin: () => {
    process = new EventEmitter(); process.stdout = new PassThrough(); process.stderr = new PassThrough(); process.stdin = new PassThrough();
    process.kill = (signal) => { process.killed = signal; process.emit('close', null); return true; };
    return process;
  } });
  return { manager, calls, process: () => process };
}
test('查看既有授权不改变配置，缓存状态不带令牌', async () => {
  const f = fixture();
  const first = await f.manager.state(); await f.manager.state();
  assert.equal(first.accounts[0].login, 'one');
  assert.equal(f.calls.filter((call) => call.args[1] === 'status').length, 1);
  assert.ok(!JSON.stringify(first).includes('gho_secret'));
  f.manager.dispose();
});
test('切换和本机退出限定具体已有账号，文件存储账号也可操作', async () => {
  const f = fixture('oauth_token');
  await assert.rejects(f.manager.switchAccount('two', false));
  await f.manager.switchAccount('two', true);
  assert.equal((await f.manager.state()).accounts.find((account) => account.active).login, 'two');
  await assert.rejects(f.manager.logout('other', true));
  await f.manager.logout('one', true);
  assert.equal((await f.manager.state()).accounts.length, 1);
  assert.ok(f.calls.some((call) => call.args.join(' ') === 'auth logout --hostname github.com --user one'));
  f.manager.dispose();
});
test('登录流跨输出块获取一次性码；正在等待时阻止其他账号变更，取消清理子进程', async () => {
  const f = fixture();
  await f.manager.login(true);
  f.process().stderr.write('First copy your one-time co');
  f.process().stderr.write('de: ABCD-1234\n');
  const state = await f.manager.state();
  assert.equal(state.login.code, 'ABCD-1234');
  assert.equal(state.login.status, 'waiting');
  await assert.rejects(f.manager.logout('one', true), /正在进行/);
  f.manager.cancel(state.login.id);
  assert.equal(f.process().killed, 'SIGTERM');
  assert.equal((await f.manager.state()).login.status, 'cancelled');
  assert.equal((await f.manager.state()).operationBusy, false);
  f.manager.dispose();
});
test('登录成功与失败均释放操作锁；停用插件会停止等待', async () => {
  const f = fixture();
  await f.manager.login(true); f.process().emit('close', 0);
  assert.equal((await f.manager.state()).login.status, 'completed');
  await f.manager.login(true); f.process().stderr.write('failed gho_sensitive'); f.process().emit('close', 1);
  assert.ok(!(await f.manager.state()).login.message.includes('gho_sensitive'));
  await f.manager.login(true); f.manager.dispose();
  assert.equal(f.process().killed, 'SIGTERM');
  await assert.rejects(f.manager.login(true), /停用/);
});
test('SSH 成功的退出码 1 正确识别，仓库检查只读且验证目标', async () => {
  const f = fixture();
  assert.equal((await f.manager.checkSSH()).success, true);
  assert.ok(f.calls.find((call) => call.binary === 'ssh').args.includes('StrictHostKeyChecking=yes'));
  assert.equal((await f.manager.checkRepo('one/repo')).repository.canWrite, true);
  await assert.rejects(f.manager.checkRepo('one/repo;id'));
  f.manager.dispose();
});
test('环境变量来源授权不允许本机账号操作', async () => {
  const f = fixture('GH_TOKEN');
  await assert.rejects(f.manager.logout('one', true), /环境变量/);
  f.manager.dispose();
});
