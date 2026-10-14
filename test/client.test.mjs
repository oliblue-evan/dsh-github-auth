import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';

function fixture(overrides = {}) {
  const dom = new JSDOM('<html><head></head><body><main></main></body></html>', { url: 'http://localhost' });
  const prior = {};
  for (const key of ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']) {
    prior[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom.window : key === 'document' ? dom.window.document : true });
  }
  let factory, Component;
  const requests = [], effects = [], signals = [], extraRoots = [];
  const state = { ok: true, nonce: 'fresh', ghFound: true, ghVersion: 'gh version test', ghPath: '~/.local/bin/gh', environmentAuth: false,
    operationBusy: false, login: null, accounts: [{ host: 'github.com', login: 'one', active: true, state: 'success', tokenSource: 'keyring', gitProtocol: 'ssh', scopes: ['repo', 'gist'] }] };
  Object.assign(state, overrides);
  let expiredNonce = false; let blocked = false; let failure = null;
  const fetcher = async (_url, options = {}) => {
    signals.push(options.signal);
    if (blocked) await new Promise((_, reject) => options.signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); }, { once: true }));
    const body = options.body ? JSON.parse(options.body) : null; requests.push(body);
    let result = state; let status = 200;
    if (failure && body?.action === failure.action) { status = 400; result = { ok: false, error: failure.message }; failure = null; }
    else if (expiredNonce && body) { expiredNonce = false; status = 403; result = { ok: false, error: 'refresh required' }; }
    else if (body?.action === 'login') { state.login = { id: 'job', status: 'waiting', code: 'ABCD-1234', message: '等待确认' }; state.operationBusy = true; result = { ok: true, login: state.login }; }
    else if (body?.action === 'cancel') { state.login = { ...state.login, code: null, status: 'cancelled', message: '已取消' }; state.operationBusy = false; result = { ok: true }; }
    else if (body?.action === 'install') { state.installation = { id: 'install-job', status: 'running', phase: '下载官方安装包', percent: 25 }; state.operationBusy = true; result = { ok: true, installation: state.installation }; }
    else if (body?.action === 'cancel-install') { state.installation = { ...state.installation, status: 'cancelled', message: '已取消工具准备' }; state.operationBusy = false; result = { ok: true }; }
    else if (body?.action === 'logout') { state.accounts = []; result = { ok: true, message: '已退出本机' }; }
    else if (body?.action === 'repo') result = { ok: true, repository: { name: body.repository, permission: 'ADMIN', private: false, canWrite: true } };
    else if (body?.action === 'ssh') result = { ok: true, success: true, login: 'other', message: 'SSH 身份 other' };
    return { ok: status === 200, status, json: async () => JSON.parse(JSON.stringify(result)) };
  };
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: Object.assign(dom.window, { __ModuleLoader__: { load: (entry) => { factory = entry.factory; } } }), document: dom.window.document,
    navigator: dom.window.navigator, AbortController, fetch: fetcher,
  });
  factory(() => React).apply({ effect: (callback) => { const dispose = callback(); if (typeof dispose === 'function') effects.push(dispose); },
    slots: { inject: (_name, cb) => cb(), register: (_args, component) => { Component = component; return () => {}; } } });
  const root = createRoot(dom.window.document.querySelector('main'));
  const button = (label) => [...dom.window.document.querySelectorAll('button')].find((node) => node.textContent === label);
  return {
    dom, state, requests, button, signals,
    disposeEffects() { effects.splice(0).forEach((dispose) => dispose()); },
    expire() { expiredNonce = true; }, block() { blocked = true; }, fail(action, message) { failure = { action, message }; },
    async render() { await act(async () => root.render(React.createElement(Component))); },
    async mountExtra() {
      const container = dom.window.document.createElement('aside'); dom.window.document.body.appendChild(container);
      const extra = createRoot(container); extraRoots.push(extra);
      await act(async () => extra.render(React.createElement(Component)));
    },
    async click(label) { const node = button(label); assert.ok(node, label); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); },
    async close() { await act(async () => { root.unmount(); extraRoots.forEach((extra) => extra.unmount()); }); effects.forEach((dispose) => dispose()); dom.window.close();
      for (const key of Object.keys(prior)) if (prior[key]) Object.defineProperty(globalThis, key, prior[key]); else delete globalThis[key]; },
  };
}

