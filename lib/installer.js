import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, copyFile, chmod, lstat, link, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';

const HOSTS = new Set(['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com']);
export function installTarget(platform = process.platform, arch = process.arch) {
  const system = { darwin: 'macOS', linux: 'linux', win32: 'windows' }[platform];
  const cpu = { x64: 'amd64', arm64: 'arm64' }[arch];
  return system && cpu ? { system, cpu, suffix: system + '_' + cpu + (platform === 'linux' ? '.tar.gz' : '.zip'), executable: platform === 'win32' ? 'gh.exe' : 'gh' } : null;
}
export function setupInfo() {
  const target = installTarget();
  return { supported: !!target, platform: { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }[process.platform] || process.platform,
    arch: { x64: 'x64', arm64: 'ARM64' }[process.arch] || process.arch };
}

/** Only official GitHub release hosts, including their asset redirects. */
export async function download(url, { signal, limit, progress, fetcher = fetch, accept = 'application/octet-stream' }) {
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    signal?.throwIfAborted();
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname) || parsed.username || parsed.password || parsed.port) throw new Error('下载地址不是 GitHub 官方来源');
    try { response = await fetcher(url, { signal, redirect: 'manual', headers: { 'user-agent': 'dsh-github-auth', accept } }); }
    catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      throw new Error('无法连接 GitHub 官方下载，请检查网络或使用手动安装');
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      if (!response.headers.get('location')) throw new Error('下载重定向无效');
      url = new URL(response.headers.get('location'), url).href;
      response = null; continue;
    }
    break;
  }
  if (!response?.ok) throw new Error(response?.status === 403 || response?.status === 429 ? 'GitHub 下载暂时受限，请稍后重试或手动安装' : '无法从 GitHub 下载，请检查网络后重试');
  const length = Number(response.headers.get('content-length')) || 0;
  if (length > limit) { await response.body?.cancel(); throw new Error('安装包超过大小限制'); }
  const chunks = []; let bytes = 0, last = -1;
  for await (const chunk of response.body) {
    signal?.throwIfAborted();
    bytes += chunk.byteLength;
    if (bytes > limit) { await response.body?.cancel().catch(() => {}); throw new Error('安装包超过大小限制'); }
    chunks.push(chunk);
    const percent = length ? Math.min(100, Math.floor(bytes / length * 100)) : null;
    if (percent !== last) { progress?.(percent); last = percent; }
  }
  return Buffer.concat(chunks);
}

function execute(binary, args, signal) {
  return new Promise((resolve, reject) => execFile(binary, args, { signal, timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true },
    (error, stdout) => error ? reject(signal?.aborted ? new DOMException('已取消', 'AbortError') : new Error('解压或验证工具失败，请重试或手动安装 GitHub CLI')) : resolve(String(stdout))));
}

/** Portable official binary; no package manager, sudo, shell script or PATH edits. */
export async function installGh({ signal, onProgress = () => {}, platform = process.platform, arch = process.arch,
  directory = join(homedir(), '.local', 'bin'), fetcher = fetch, executeFile = execute } = {}) {
  const target = installTarget(platform, arch);
  if (!target) throw new Error('此系统暂不支持一键准备，请使用官方安装说明');
  let temporary, staged;
  const cancelled = () => { if (signal?.aborted) throw new DOMException('已取消', 'AbortError'); };
  try {
    onProgress({ phase: '获取官方版本', percent: null });
    const release = JSON.parse((await download('https://api.github.com/repos/cli/cli/releases/latest', { signal, limit: 2 * 1024 * 1024, fetcher, accept: 'application/vnd.github+json' })).toString());
    if (!/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error('官方版本信息无效');
    const version = release.tag_name.slice(1), name = 'gh_' + version + '_' + target.suffix;
    const asset = release.assets?.find((item) => item.name === name);
    const checksums = release.assets?.find((item) => item.name === 'gh_' + version + '_checksums.txt');
    const assetUrl = (item) => {
      const expected = 'https://github.com/cli/cli/releases/download/' + release.tag_name + '/' + item?.name;
      if (!item || item.browser_download_url !== expected) throw new Error('官方安装包信息不完整');
      return expected;
    };
    onProgress({ phase: '下载官方安装包', percent: 0 });
    const archive = await download(assetUrl(asset), { signal, limit: 64 * 1024 * 1024, fetcher,
      progress: (percent) => onProgress({ phase: '下载官方安装包', percent }) });
    onProgress({ phase: '校验安装包', percent: null });
    const manifest = (await download(assetUrl(checksums), { signal, limit: 1024 * 1024, fetcher })).toString();
    const expected = manifest.split(/\r?\n/).map((line) => line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i)).find((entry) => entry?.[2] === name)?.[1].toLowerCase();
    const digest = createHash('sha256').update(archive).digest('hex');
    if (!expected || digest !== expected || (asset.digest && asset.digest !== 'sha256:' + digest)) throw new Error('安装包校验失败，未安装；请稍后重试');
    cancelled();
    temporary = await mkdtemp(join(tmpdir(), 'dsh-github-cli-'));
    const archivePath = join(temporary, name), extracted = join(temporary, 'extracted');
    await writeFile(archivePath, archive, { mode: 0o600 }); await mkdir(extracted);
    // Windows portable ZIP has bin/gh.exe directly; Unix archives have a version folder.
    const folder = platform === 'win32' ? '' : name.replace(/\.(?:tar\.gz|zip)$/, '');
    const entry = (folder ? folder + '/' : '') + 'bin/' + target.executable;
    onProgress({ phase: '解压并验证工具', percent: null });
    // Extract only the one selected binary, never unrelated archive paths.
    const tar = platform === 'win32' ? 'tar.exe' : platform === 'darwin' ? '/usr/bin/tar' : 'tar';
    await executeFile(tar, ['-xf', archivePath, '-C', extracted, entry], signal);
    const binary = join(extracted, folder, 'bin', target.executable);
    const file = await lstat(binary);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error('安装包中的工具文件无效');
    await chmod(binary, 0o755);
    const output = await executeFile(binary, ['--version'], signal);
    if (!output.startsWith('gh version ' + version + ' ')) throw new Error('工具版本验证失败');
    cancelled();
    onProgress({ phase: '保存到当前用户目录', percent: null });
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const destination = join(directory, target.executable);
    // Another tool/user may have installed gh while the download was in flight.
    try { await lstat(destination); throw new Error('检测到现有 gh 文件，请重新检测以避免覆盖'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    staged = join(directory, '.dsh-gh-' + randomUUID());
    await copyFile(binary, staged, constants.COPYFILE_EXCL); await chmod(staged, 0o755);
    cancelled();
    // Publish a complete file atomically; link fails if the final name exists.
    await link(staged, destination);
    return { binary: destination, version: 'gh version ' + version, message: '工具已准备好，可以连接 GitHub 账号' };
  } finally {
    if (staged) await rm(staged, { force: true }).catch(() => {});
    if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}
