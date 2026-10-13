window.__ModuleLoader__.load({
  id: 'dsh-github-auth',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useLayoutEffect, useRef } = React;
    const API = '/api/github-auth';
    const STYLE = `
.ga-root{--ga-accent:var(--dsw-alias-label-link,#819cfa);--ga-secondary:var(--dsw-alias-label-secondary,#bec1c8);--ga-muted:var(--dsw-alias-label-tertiary,#9298a1);--ga-line:var(--dsw-alias-border-l2,rgba(127,127,127,.22));max-width:820px;display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary,#eee);font:inherit;font-size:13px;line-height:1.5}
.ga-root *{box-sizing:border-box}.ga-root h2,.ga-root h3,.ga-root p{margin:0}.ga-root h2{font-size:17px;font-weight:600;letter-spacing:-.02em}.ga-root h3{font-size:13px;font-weight:600}.ga-root .ga-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.ga-root .ga-description{font-size:12px;color:var(--ga-muted);margin-top:3px}.ga-root .ga-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ga-root button,.ga-root .ga-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 10px;min-height:32px;border-radius:7px;background:transparent;border:1px solid var(--ga-line);font:inherit;font-size:12px;color:var(--ga-secondary);cursor:pointer;text-decoration:none;transition:background .12s ease,color .12s ease}.ga-root button:hover,.ga-root .ga-link:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#eee)}.ga-root button:disabled{opacity:.45;cursor:default}.ga-root button:focus-visible,.ga-root a:focus-visible,.ga-root input:focus-visible,.ga-root summary:focus-visible{outline:2px solid var(--ga-accent);outline-offset:2px}
.ga-root .ga-primary{background:color-mix(in srgb,var(--ga-accent) 14%,transparent);border-color:color-mix(in srgb,var(--ga-accent) 30%,transparent);color:var(--ga-accent)}.ga-root .ga-primary:hover{background:color-mix(in srgb,var(--ga-accent) 23%,transparent);color:var(--ga-accent)}.ga-root .ga-quiet{border-color:transparent}.ga-root .ga-danger{color:var(--dsw-alias-state-error-primary,#ef9292);border-color:transparent}.ga-root .ga-danger:hover{color:var(--dsw-alias-state-error-primary,#ef9292);background:var(--dsw-alias-interactive-bg-hover-danger,rgba(230,100,100,.1))}.ga-root .ga-icon{width:15px;height:15px;flex:none;pointer-events:none}.ga-root .ga-spinning{animation:ga-spin 1s linear infinite}@keyframes ga-spin{to{transform:rotate(360deg)}}
.ga-root .ga-card{border:1px solid var(--ga-line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-bg-layer-2,transparent)}.ga-root .ga-account{padding:14px 16px;gap:10px}.ga-root .ga-account-head{display:flex;align-items:center;gap:10px}.ga-root .ga-avatar{width:36px;height:36px;flex:none;border-radius:10px;background:color-mix(in srgb,var(--ga-accent) 10%,transparent);display:grid;place-items:center;color:var(--ga-accent);font-size:14px;font-weight:600}.ga-root .ga-identity{flex:1;min-width:0}.ga-root .ga-name{font-size:14px;font-weight:600;overflow-wrap:anywhere}.ga-root .ga-host{font-size:11px;color:var(--ga-muted)}.ga-root .ga-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ga-root .ga-badge{font-size:11px;border-radius:5px;padding:2px 6px;color:var(--ga-secondary);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));white-space:nowrap}.ga-root .ga-ok{color:var(--dsw-alias-state-success-primary,#82b994)}.ga-root .ga-current{color:var(--ga-accent);background:color-mix(in srgb,var(--ga-accent) 10%,transparent)}.ga-root .ga-dot{display:inline-block;width:5px;height:5px;border-radius:50%;corner-shape:round;background:currentColor;margin-right:5px;vertical-align:2px}
.ga-root .ga-account-info{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;color:var(--ga-muted);font-size:12px;padding-left:46px}.ga-root .ga-info-item{display:inline-flex;align-items:center;gap:5px}.ga-root .ga-info-item .ga-icon{width:13px;height:13px}.ga-root .ga-scopes{display:flex;gap:5px;flex-wrap:wrap;margin-left:auto}.ga-root .ga-scopes span{font-size:11px;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08));color:var(--ga-secondary)}.ga-root .ga-account-actions{display:flex;align-items:center;gap:6px;border-top:1px solid var(--ga-line);padding-top:8px;margin-top:2px}.ga-root .ga-account-actions .ga-danger{margin-left:auto}
.ga-root .ga-muted{color:var(--ga-muted);font-size:12px}.ga-root .ga-notice{font-size:12px;padding:9px 11px;border-radius:7px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.09));overflow-wrap:anywhere}.ga-root .ga-error{color:var(--dsw-alias-state-error-primary,#ef9292)}.ga-root .ga-confirm{border-color:color-mix(in srgb,var(--ga-accent) 35%,var(--ga-line));background:color-mix(in srgb,var(--ga-accent) 4%,var(--dsw-alias-bg-layer-2,#26272c))}.ga-root .ga-confirm:focus{outline:none}.ga-root .ga-confirm[data-danger=true]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef9292) 35%,var(--ga-line))}.ga-root .ga-confirm .ga-tools{justify-content:flex-end}.ga-root .ga-code-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.ga-root .ga-code{font-size:26px;letter-spacing:.1em;font-variant-numeric:tabular-nums;font-family:var(--dsw-font-mono,monospace);color:var(--ga-accent);padding:6px 0}.ga-root .ga-step{font-size:12px;color:var(--ga-secondary)}
.ga-root .ga-check-row{display:flex;align-items:center;gap:12px;justify-content:space-between}.ga-root .ga-check-copy{display:flex;align-items:flex-start;gap:9px}.ga-root .ga-check-copy>.ga-icon{margin-top:2px;color:var(--ga-muted)}.ga-root .ga-check-state{font-size:11px;color:var(--ga-muted);margin-top:2px}.ga-root .ga-separator{border-top:1px solid var(--ga-line);margin:0}.ga-root .ga-input{min-width:0;flex:1;width:100%;padding:8px 10px;border:1px solid var(--ga-line);border-radius:7px;background:var(--dsw-alias-bg-layer-1,transparent);font:inherit;font-size:12px;color:inherit}.ga-root .ga-input::placeholder{color:var(--ga-muted)}.ga-root .ga-result-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px}.ga-root .ga-result-note{font-size:11px;color:var(--ga-muted);margin-top:4px}
.ga-root .ga-advanced{border-top:1px solid var(--ga-line);padding-top:10px}.ga-root .ga-advanced>summary{display:flex;align-items:center;gap:6px;cursor:pointer;list-style:none;color:var(--ga-muted);font-size:12px;padding:3px 0}.ga-root summary::-webkit-details-marker{display:none}.ga-root .ga-chevron{transition:transform .12s ease}.ga-root .ga-advanced[open]>summary .ga-chevron{transform:rotate(90deg)}.ga-root .ga-advanced-body{display:flex;flex-direction:column;gap:10px;padding:12px 0 2px}.ga-root .ga-diagnostics{font-size:11px;color:var(--ga-muted);overflow-wrap:anywhere}.ga-root .ga-empty{text-align:center;padding:24px 14px;gap:8px}.ga-root .ga-empty>.ga-icon{width:28px;height:28px;margin:0 auto 4px;color:var(--ga-muted)}
@media(max-width:520px){.ga-root .ga-head{align-items:flex-start}.ga-root .ga-account-info{padding-left:0}.ga-root .ga-scopes{margin-left:0;flex-basis:100%}.ga-root .ga-badges{max-width:100%;justify-content:flex-start}.ga-root .ga-account-head{flex-wrap:wrap}.ga-root .ga-tools .ga-input{flex-basis:100%}.ga-root .ga-check-row{align-items:flex-start}}
@media(prefers-reduced-motion:reduce){.ga-root .ga-spinning{animation:none}.ga-root button,.ga-root .ga-chevron{transition:none}}
`;
    // 插件页与全局设置会独立挂载。按键复用作用域样式，不随旧插件实例
    // dispose 删除，避免宿主热更新期间出现「页面还在、样式没了」。
    // 页面重新挂载时也刷新样式，恢复缺失样式并使用当前版本的 CSS。
    function installStyles() {
      let style = document.querySelector('style[data-dsh-style="github-auth"]');
      if (!style) {
        style = document.createElement('style');
        style.setAttribute('data-dsh-style', 'github-auth');
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = STYLE;
    }

    function icon(name, extra = '') {
      const paths = {
        plus: 'M12 5v14M5 12h14', refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M18 18a8 8 0 0 1-13-2',
        key: 'M14 9a5 5 0 1 0-4 5l-6 6H2v-2l6-6M16 7h.01',
        terminal: 'm5 7 5 5-5 5M13 17h6', chevron: 'm9 5 7 7-7 7',
        copy: 'M9 9h11v11H9zM5 15H3V3h12v2', external: 'M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7',
        shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6',
      };
      return h('svg', { className: 'ga-icon ' + extra, width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[name] || paths.shield }));
    }
    const storageLabel = (source) => source === 'keyring' ? '系统钥匙串' : /^(?:GH_TOKEN|GITHUB_TOKEN)$|environment/i.test(source) ? '环境变量（外部管理）' : source === 'oauth_token' ? 'gh 配置文件' : source;
    const scopeInfo = { repo: ['仓库', '读取与管理仓库'], 'read:org': ['组织只读', '读取组织与团队信息'], gist: ['Gist', '管理 Gist'] };
    const permissionLabel = { ADMIN: '管理员', MAINTAIN: '维护者', WRITE: '可写入', TRIAGE: '可分拣', READ: '只读' };
    const link = (label, url) => h('a', { className: 'ga-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external'));
    const button = (label, action, props = {}) => {
      const { icon: name, spinning, ...attributes } = props;
      return h('button', { type: 'button', onClick: action, ...attributes }, name ? icon(name, spinning ? 'ga-spinning' : '') : null, h('span', null, label));
    };

    function GitHubSection() {
      useLayoutEffect(installStyles, []);
      const [state, setState] = useState(null);
      const [loading, setLoading] = useState(true);
      const [actionBusy, setActionBusy] = useState(false);
      const [busyAction, setBusyAction] = useState('');
      const [checkErrors, setCheckErrors] = useState({});
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      const [confirm, setConfirm] = useState(null);
      const [repository, setRepository] = useState('');
      const [repoResult, setRepoResult] = useState(null);
      const [ssh, setSSH] = useState(null);
      const alive = useRef(false);
      const rootRef = useRef(null);
      const confirmRef = useRef(null);
      const returnFocus = useRef(null);
      const operationLock = useRef(false);
      const stateRef = useRef(null);
      const controllers = useRef(new Set());
      const loadSequence = useRef(0);

      async function request(body) {
        const controller = new AbortController();
        controllers.current.add(controller);
        const timer = window.setTimeout(() => controller.abort(), 25000);
        try {
          const response = await fetch(API, body ? {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-dsh-github-nonce': stateRef.current?.nonce || '' },
            body: JSON.stringify(body), signal: controller.signal,
          } : { signal: controller.signal });
          const data = await response.json();
          if (!response.ok || !data.ok) { const error = new Error(data.error || '操作失败，请重试'); error.status = response.status; throw error; }
          return data;
        } finally { window.clearTimeout(timer); controllers.current.delete(controller); }
      }
      async function load(force = false) {
        const sequence = ++loadSequence.current;
        try {
          let data;
          try { data = await request(force && stateRef.current ? { action: 'refresh' } : undefined); }
          catch (err) { if (err.status !== 403) throw err; data = await request(); }
          if (alive.current && sequence === loadSequence.current) {
            const accountKey = (value) => (value?.accounts || []).map((account) => account.login + ':' + account.active).join('|');
            if (stateRef.current && accountKey(stateRef.current) !== accountKey(data)) { setRepoResult(null); setSSH(null); setCheckErrors({}); }
            stateRef.current = data; setState(data); setError('');
          }
        } catch (err) { if (alive.current && sequence === loadSequence.current) setError(err.name === 'AbortError' ? '查询已超时，请刷新重试' : err.message); }
        finally { if (alive.current) setLoading(false); }
      }
      useEffect(() => {
        alive.current = true; load();
        return () => { alive.current = false; controllers.current.forEach((controller) => controller.abort()); };
      }, []);
      const loginStatus = state?.login?.status;
      useEffect(() => {
        if (!['starting', 'waiting'].includes(loginStatus) && !state?.operationBusy) return undefined;
        let stopped = false; let timer;
        const poll = async () => { if (stopped) return; await load(); if (!stopped) timer = window.setTimeout(poll, 1500); };
        timer = window.setTimeout(poll, 1000);
        return () => { stopped = true; window.clearTimeout(timer); };
      }, [loginStatus, state?.operationBusy]);

      function ask(next, event) {
        returnFocus.current = event?.currentTarget || null;
        setConfirm(next);
      }
      function cancelConfirmation() { setConfirm(null); }
      useEffect(() => {
        if (confirm) {
          confirmRef.current?.focus({ preventScroll: true });
          confirmRef.current?.scrollIntoView?.({ block: 'nearest' });
        } else if (returnFocus.current) {
          const target = returnFocus.current;
          returnFocus.current = null;
          (target.isConnected ? target : rootRef.current?.querySelector('[data-add-account]'))?.focus({ preventScroll: true });
        }
      }, [confirm]);
      async function act(body) {
        if (operationLock.current) return;
        operationLock.current = true;
        const checking = body.action === 'ssh' || body.action === 'repo';
        setActionBusy(true); setBusyAction(body.action); setError(''); setNotice('');
        if (checking) {
          setCheckErrors((previous) => ({ ...previous, [body.action]: '' }));
          if (body.action === 'ssh') setSSH(null);
          else setRepoResult(null);
        }
        try {
          const result = await request(body);
          if (!alive.current) return;
          setConfirm(null);
          if (result.message && !checking && body.action !== 'cancel') setNotice(result.message);
          if (body.action === 'ssh') setSSH(result);
          if (body.action === 'repo') setRepoResult(result.repository);
          await load();
        } catch (err) {
          if (alive.current) {
            if (err.status === 403) await load();
            const message = err.name === 'AbortError' ? '操作超时，请重试' : err.message;
            if (checking) setCheckErrors((previous) => ({ ...previous, [body.action]: message }));
            else setError(message);
          }
        } finally {
          operationLock.current = false;
          if (alive.current) { setActionBusy(false); setBusyAction(''); }
        }
      }
      const disabled = actionBusy || state?.operationBusy || !state?.ghFound;
      const authDisabled = disabled || state?.environmentAuth;
      const active = state?.accounts?.find((account) => account.active);
      const isWaiting = ['starting', 'waiting'].includes(loginStatus);
      const confirmation = confirm ? h('section', { ref: confirmRef, tabIndex: -1, className: 'ga-card ga-confirm', 'data-danger': confirm.action === 'logout', 'aria-label': '确认授权操作',
        onKeyDown: (event) => { if (event.key === 'Escape' && !actionBusy) { event.preventDefault(); event.stopPropagation(); cancelConfirmation(); } } },
        h('h3', null, confirm.action === 'login' ? '在 GitHub 登录或添加账号' : confirm.action === 'logout' ? '退出本机账号 ' + confirm.login : '切换当前账号为 ' + confirm.login),
        h('p', { className: 'ga-muted' }, confirm.action === 'login'
          ? '在官方网页选择账号并确认权限。GitHub CLI 通常请求 repo、read:org、gist；完成后会成为本机 gh 当前账号。'
          : confirm.action === 'logout'
            ? '清除该账号的本机 gh 登录信息，影响这台电脑上共用 gh 的工具。GitHub 远端令牌与 SSH 密钥保留。'
            : '后续 gh 命令将使用此账号。SSH 推送身份仍由密钥决定。'),
        h('div', { className: 'ga-tools' }, button('取消', cancelConfirmation, { disabled: actionBusy, className: 'ga-quiet' }),
          button(actionBusy ? '处理中…' : confirm.action === 'logout' ? '确认退出本机' : confirm.action === 'login' ? '开始网页授权' : '确认切换', () => act({ ...confirm, confirmed: true }),
            { className: confirm.action === 'logout' ? 'ga-danger' : 'ga-primary', disabled: actionBusy, icon: actionBusy ? 'refresh' : undefined, spinning: actionBusy }))) : null;

      return h('div', { className: 'ga-root', ref: rootRef },
        h('header', { className: 'ga-head' },
          h('div', null, h('h2', null, '授权概览'), h('p', { className: 'ga-description' }, active ? '当前账号 · ' + active.login : '管理本机 GitHub 账号与连接')),
          h('div', { className: 'ga-tools' },
            button(loading ? '刷新中…' : '刷新状态', () => { if (!loading && !actionBusy) { setLoading(true); load(true); } }, { disabled: loading || actionBusy, className: 'ga-quiet', icon: 'refresh', spinning: loading }),
            state?.ghFound ? button('登录 / 添加账号', (event) => ask({ action: 'login' }, event), { className: 'ga-primary', disabled: authDisabled, icon: 'plus', 'data-add-account': true }) : null)),
        error ? h('div', { className: 'ga-notice ga-error', role: 'alert' }, error) : null,
        notice ? h('div', { className: 'ga-notice', role: 'status' }, notice) : null,
        state?.environmentAuth ? h('p', { className: 'ga-notice' }, '授权由 GH_TOKEN / GITHUB_TOKEN 控制。可查看和检查连接，账号变更请在启动环境中处理。') : null,
        loading && !state ? h('p', { className: 'ga-muted', role: 'status' }, '正在检查账号授权…') : null,
        state && !state.ghFound ? h('section', { className: 'ga-card ga-empty' }, icon('terminal'), h('h3', null, '尚未安装 GitHub CLI'), h('p', { className: 'ga-muted' }, '安装 gh 后重启 DSH，即可读取现有账号。'), h('div', { className: 'ga-tools', style: { justifyContent: 'center' } }, link('GitHub CLI 安装说明', 'https://cli.github.com/'))) : null,
        state?.ghFound ? h(React.Fragment, null,
          confirmation,
          isWaiting ? h('section', { className: 'ga-card ga-confirm', role: 'status' },
            h('h3', null, '完成 GitHub 网页授权'),
            h('p', { className: 'ga-step' }, state.login.code ? '1. 复制一次性代码' : '正在获取一次性代码…'),
            state.login.code ? h('div', { className: 'ga-code-row' }, h('div', { className: 'ga-code', 'aria-label': '一次性授权代码' }, state.login.code),
              button('复制代码', async () => { try { await navigator.clipboard.writeText(state.login.code); if (alive.current) setNotice('代码已复制'); } catch { if (alive.current) setError('无法复制，请手动输入代码'); } }, { className: 'ga-quiet', icon: 'copy' })) : null,
            h('p', { className: 'ga-step' }, '2. 打开 GitHub，输入代码并确认账号与权限'),
            h('div', { className: 'ga-tools' }, link('打开 GitHub 授权页面', 'https://github.com/login/device'), button(busyAction === 'cancel' ? '正在取消…' : '取消等待', () => act({ action: 'cancel', id: state.login.id }), { disabled: actionBusy, className: 'ga-quiet' })),
            h('p', { className: 'ga-muted' }, '完成后自动更新。取消只停止本机等待，已批准的授权需在 GitHub 撤销。')) : null,
          state.login && !isWaiting ? h('p', { className: 'ga-notice' + (state.login.status === 'failed' ? ' ga-error' : ''), role: 'status' }, state.login.message) : null,
          state.accounts.length === 0 && !state.error ? h('section', { className: 'ga-card ga-empty' }, icon('shield'), h('h3', null, '此电脑尚未登录 GitHub'), h('p', { className: 'ga-muted' }, '添加账号后，可查看授权范围并检查仓库权限。')) : null,
          state.error ? h('p', { className: 'ga-notice ga-error', role: 'alert' }, state.error) : null,
          ...state.accounts.map((account) => h('article', { className: 'ga-card ga-account', key: account.login, 'aria-label': account.login + ' 的授权' },
            h('div', { className: 'ga-account-head' }, h('div', { className: 'ga-avatar', 'aria-hidden': true }, account.login.slice(0, 2).toUpperCase()),
              h('div', { className: 'ga-identity' }, h('div', { className: 'ga-name' }, account.login), h('div', { className: 'ga-host' }, 'github.com')),
              h('div', { className: 'ga-badges' }, h('span', { className: 'ga-badge' + (account.state === 'success' ? ' ga-ok' : ' ga-error') }, h('span', { className: 'ga-dot' }), account.state === 'success' ? '授权有效' : '授权需检查'),
                account.active ? h('span', { className: 'ga-badge ga-current' }, '当前账号') : null)),
            h('div', { className: 'ga-account-info' },
              h('span', { className: 'ga-info-item', title: '凭据来源' }, icon('key'), storageLabel(account.tokenSource)),
              h('span', { className: 'ga-info-item', title: 'Git 协议；SSH 身份可在下方检查' }, icon('terminal'), account.gitProtocol.toUpperCase()),
              h('div', { className: 'ga-scopes', 'aria-label': '授权范围' }, account.scopes.length ? account.scopes.map((scope) => h('span', { key: scope, title: scopeInfo[scope] ? scope + ' · ' + scopeInfo[scope][1] : scope }, scopeInfo[scope]?.[0] || scope)) : h('span', null, '范围未提供'))),
            account.error ? h('p', { className: 'ga-muted ga-error' }, account.error) : null,
            h('div', { className: 'ga-account-actions' },
              !account.active ? button('设为当前账号', (event) => ask({ action: 'switch', login: account.login }, event), { className: 'ga-primary', disabled: authDisabled || /^(?:GH_TOKEN|GITHUB_TOKEN)$|environment/i.test(account.tokenSource) }) : null,
              button('重新登录授权', (event) => ask({ action: 'login' }, event), { className: 'ga-quiet', disabled: authDisabled }),
              button('退出本机', (event) => ask({ action: 'logout', login: account.login }, event), { className: 'ga-danger', disabled: authDisabled || /^(?:GH_TOKEN|GITHUB_TOKEN)$|environment/i.test(account.tokenSource) })))),
          h('section', { className: 'ga-card', 'aria-label': '连接检查' },
            h('div', { className: 'ga-check-row' }, h('div', { className: 'ga-check-copy' }, icon('terminal'), h('div', null, h('h3', null, 'SSH 推送连接'),
              h('p', { className: 'ga-check-state' }, ssh ? ssh.success ? '身份 · ' + ssh.login : '连接未通过' : '尚未检查 · 与网页授权分别验证'))),
              button(busyAction === 'ssh' ? '检查中…' : '检查 SSH 连接', () => act({ action: 'ssh' }), { disabled, icon: busyAction === 'ssh' ? 'refresh' : undefined, spinning: busyAction === 'ssh' })),
            checkErrors.ssh ? h('p', { className: 'ga-notice ga-error', role: 'alert' }, checkErrors.ssh) : null,
            ssh ? h('div', { className: 'ga-notice' + (ssh.success ? ' ga-ok' : ' ga-error'), role: 'status' },
              ssh.success ? ssh.success && active && ssh.login !== active.login ? 'SSH 身份与当前 gh 账号不同，推送会使用 ' + ssh.login + '。' : 'SSH 连接有效，可以使用此身份访问有权限的仓库。' : 'SSH 连接未通过，请检查密钥、主机信任与网络。',
              !ssh.success ? h('details', { className: 'ga-advanced' }, h('summary', null, icon('chevron', 'ga-chevron'), '查看诊断详情'), h('p', { className: 'ga-diagnostics' }, ssh.message)) : null) : null,
            h('div', { className: 'ga-separator' }),
            h('h3', null, '仓库访问权限'),
            h('form', { className: 'ga-tools', onSubmit: (event) => { event.preventDefault(); if (!disabled && repository.trim()) act({ action: 'repo', repository }); } },
              h('input', { className: 'ga-input', 'aria-label': 'GitHub 仓库', placeholder: 'owner/repository 或 GitHub 仓库地址', value: repository, disabled: actionBusy,
                onChange: (event) => { setRepository(event.target.value); setRepoResult(null); setCheckErrors((previous) => ({ ...previous, repo: '' })); } }),
              h('button', { type: 'submit', disabled: disabled || !repository.trim() }, busyAction === 'repo' ? icon('refresh', 'ga-spinning') : null, busyAction === 'repo' ? '检查中…' : '检查仓库权限')),
            checkErrors.repo ? h('p', { className: 'ga-notice ga-error', role: 'alert' }, checkErrors.repo) : null,
            repoResult ? h('div', { className: 'ga-notice', role: 'status' },
              h('div', { className: 'ga-result-head' }, h('strong', null, repoResult.name), h('span', { className: 'ga-badge' + (repoResult.canWrite ? ' ga-ok' : '') }, repoResult.canWrite ? '可写入' : '无写入权限')),
              h('p', { className: 'ga-result-note' }, (repoResult.private ? '私有' : '公开') + '仓库 · ' + (permissionLabel[repoResult.permission] || repoResult.permission) + ' · 当前 API 账号',
                h('br'), 'Git 推送还取决于 SSH 身份与分支保护。')) : null),
          h('details', { className: 'ga-advanced' }, h('summary', null, icon('chevron', 'ga-chevron'), '远端授权与高级选项'),
            h('div', { className: 'ga-advanced-body' },
              h('p', { className: 'ga-muted' }, '本机退出只移除 gh 登录。撤销 GitHub CLI 应用授权可能影响其他设备；SSH 密钥单独管理。'),
              h('div', { className: 'ga-tools' }, link('GitHub 应用授权 / 撤销', 'https://github.com/settings/applications'), link('SSH 密钥管理', 'https://github.com/settings/keys')),
              h('p', { className: 'ga-diagnostics' }, state.ghVersion + ' · ' + state.ghPath),
              h('p', { className: 'ga-diagnostics' }, '凭据由 gh 管理，插件不展示完整令牌、不接收密码、不自动上传 SSH 密钥。')))) : null);
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(installStyles, 'github-auth: styles');
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'github-auth', order: 35,
          label: () => 'GitHub 授权' }, GitHubSection)), 'github-auth: settings page');
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-github-auth' }, GitHubSection)), 'github-auth: plugin page');
      },
    };
  },
});
