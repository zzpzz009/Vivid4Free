const fs = require('node:fs');
const path = require('node:path');

const ACCOUNT_API = 'https://www.vividai.com.cn/new-api/api';
const RESET_HOSTS = new Set(['www.vividai.com.cn']);
const MAX_SESSION_BYTES = 64 * 1024;

function accountError(kind, message, retryAfterSeconds = 0) {
  return Object.assign(new Error(message), { kind, retryAfterSeconds });
}
function publicProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const key of ['id', 'username', 'nickname', 'email', 'companyName', 'userNameComplete']) {
    if (typeof value[key] === 'string') result[key] = value[key].slice(0, 250);
    else if (typeof value[key] === 'number' || typeof value[key] === 'boolean') result[key] = value[key];
  }
  if (value.company && typeof value.company.name === 'string') result.companyName = value.company.name.slice(0, 250);
  const hasIdentity = (typeof result.id === 'number' && Number.isFinite(result.id)) ||
    (typeof result.id === 'string' && result.id.trim()) ||
    (typeof result.username === 'string' && result.username.trim());
  return hasIdentity ? result : null;
}

function createAccountService({ userData, secureStorage, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const sessionFile = path.join(userData, 'account-session.json');
  let token = '', profile = null, status = 'signed_out', message = '', persistent = false;
  let lastCheckedAt = null, revision = 0, refreshing = null, refreshRevision = -1, signingIn = false, retryAt = 0;
  const snapshot = () => ({ status, profile, persistent, message,
    retryAfterSeconds: Math.max(0, Math.ceil((retryAt - now()) / 1000)), lastCheckedAt });
  const removeSessionFile = () => {
    try { if (fs.lstatSync(sessionFile).isFile() && !fs.lstatSync(sessionFile).isSymbolicLink()) fs.unlinkSync(sessionFile); }
    catch (error) { if (error.code !== 'ENOENT') throw accountError('storage', '无法清理本机登录记录，请检查用户目录权限'); }
  };
  const clear = () => {
    revision += 1; token = ''; profile = null; status = 'signed_out'; persistent = false;
    lastCheckedAt = null; retryAt = 0;
    removeSessionFile();
  };
  const save = () => {
    persistent = false;
    if (!secureStorage?.isEncryptionAvailable()) return;
    const ciphertext = secureStorage.encryptString(JSON.stringify({ token, profile })).toString('base64');
    const temporary = `${sessionFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, ciphertext }), { mode: 0o600 });
    fs.renameSync(temporary, sessionFile); persistent = true;
  };
  try {
    const stat = fs.lstatSync(sessionFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SESSION_BYTES || !secureStorage?.isEncryptionAvailable()) throw new Error('Unavailable protected session');
    const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    if (saved.version !== 1 || typeof saved.ciphertext !== 'string') throw new Error('Invalid session');
    const value = JSON.parse(secureStorage.decryptString(Buffer.from(saved.ciphertext, 'base64')));
    if (typeof value.token !== 'string' || !value.token || value.token.length > 16384) throw new Error('Invalid token');
    token = value.token; profile = publicProfile(value.profile); status = 'checking'; persistent = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      try { clear(); message = '本机登录记录无法恢复，请重新登录'; }
      catch { status = 'unavailable'; message = '本机登录记录无法清理，请检查用户目录权限'; }
    }
  }

  async function request(route, { method = 'GET', bearer = '', payload } = {}) {
    let response;
    try {
      response = await fetchImpl(`${ACCOUNT_API}${route}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
    } catch { throw accountError('network', '暂时无法连接账号中心，请检查网络后重试'); }
    if (!response.ok) {
      if (response.status === 401) throw accountError('unauthorized', '账号或密码不正确，或登录凭据已失效，请重新登录');
      if (response.status === 403) throw accountError('forbidden', '账号暂时无法使用此服务，请确认已开通或联系管理员');
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const seconds = Number(raw) || Math.ceil((Date.parse(raw) - now()) / 1000) || 60;
        throw accountError('rate_limit', '请求过于频繁，请等待后重试', Math.min(3600, Math.max(1, seconds)));
      }
      throw accountError('server', response.status === 400 ? '账号信息格式不正确，请检查后重试' : '账号服务暂时不可用，请稍后重试');
    }
    if (response.status === 204) return {};
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 512 * 1024) throw new Error('Response too large');
        chunks.push(Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { throw accountError('response', '账号中心返回的数据暂时无法识别，请稍后重试'); }
  }
  function unavailable(error) {
    status = 'unavailable'; message = error.message;
    if (error.retryAfterSeconds) retryAt = now() + error.retryAfterSeconds * 1000;
    return snapshot();
  }
  const refresh = () => {
    if (!token) return Promise.resolve(snapshot());
    if (refreshing && refreshRevision === revision) return refreshing;
    if (retryAt > now()) return Promise.resolve(snapshot());
    const current = revision, currentToken = token;
    status = 'checking'; message = '';
    const operation = (async () => {
      try {
        const context = await request('/account/context', { bearer: currentToken });
        if (revision !== current) return snapshot();
        const verified = publicProfile(context.profile);
        if (!verified) throw accountError('response', '账号中心未返回有效用户资料，请稍后重试');
        profile = verified; status = 'signed_in'; lastCheckedAt = new Date(now()).toISOString(); retryAt = 0;
        try { save(); } catch { persistent = false; }
        message = persistent ? '' : '本机无法安全保存登录，关闭客户端后需要重新登录';
        return snapshot();
      } catch (error) {
        if (revision !== current) return snapshot();
        if (['unauthorized', 'forbidden'].includes(error.kind)) { clear(); message = error.message; return snapshot(); }
        return unavailable(error);
      }
    })();
    refreshing = operation; refreshRevision = current;
    const finished = () => { if (refreshing === operation) refreshing = null; };
    operation.then(finished, finished);
    return operation;
  };
  const login = async (input) => {
    if (signingIn) return { ...snapshot(), message: '正在登录，请稍候' };
    if (!input || typeof input.username !== 'string' || !input.username.trim() || input.username.length > 200 ||
        typeof input.password !== 'string' || !input.password || input.password.length > 200) {
      return { ...snapshot(), message: '请输入有效的账号和密码' };
    }
    if (retryAt > now()) return snapshot();
    clear(); const current = revision;
    signingIn = true; status = 'checking'; message = '';
    try {
      const response = await request('/auth/password-login', { method: 'POST', payload: { username: input.username.trim(), password: input.password } });
      if (revision !== current) return snapshot();
      if (typeof response.token !== 'string' || !response.token || response.token.length > 16384) throw accountError('response', '登录响应缺少有效凭据，请联系账号系统管理员');
      token = response.token;
      return await refresh();
    } catch (error) {
      if (revision !== current) return snapshot();
      if (error.kind === 'rate_limit') retryAt = now() + error.retryAfterSeconds * 1000;
      status = error.kind === 'network' || error.kind === 'server' ? 'unavailable' : 'signed_out';
      message = error.message; return snapshot();
    } finally { signingIn = false; }
  };
  const logout = async () => {
    const currentToken = token; let storageFailure = false;
    try { clear(); } catch { storageFailure = true; }
    message = '已退出本机登录'; const current = revision;
    if (currentToken) {
      try { await request('/auth/logout', { method: 'POST', bearer: currentToken }); }
      catch { if (revision === current) message = '已退出本机登录；服务器注销未确认，可在账号中心检查设备会话'; }
    }
    if (storageFailure && revision === current) {
      status = 'unavailable'; message = '无法清理本机保存的登录记录，请检查用户目录权限后再次退出';
    }
    return snapshot();
  };
  const passwordResetUrl = async () => {
    const response = await request('/auth/password-reset-url');
    let url;
    try { url = new URL(response.redirectUrl); } catch { throw accountError('response', '账号系统未返回可用的找回密码入口'); }
    if (url.protocol !== 'https:' || !RESET_HOSTS.has(url.hostname) || url.username || url.password || url.port) {
      throw accountError('response', '账号系统返回的找回密码地址未获允许，请联系管理员');
    }
    return url.href;
  };
  const registrationUrl = async () => {
    const response = await request('/auth/casdoor-authorize-url?mode=signup');
    let url, callback;
    try {
      if (typeof response.redirectUrl !== 'string' || response.redirectUrl.length > 16384) throw new Error();
      url = new URL(response.redirectUrl);
      callback = new URL(url.searchParams.get('redirect_uri'));
    } catch { throw accountError('response', '账号系统未返回可用的注册入口'); }
    const official = value => value.protocol === 'https:' && value.hostname === 'www.vividai.com.cn' && !value.username && !value.password && !value.port && !value.hash;
    const allowed = new Set(['client_id', 'response_type', 'redirect_uri', 'scope', 'state']);
    if (!official(url) || url.pathname !== '/signup/oauth/authorize' ||
        !official(callback) || callback.pathname !== '/new-api/api/auth/callback' || callback.search ||
        [...url.searchParams.keys()].some(key => !allowed.has(key) || url.searchParams.getAll(key).length !== 1) ||
        url.searchParams.get('response_type') !== 'code' || !url.searchParams.get('client_id') || !url.searchParams.get('state')) {
      throw accountError('response', '账号系统返回的注册地址未获允许，请联系管理员');
    }
    return url.href;
  };
  return { status: snapshot, login, refresh, logout, passwordResetUrl, registrationUrl };
}

module.exports = { createAccountService, ACCOUNT_API };
