import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { accountReport, redact, validateAccount, validateRepo } from './security.js';
import { findGh, run, startLogin } from './process.js';
import { installGh, setupInfo } from './installer.js';

export function createManager(dependencies = {}) {
  const execute = dependencies.run || run;
  const locate = dependencies.findGh || findGh;
  const launch = dependencies.startLogin || startLogin;
  const prepare = dependencies.installGh || installGh;
  let binary = null, version = null, checked = false;
  let snapshot = null, snapshotAt = 0, reading = null;
  let job = null, child = null, busy = false, disposed = false;
  let expiry = null, killTimer = null;
  let installation = null, installController = null, installPromise = null;

  async function discover(fresh = false) {
    if (checked && !fresh) return;
    const previous = binary;
    binary = await locate();
    checked = true;
    if (!binary) version = null;
    if (binary && (binary !== previous || !version)) {
      const result = await execute(binary, ['--version']);
      version = redact(result.stdout.split('\n')[0]).slice(0, 120);
    }
  }
  async function accounts(fresh = false) {
    await discover(fresh);
    if (!binary) return { accounts: [], error: null };
    if (reading) return reading;
    if (!fresh && snapshot && Date.now() - snapshotAt < 5000) return snapshot;
    reading = (async () => {
      const result = await execute(binary, ['auth', 'status', '--hostname', 'github.com', '--json', 'hosts']);
      let data;
      try { data = JSON.parse(result.stdout); } catch { return { accounts: [], error: redact(result.stderr || '无法读取 GitHub 授权状态').slice(0, 400) }; }
      snapshot = { accounts: accountReport(data), error: null };
      snapshotAt = Date.now();
      return snapshot;
    })().finally(() => { reading = null; });
    return reading;
  }
  async function state(fresh = false) {
    const report = await accounts(fresh);
    return { ...report, ghFound: !!binary, ghVersion: version,
      ghPath: binary ? binary.replace(homedir(), '~') : null,
      environmentAuth: !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN),
      operationBusy: busy, login: job ? { ...job } : null,
      setup: setupInfo(), installation: installation ? { ...installation } : null };
  }
  async function install(confirmed) {
    if (disposed) throw new Error('插件已停用');
    if (confirmed !== true) throw new Error('请确认从 GitHub 官方下载并准备工具');
    if (busy) throw new Error('另一项操作正在进行，请完成或取消后再试');
    // Lock before discovery too, so simultaneous requests cannot start two installs.
    busy = true;
    try {
      await discover(true);
      if (disposed) throw new Error('插件已停用');
      if (binary) { busy = false; return { message: '已检测到 GitHub CLI，可直接登录' }; }
      const current = installation = { id: randomUUID(), status: 'running', phase: '准备下载', percent: null, message: '' };
      const controller = installController = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3 * 60 * 1000); timeout.unref?.();
      installPromise = Promise.resolve().then(() => prepare({ signal: controller.signal, onProgress: (progress) => {
        if (current.status === 'running' && !disposed) Object.assign(current, progress);
      } })).then((result) => {
        if (controller.signal.aborted || disposed) throw new DOMException('已取消', 'AbortError');
        binary = result.binary; version = result.version; checked = true; snapshot = null;
        current.status = 'completed'; current.phase = '准备完成'; current.percent = 100; current.message = result.message;
      }).catch((error) => {
        if (current.status !== 'cancelled') {
          current.status = 'failed'; current.message = error.name === 'AbortError' ? '准备工具超时，请重试或手动安装' : redact(error.message).slice(0, 400);
        }
      }).finally(() => { clearTimeout(timeout); busy = false; installController = null; installPromise = null; });
      return { installation: { ...current } };
    } catch (error) { busy = false; throw error; }
  }
  function cancelInstall(id) {
    if (!installation || installation.id !== id || !installController) throw new Error('没有可取消的工具准备');
    installation.status = 'cancelled'; installation.message = '已取消工具准备，可重新尝试';
    installController.abort();
    return { message: installation.message };
  }
  function assertAvailable() {
    if (disposed) throw new Error('插件已停用');
    if (!binary) throw new Error('未找到 GitHub CLI');
    if (busy) throw new Error('另一项操作正在进行，请完成或取消后再试');
    if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) throw new Error('当前授权受环境变量控制，请在启动 DSH 的环境中管理该授权');
  }
  async function managedAccount(login) {
    validateAccount(login);
    const report = await accounts(true);
    if (report.error) throw new Error(report.error);
    const account = report.accounts.find((item) => item.login === login);
    if (!account) throw new Error('账号已经变化，请刷新后再试');
    if (/^(?:GH_TOKEN|GITHUB_TOKEN)$|environment/i.test(account.tokenSource)) throw new Error('环境变量授权无法在此退出或切换');
    return account;
  }
  function stopProcess(target) {
    if (!target) return;
    target.kill('SIGTERM');
    killTimer = setTimeout(() => { if (child === target) target.kill('SIGKILL'); }, 2000);
    killTimer.unref?.();
  }
  async function login(confirmed) {
    await discover(); assertAvailable();
    if (confirmed !== true) throw new Error('请确认使用 GitHub CLI 登录授权');
    busy = true;
    job = { id: randomUUID(), status: 'starting', code: null, url: 'https://github.com/login/device',
      startedAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000, message: '正在获取 GitHub 授权码…' };
    const current = job;
    let output = '';
    let settled = false;
    const finish = (status, message) => {
      if (settled) return;
      settled = true;
      clearTimeout(expiry); clearTimeout(killTimer);
      child = null; busy = false; snapshot = null;
      current.status = current.status === 'cancelled' || current.status === 'expired' ? current.status : status;
      current.message = current.status === 'cancelled' ? '已取消等待授权' : current.status === 'expired' ? '授权等待已超时，请重新登录' : message;
      current.code = null;
    };
    try {
      const process = launch(binary);
      child = process;
      const capture = (chunk) => {
        output = (output + redact(chunk.toString())).slice(-8192);
        const code = output.match(/(?:one-time code|device code)[^A-Z0-9]*([A-Z0-9]{4}-[A-Z0-9]{4})/i);
        if (code && current.status === 'starting') {
          current.code = code[1].toUpperCase(); current.status = 'waiting';
          current.message = '在 GitHub 页面输入此一次性代码并确认授权';
        }
      };
      process.stdout.on('data', capture); process.stderr.on('data', capture);
      process.on('error', (error) => finish('failed', redact(error.message).slice(0, 400)));
      process.on('close', (code) => finish(code === 0 ? 'completed' : 'failed', code === 0 ? '授权完成，账号列表已更新' : redact(output.trim() || '授权未完成，请重新尝试').slice(-400)));
      // Non-TTY gh opens the browser directly; closing stdin prevents accidental prompts.
      process.stdin.on('error', () => {}); process.stdin.end();
      expiry = setTimeout(() => { current.status = 'expired'; stopProcess(process); }, 15 * 60 * 1000);
      expiry.unref?.();
    } catch (error) { finish('failed', redact(error.message).slice(0, 400)); }
    return { login: { ...current } };
  }
  function cancel(id) {
    if (!job || job.id !== id || !child) throw new Error('没有可取消的授权等待');
    job.status = 'cancelled'; job.message = '正在取消等待…'; job.code = null;
    stopProcess(child);
    return { message: '已请求取消授权等待' };
  }
  async function change(action, login, confirmed) {
    await discover(); assertAvailable();
    if (confirmed !== true) throw new Error('请确认账号操作');
    busy = true;
    try {
      await managedAccount(login);
      const result = await execute(binary, ['auth', action === 'logout' ? 'logout' : 'switch', '--hostname', 'github.com', '--user', login]);
      if (result.code !== 0) throw new Error(redact(result.stderr || '账号操作失败'));
      snapshot = null;
      return { message: action === 'logout' ? '已退出本机账号 ' + login : '当前账号已切换为 ' + login };
    } finally { busy = false; }
  }
  async function checkSSH() {
    const result = await execute('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=8', '-o', 'ConnectionAttempts=1', 'git@github.com'], 12000);
    const message = redact(result.stdout + '\n' + result.stderr);
    const account = message.match(/Hi ([A-Za-z0-9-]+)! You've successfully authenticated/);
    return account ? { success: true, login: account[1], message: 'SSH 连接有效，身份为 ' + account[1] }
      : { success: false, message: message.trim().slice(-500) || 'SSH 未连接：请检查密钥、主机信任与网络' };
  }
  async function checkRepo(repository) {
    await discover();
    if (!binary) throw new Error('未找到 GitHub CLI');
    const name = validateRepo(repository);
    const result = await execute(binary, ['repo', 'view', name, '--json', 'nameWithOwner,url,viewerPermission,isPrivate']);
    if (result.code !== 0) throw new Error(redact(result.stderr || '无法查看仓库，请检查登录或仓库名称').slice(0, 400));
    const data = JSON.parse(result.stdout);
    return { repository: { name: String(data.nameWithOwner), permission: String(data.viewerPermission),
      private: data.isPrivate === true, canWrite: ['WRITE', 'MAINTAIN', 'ADMIN'].includes(data.viewerPermission) } };
  }
  function dispose() {
    disposed = true; clearTimeout(expiry);
    if (installController) { installation.status = 'cancelled'; installController.abort(); }
    if (child) { if (job) job.status = 'cancelled'; stopProcess(child); }
  }
  return { state, login, cancel, install, cancelInstall, switchAccount: (user, confirmed) => change('switch', user, confirmed),
    logout: (user, confirmed) => change('logout', user, confirmed), checkSSH, checkRepo, dispose };
}