test('热更新先拆旧实例时，仍显示的授权页面保留作用域样式', async () => {
  const f = fixture();
  try {
    await f.render();
    const style = f.dom.window.document.querySelector('style[data-dsh-style="github-auth"]');
    assert.ok(style.textContent.includes('.ga-root .ga-account'));
    f.disposeEffects();
    assert.ok(f.dom.window.document.querySelector('.ga-root'), '旧槽位还在过渡期');
    assert.equal(style.isConnected, true, '旧插件 dispose 不得移除仍在使用的样式');
    await f.click('登录 / 添加账号');
    assert.equal(f.dom.window.getComputedStyle(f.dom.window.document.querySelector('.ga-confirm')).display, 'flex');
    assert.ok(!f.requests.some((body) => body?.action === 'login'));
  } finally { await f.close(); }
});

test('设置页独立挂载时恢复缺失样式，多个授权入口不重复注入', async () => {
  const f = fixture();
  try {
    f.dom.window.document.querySelector('style[data-dsh-style="github-auth"]').remove();
    await f.render();
    const style = f.dom.window.document.querySelector('style[data-dsh-style="github-auth"]');
    style.textContent = '.ga-root{display:block}';
    await f.mountExtra();
    assert.equal(f.dom.window.document.querySelectorAll('.ga-root').length, 2, '插件详情与全局设置两张卡可同时存在');
    assert.equal(f.dom.window.document.querySelector('style[data-dsh-style="github-auth"]'), style, '多个入口复用同一份样式');
    assert.ok(style.textContent.includes('.ga-root .ga-account'), '新挂载入口刷新旧版本样式');
    assert.equal(f.dom.window.document.querySelectorAll('style[data-dsh-style="github-auth"]').length, 1);
    const root = f.dom.window.document.querySelector('.ga-root');
    assert.equal(f.dom.window.getComputedStyle(root).display, 'flex');
    assert.equal(f.dom.window.getComputedStyle(root.querySelector('.ga-account')).borderRadius, '10px');
    await f.render();
    assert.equal(f.dom.window.document.querySelectorAll('style[data-dsh-style="github-auth"]').length, 1);
  } finally { await f.close(); }
});

test('插件页显示真实授权字段，点击退出先确认，取消无修改请求', async () => {
  const f = fixture();
  try {
    await f.render();
    assert.match(f.dom.window.document.body.textContent, /系统钥匙串/);
    assert.match(f.dom.window.document.body.textContent, /授权有效/);
    await f.click('退出本机');
    assert.ok(!f.requests.some((body) => body?.action === 'logout'));
    assert.match(f.dom.window.document.body.textContent, /清除该账号的本机/);
    await f.click('取消');
    await f.click('退出本机'); await f.click('确认退出本机');
    assert.deepEqual(f.requests.find((body) => body?.action === 'logout'), { action: 'logout', login: 'one', confirmed: true });
    assert.match(f.dom.window.document.body.textContent, /尚未登录/);
  } finally { await f.close(); }
});
test('登录确认后显示一次性码，取消等待更新状态并恢复入口', async () => {
  const f = fixture();
  try {
    await f.render(); await f.click('登录 / 添加账号');
    assert.ok(!f.requests.some((body) => body?.action === 'login'));
    await f.click('开始网页授权');
    assert.match(f.dom.window.document.body.textContent, /ABCD-1234/);
    assert.equal(f.button('登录 / 添加账号').disabled, true);
    await f.click('取消等待');
    assert.equal(f.requests.find((body) => body?.action === 'cancel').id, 'job');
    assert.equal(f.button('登录 / 添加账号').disabled, false);
    assert.ok(!f.dom.window.document.body.textContent.includes('ABCD-1234'));
  } finally { await f.close(); }
});
test('刷新 nonce 失效时重新读状态，SSH 身份与 API 账号不同有明确提示', async () => {
  const f = fixture();
  try {
    await f.render(); f.expire(); await f.click('刷新状态');
    assert.ok(f.requests.filter((body) => body === null).length >= 2);
    await f.click('检查 SSH 连接');
    assert.match(f.dom.window.document.body.textContent, /SSH 身份与当前 gh 账号不同/);
    assert.equal(f.dom.window.document.querySelector('a[href="https://github.com/settings/applications"]').target, '_blank');
  } finally { await f.close(); }

});


test('退出页面时取消尚未结束的状态请求，避免停用后更新界面', async () => {
  const f = fixture();
  await f.render();
  f.block(); await f.click('刷新状态');
  const pending = f.signals.at(-1);
  assert.equal(pending.aborted, false);
  await f.close();
  assert.equal(pending.aborted, true);
});


