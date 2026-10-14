import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { installGh, installTarget, download } from '../lib/installer.js';

const version = '2.99.0', tag = 'v' + version;
function fixture(system = 'macOS', cpu = 'arm64') {
 const assetName = 'gh_' + version + '_' + system + '_' + cpu + (system === 'linux' ? '.tar.gz' : '.zip');
 const archive = Buffer.from('test archive bytes');
 const digest = createHash('sha256').update(archive).digest('hex');
 const asset = (name) => ({name, browser_download_url: 'https://github.com/cli/cli/releases/download/' + tag + '/' + name});
 const release = { tag_name: tag, assets: [asset(assetName), asset('gh_' + version + '_checksums.txt')] };
 let checksum = digest, executed = 0, requests = 0, binaryVersion = version;
 return {
  release,
  checksum(value) {checksum = value;}, version(value) {binaryVersion = value;}, executed: () => executed, requests: () => requests,
  async fetcher(url, options) {
   requests++; options.signal?.throwIfAborted();
   if (url.includes('api.github.com')) {
    assert.equal(options.headers.accept, 'application/vnd.github+json');
    return new Response(JSON.stringify(release));
   }
   return new Response(url.endsWith('checksums.txt') ? checksum + '  ' + assetName + '\n' : archive);
  },
  async executeFile(_binary, args, signal) {
   executed++; signal?.throwIfAborted();
   if (args[0] === '-xf') {
    assert.equal(args[4], system === 'windows' ? 'bin/gh.exe' : 'gh_' + version + '_' + system + '_' + cpu + '/bin/gh');
    const binary = join(args[3], args[4]); await mkdir(dirname(binary), {recursive:true}); await writeFile(binary, 'test executable');
    return '';
   }
   assert.deepEqual(args, ['--version']); return 'gh version ' + binaryVersion + ' (test)\n';
  },
 };
}
async function sandbox(callback) {
 const root = await mkdtemp(join(tmpdir(), 'ga-test-'));
 try { await callback(root); } finally { await rm(root, {recursive:true,force:true}); }
}

test('选择官方资产对应系统与架构，不支持的系统进入手动引导', () => {
 for (const platform of ['darwin','linux','win32']) for (const arch of ['arm64','x64']) assert.ok(installTarget(platform,arch));
 assert.equal(installTarget('darwin','x64').suffix, 'macOS_amd64.zip');
 assert.equal(installTarget('linux','arm64').suffix, 'linux_arm64.tar.gz');
 assert.equal(installTarget('win32','x64').executable, 'gh.exe');
 assert.equal(installTarget('linux','mips'), null);
});
test('官方包校验后只解压指定工具，以完整文件发布，不留下暂存文件', async () => sandbox(async (directory) => {
 const f = fixture(); const progress = [];
 const result = await installGh({...f, directory, platform:'darwin',arch:'arm64',onProgress:(value)=>progress.push(value)});
 assert.equal(await readFile(result.binary,'utf8'), 'test executable');
 assert.equal(result.version, 'gh version ' + version);
 assert.equal(f.executed(), 2);
 assert.deepEqual(await readdir(directory), ['gh']);
 assert.equal((await stat(result.binary)).mode & 0o777, 0o755);
 assert.ok(progress.some((item)=>item.phase==='校验安装包'));
}));
test('Windows 官方便携 ZIP 的 bin/gh.exe 无版本目录，安装后可直接发现', async () => sandbox(async (directory) => {
 const f = fixture('windows', 'amd64');
 const result = await installGh({...f, directory, platform:'win32',arch:'x64'});
 assert.equal(result.binary,join(directory,'gh.exe'));
 assert.equal(await readFile(result.binary,'utf8'),'test executable');
 assert.equal(f.executed(),2);
}));
test('校验失败或官方资产被换成外部 URL 时不执行、不写入工具', async () => sandbox(async (directory) => {
 const f=fixture(); f.checksum('0'.repeat(64));
 await assert.rejects(installGh({...f,directory,platform:'darwin',arch:'arm64'}), /校验失败/);
 assert.equal(f.executed(),0); assert.deepEqual(await readdir(directory), []);
 f.release.assets[0].browser_download_url='https://evil.example/gh.zip';
 await assert.rejects(installGh({...f,directory,platform:'darwin',arch:'arm64'}), /安装包信息/);
 assert.equal(f.executed(),0);
}));
test('已有工具不被覆盖；版本不符不发布，暂存内容清理', async () => sandbox(async (directory) => {
 const f=fixture(); await writeFile(join(directory,'gh'),'existing');
 await assert.rejects(installGh({...f,directory,platform:'darwin',arch:'arm64'}), /现有 gh/);
 assert.equal(await readFile(join(directory,'gh'),'utf8'),'existing');
 await rm(join(directory,'gh')); f.version('1.0.0');
 await assert.rejects(installGh({...f,directory,platform:'darwin',arch:'arm64'}), /版本验证/);
 assert.deepEqual(await readdir(directory), []);
}));
test('取消下载后不解压或写入用户目录', async () => sandbox(async (directory) => {
 const f=fixture(), controller=new AbortController();
 await assert.rejects(installGh({...f,directory,platform:'darwin',arch:'arm64',signal:controller.signal,
  onProgress:({phase})=>{if(phase==='下载官方安装包')controller.abort();}}), {name:'AbortError'});
 assert.equal(f.executed(),0); assert.deepEqual(await readdir(directory), []);
}));
test('限制重定向来源、下载大小与请求次数；无法访问时提供可读错误', async () => {
 let calls=0;
 await assert.rejects(download('https://github.com/cli/cli/releases/download/v2/a', {limit:10,fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.example/download'}});}}), /官方来源/);
 assert.equal(calls,1);
 await assert.rejects(download('https://github.com/test',{limit:3,fetcher:async()=>new Response('12345')}), /大小限制/);
 await assert.rejects(download('https://github.com/test',{limit:3,fetcher:async()=>new Response('',{status:403})}), /暂时受限/);
});
