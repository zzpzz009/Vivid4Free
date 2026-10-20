const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAccountService, ACCOUNT_API } = require('../account-service.cjs');

const roots = [];
test.afterEach(() => { for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const secureStorage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(value).map(byte => byte ^ 0xa5),
  decryptString: value => Buffer.from(value).map(byte => byte ^ 0xa5).toString()
};
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const context = name => ({ profile: { id: 7, username: name, nickname: '用户', token: 'must-not-leak', apiKeys: ['must-not-leak'] }, apiKeys: ['must-not-leak'] });
function setup(fetchImpl, options = {}) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vivid-account-')); roots.push(userData);
  return { userData, file: path.join(userData, 'account-session.json'),
    service: createAccountService({ userData, secureStorage, fetchImpl, ...options }) };
}
const credentials = { username: 'fixture-user', password: 'fixture-password' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('verified context is required for login, with a fixed upstream and no token in public snapshots', async () => {
  const calls = [];
  const { service, file, userData } = setup(async (url, init) => {
    calls.push({ url, init });
    return url.endsWith('/auth/password-login') ? json({ token: 'fixture-business-token' }) : json(context('fixture-user'));
  });
  assert.equal(service.status().status, 'signed_out');
  const signedIn = await service.login(credentials);
  assert.equal(signedIn.status, 'signed_in');
  assert.deepEqual(signedIn.profile, { id: 7, username: 'fixture-user', nickname: '用户' });
  assert.equal(signedIn.persistent, true);
  assert.ok(!JSON.stringify(signedIn).includes('fixture-business-token'));
  assert.ok(!JSON.stringify(signedIn).includes('must-not-leak'));
  assert.deepEqual(calls.map(x => x.url), [`${ACCOUNT_API}/auth/password-login`, `${ACCOUNT_API}/account/context`]);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(Object.hasOwn(calls[0].init.headers, 'Origin'), false);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer fixture-business-token');
  assert.equal(JSON.parse(calls[0].init.body).password, credentials.password);
  assert.ok(!fs.readFileSync(file, 'utf8').includes('fixture-business-token'));
  const restored = createAccountService({ userData, secureStorage, fetchImpl: async () => json(context('fixture-user')) });
  assert.equal(restored.status().status, 'checking');
  assert.equal((await restored.refresh()).status, 'signed_in');
});

test('unavailable OS encryption uses memory only without plaintext persistence', async () => {
  const { service, file } = setup(async url => url.endsWith('/auth/password-login') ? json({ token: 'memory-token' }) : json(context('memory')), {
    secureStorage: { isEncryptionAvailable: () => false }
  });
  const result = await service.login(credentials);
  assert.equal(result.status, 'signed_in'); assert.equal(result.persistent, false);
  assert.match(result.message, /关闭客户端后需要重新登录/);
  assert.equal(fs.existsSync(file), false);
});

test('a missing login token or missing verified profile cannot produce signed_in', async () => {
  for (const result of [{ token: '' }, { token: 'unverified' }]) {
    const { service, file } = setup(async url => url.endsWith('/auth/password-login') ? json(result) : json({ availability: {} }));
    const current = await service.login(credentials);
    assert.notEqual(current.status, 'signed_in'); assert.equal(current.profile, null);
    assert.equal(fs.existsSync(file), false);
  }
});

test('non-identity metadata cannot stand in for a verified user profile', async () => {
  const { service } = setup(async url => url.endsWith('/auth/password-login')
    ? json({ token: 'fixture-token' }) : json({ profile: { userNameComplete: false, companyName: 'Company' } }));
  assert.notEqual((await service.login(credentials)).status, 'signed_in');
});

test('401 and 403 revoke the local session, whereas network errors keep it unverified', async () => {
  for (const failure of [401, 403, 'network']) {
    let broken = false;
    const { service, file } = setup(async url => {
      if (url.endsWith('/auth/password-login')) return json({ token: 'revocable-token' });
      if (broken) { if (failure === 'network') throw new Error('private provider details'); return json({}, failure); }
      return json(context('fixture-user'));
    });
    await service.login(credentials); broken = true;
    const result = await service.refresh();
    assert.equal(result.status, failure === 'network' ? 'unavailable' : 'signed_out');
    assert.equal(fs.existsSync(file), failure === 'network');
    assert.ok(!result.message.includes('private provider'));
  }
});

test('Retry-After prevents immediate retry bursts and expires using the clock', async () => {
  let clock = 100000, calls = 0;
  const { service } = setup(async () => { calls += 1; return json({}, 429, { 'Retry-After': '17' }); }, { now: () => clock });
  const first = await service.login(credentials);
  assert.equal(first.retryAfterSeconds, 17);
  await service.login(credentials); assert.equal(calls, 1);
  clock += 18000; await service.login(credentials); assert.equal(calls, 2);
});

test('an in-flight refresh cannot restore a session after local logout', async () => {
  let hold = false; const pending = deferred();
  const { service, file } = setup(async url => {
    if (url.endsWith('/auth/password-login')) return json({ token: 'fixture-token' });
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return hold ? pending.promise : json(context('before'));
  });
  await service.login(credentials); hold = true;
  const refresh = service.refresh();
  assert.equal((await service.logout()).status, 'signed_out');
  pending.resolve(json(context('stale'))); await refresh;
  assert.equal(service.status().status, 'signed_out'); assert.equal(service.status().profile, null);
  assert.equal(fs.existsSync(file), false);
});

test('a pending login cannot recreate a session after the user signs out', async () => {
  const pending = deferred(); let calls = 0;
  const { service, file } = setup(async () => { calls += 1; return pending.promise; });
  const login = service.login(credentials);
  await service.logout(); pending.resolve(json({ token: 'late-token' })); await login;
  assert.equal(calls, 1); assert.equal(service.status().status, 'signed_out');
  assert.equal(fs.existsSync(file), false);
});

test('a new login does not reuse an older account refresh promise', async () => {
  const old = deferred(); let requests = 0;
  const { service } = setup(async url => {
    if (url.endsWith('/auth/password-login')) return json({ token: `token-${requests}` });
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    requests += 1;
    return requests === 2 ? old.promise : json(context(`user-${requests}`));
  });
  await service.login(credentials); const stale = service.refresh(); await service.logout();
  const next = await service.login(credentials);
  assert.equal(next.status, 'signed_in'); assert.equal(next.profile.username, 'user-3');
  old.resolve(json(context('old-user'))); await stale;
  assert.equal(service.status().profile.username, 'user-3');
});

test('local logout clears credentials even when server revocation cannot be confirmed', async () => {
  const { service, file } = setup(async url => {
    if (url.endsWith('/auth/password-login')) return json({ token: 'fixture-token' });
    if (url.endsWith('/auth/logout')) throw new Error('private stack');
    return json(context('before'));
  });
  await service.login(credentials);
  const result = await service.logout();
  assert.equal(result.status, 'signed_out'); assert.equal(fs.existsSync(file), false);
  assert.match(result.message, /服务器注销未确认/); assert.ok(!JSON.stringify(result).includes('fixture-token'));
});

test('password reset opens only HTTPS on the approved official host', async () => {
  for (const url of ['file:///secret', 'https://example.invalid/reset', 'https://user:pass@www.vividai.com.cn/reset', 'http://www.vividai.com.cn/reset']) {
    const { service } = setup(async () => json({ redirectUrl: url }));
    await assert.rejects(service.passwordResetUrl());
  }
  const { service } = setup(async () => json({ redirectUrl: 'https://www.vividai.com.cn/forget/vividai-web' }));
  assert.equal(await service.passwordResetUrl(), 'https://www.vividai.com.cn/forget/vividai-web');
});

test('invalid input performs no network request and corrupt storage does not stop the app', async () => {
  let calls = 0;
  const { service, userData, file } = setup(async () => { calls += 1; throw new Error('must not call'); });
  assert.equal((await service.login({ username: '', password: '' })).status, 'signed_out');
  assert.equal(calls, 0);
  fs.writeFileSync(file, 'not-json');
  const restored = createAccountService({ userData, secureStorage, fetchImpl: async () => json({}) });
  assert.equal(restored.status().status, 'signed_out'); assert.equal(fs.existsSync(file), false);
});

const signupUrl = (overrides = {}) => {
  const url = new URL('https://www.vividai.com.cn/signup/oauth/authorize');
  for (const [key, value] of Object.entries({ client_id: 'public-web-client', response_type: 'code',
    redirect_uri: 'https://www.vividai.com.cn/new-api/api/auth/callback', scope: 'openid profile email', state: 'fixture-state', ...overrides })) url.searchParams.set(key, value);
  return url.href;
};

test('registration uses fixed signup discovery without account bearer and preserves the active session', async () => {
  const calls = [];
  const { service } = setup(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/password-login')) return json({ token: 'fixture-token' });
    if (url.includes('/auth/casdoor-authorize-url')) return json({ redirectUrl: signupUrl() });
    return json(context('existing-account'));
  });
  await service.login(credentials); const before = service.status();
  assert.equal(await service.registrationUrl(), signupUrl());
  const request = calls.at(-1);
  assert.equal(request.url, `${ACCOUNT_API}/auth/casdoor-authorize-url?mode=signup`);
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.headers.Authorization, undefined); assert.equal(request.init.headers.Origin, undefined);
  assert.equal(request.init.body, undefined); assert.deepEqual(service.status(), before);
});

test('registration rejects unsafe destinations, callbacks and unexpected token/query parameters', async () => {
  const cases = [
    'file:///signup/oauth/authorize', signupUrl().replace('https:', 'http:'),
    signupUrl().replace('www.vividai.com.cn', 'example.invalid'),
    signupUrl().replace('https://', 'https://name:password@'),
    signupUrl().replace('.cn/', '.cn:8443/'), signupUrl().replace('/signup/', '/login/'),
    `${signupUrl()}#fragment`, `${signupUrl()}&client_id=duplicate`,
    signupUrl({ access_token: 'must-not-pass' }), signupUrl({ clientCallbackUrl: 'http://127.0.0.1:1234/callback' }),
    signupUrl({ redirect_uri: 'https://example.invalid/callback' }),
    signupUrl({ redirect_uri: 'https://www.vividai.com.cn/new-api/api/auth/callback?extra=1' }),
    signupUrl({ response_type: 'token' }), signupUrl({ state: '' }), 'malformed-url'
  ];
  for (const redirectUrl of cases) {
    const { service } = setup(async () => json({ redirectUrl }));
    await assert.rejects(service.registrationUrl()); assert.equal(service.status().status, 'signed_out');
  }
});