test('确认区获得键盘焦点，Escape 只取消确认并返回触发按钮', async () => {
  const f = fixture();
  try {
    await f.render();
    const trigger = f.button('退出本机');
    await f.click('退出本机');
    const confirmation = f.dom.window.document.querySelector('[aria-label="确认授权操作"]');
    assert.equal(f.dom.window.document.activeElement, confirmation);
    await act(async () => confirmation.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(f.dom.window.document.querySelector('[aria-label="确认授权操作"]'), null);
    assert.equal(f.dom.window.document.activeElement, trigger);
    assert.ok(!f.requests.some((body) => body?.action === 'logout'));
  } finally { await f.close(); }
});

test('失败反馈在连接检查区中，重试不会留下旧成功结果，快速连点不重复请求', async () => {
  const f = fixture();
  try {
    await f.render(); await f.click('检查 SSH 连接');
    assert.match(f.dom.window.document.body.textContent, /SSH 身份与当前 gh 账号不同/);
    f.fail('ssh', '网络暂不可用');
    const trigger = f.button('检查 SSH 连接');
    await act(async () => {
      trigger.dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true }));
      trigger.dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true }));
    });
    assert.equal(f.requests.filter((body) => body?.action === 'ssh').length, 2);
    const check = f.dom.window.document.querySelector('[aria-label="连接检查"]');
    assert.match(check.querySelector('[role="alert"]').textContent, /网络暂不可用/);
    assert.ok(!check.textContent.includes('SSH 身份与当前 gh 账号不同'));
    await f.click('检查 SSH 连接');
    assert.equal(check.querySelector('[role="alert"]'), null);
  } finally { await f.close(); }
});

test('仓库结果用可读权限展示，输入变更后清除过时结果', async () => {
  const f = fixture();
  try {
    await f.render();
    const input = f.dom.window.document.querySelector('[aria-label="GitHub 仓库"]');
    const setter = Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { setter.call(input, 'one/repo'); Simulate.change(input); });
    await act(async () => input.form.dispatchEvent(new f.dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.match(f.dom.window.document.body.textContent, /管理员/);
    assert.match(f.dom.window.document.body.textContent, /可写入/);
    await act(async () => { setter.call(input, 'one/other'); Simulate.change(input); });
    assert.ok(!f.dom.window.document.body.textContent.includes('管理员'));
  } finally { await f.close(); }
});

test('首次使用一键准备显示进度，可取消并重试，不触发账号授权', async () => {
 const f=fixture({ghFound:false,accounts:[],setup:{supported:true,platform:'macOS',arch:'ARM64'}});
 try {
  await f.render();
  assert.match(f.dom.window.document.body.textContent,/准备工具.*登录账号.*开始使用/);
  assert.equal(f.button('登录 / 添加账号'),undefined);
  await f.click('一键准备工具');
  assert.deepEqual(f.requests.find((body)=>body?.action==='install'),{action:'install',confirmed:true});
  assert.equal(f.dom.window.document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),'25');
  await f.click('取消准备');
  assert.equal(f.requests.find((body)=>body?.action==='cancel-install').id,'install-job');
  assert.match(f.dom.window.document.body.textContent,/已取消工具准备/);
  assert.ok(f.button('一键准备工具'));
  assert.ok(!f.requests.some((body)=>body?.action==='login'));
 } finally {await f.close();}
});
test('手动安装重新检测后直接进入连接步骤；失败有手动入口', async () => {
 const f=fixture({ghFound:false,accounts:[],setup:{supported:true,platform:'macOS',arch:'ARM64'},installation:{status:'failed',message:'网络暂不可用'}});
 try {
  await f.render();assert.ok(f.button('重新准备工具'));
  assert.match(f.dom.window.document.querySelector('[role="alert"]').textContent,/网络暂不可用/);
  assert.ok(f.dom.window.document.querySelector('a[href="https://cli.github.com/"]'));
  f.state.ghFound=true;f.state.installation={status:'completed'};
  await f.click('我已安装，重新检测');
  assert.ok(f.button('连接 GitHub 账号'));
  assert.ok(!f.button('一键准备工具'));
  await f.click('连接 GitHub 账号');
  assert.ok(f.button('开始网页授权'));
  assert.ok(!f.requests.some((body)=>body?.action==='install'||body?.action==='login'));
 } finally {await f.close();}
});
test('不支持的系统给出手动引导，已有账号不显示准备卡', async () => {
 const f=fixture({ghFound:false,accounts:[],setup:{supported:false,platform:'other',arch:'other'}});
 try {await f.render();assert.equal(f.button('一键准备工具'),undefined);assert.ok(f.dom.window.document.querySelector('a').textContent.includes('官方安装'));} finally {await f.close();}
 const existing=fixture();try{await existing.render();assert.equal(existing.dom.window.document.querySelector('.ga-setup'),null);}finally{await existing.close();}
});
