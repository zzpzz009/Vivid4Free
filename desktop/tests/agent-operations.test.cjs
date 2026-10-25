const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { startServer } = require('../server.cjs');

const tempRoot = path.resolve(__dirname, '.tmp/agent-operations');
const token = 'agent-operations-isolated-fixture-000000000';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=', 'base64');
const routes = [
  ['GET', '/v1/client/runtime', 'runtimeStatus'],
  ['POST', '/v1/client/runtime/check', 'checkRuntime'],
  ['POST', '/v1/client/runtime/connect-directory', 'connectRuntimeDirectory'],
  ['POST', '/v1/client/account/refresh', 'refreshAccount'],
  ['GET', '/v1/client/output', 'outputInfo'],
  ['POST', '/v1/client/output/open', 'openOutput'],
  ['POST', '/v1/client/gallery/import', null],
];
const mutations = routes.filter(([method]) => method === 'POST');
const directoryRoutes = new Set(['/v1/client/runtime/connect-directory', '/v1/client/gallery/import']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function request(origin, route, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(route, origin), { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, bytes, json: () => JSON.parse(bytes.toString('utf8')) });
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Isolated HTTP fixture timed out')));
    req.once('error', reject);
    req.end(body);
  });
}
function expectError(response, status, label) {
  assert.equal(response.status, status, label);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(Object.keys(response.json()), ['error']);
  assert.equal(typeof response.json().error, 'string');
}
async function fixture(t, { missingPort } = {}) {
  fs.mkdirSync(tempRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(tempRoot, 'case-'));
  fs.mkdirSync(path.join(root, 'ui'));
  fs.writeFileSync(path.join(root, 'ui/index.html'), '<html>isolated fixture</html>');
  const galleryInput = path.join(root, 'input-gallery');
  fs.mkdirSync(galleryInput);
  fs.writeFileSync(path.join(galleryInput, 'sample.png'), png);
  const state = { account: 'signed_out', calls: [], handlers: {}, releases: [], upstreamCalls: [], shutdowns: 0 };
  const values = {
    runtimeStatus: { state: 'ready', installed: true, engineReady: true, version: 'fixture' },
    checkRuntime: { state: 'ready', installed: true, checked: true },
    connectRuntimeDirectory: { state: 'ready', installed: true, connected: true },
    refreshAccount: { status: 'signed_in', user: { displayName: 'Fixture' } },
    outputInfo: { directory: path.join(root, 'output'), exists: true },
    openOutput: { opened: true },
  };
  const clientControl = { status: () => ({ version: 'fixture' }), shutdown: () => { state.shutdowns++; } };
  for (const [, , port] of routes) {
    if (!port || port === missingPort) continue;
    clientControl[port] = async (...args) => {
      state.calls.push({ port, args });
      return state.handlers[port] ? state.handlers[port](...args) : values[port];
    };
  }
  let server;
  const upstream = http.createServer(async (req, res) => {
    state.upstreamCalls.push(req.url);
    if (state.queueGate) {
      state.queueGate.entered.resolve();
      await state.queueGate.release.promise;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ queue_running: [], queue_pending: [] }));
  });
  t.after(async () => {
    for (const release of state.releases) release();
    try { await server?.close(); }
    finally {
      upstream.closeAllConnections();
      if (upstream.listening) await new Promise(resolve => upstream.close(resolve));
      assert.ok(root.startsWith(`${tempRoot}${path.sep}`), 'Cleanup must stay inside the isolated test root');
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  await new Promise((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(0, '127.0.0.1', resolve);
  });
  server = await startServer({ root, uiDir: path.join(root, 'ui'), port: 0, agentPort: 0, agentToken: token,
    comfyUrl: `http://127.0.0.1:${upstream.address().port}`, runtimeRoot: () => null,
    accountStatus: () => ({ status: state.account }),
    workflows: { available: () => false, load: () => { throw new Error('No real workflows in this fixture'); } },
    clientControl });
  const f = { ...server, root, state, values, galleryInput,
    agent: (route, options = {}) => request(server.agentOrigin, route, { ...options, headers: { authorization: `Bearer ${token}`, ...options.headers } }),
    post: (route, value = {}) => request(server.agentOrigin, route, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(value) }),
    validBody: route => directoryRoutes.has(route) ? { directory: galleryInput } : {},
    hold: port => {
      const entered = deferred(), release = deferred();
      state.releases.push(release.resolve);
      state.handlers[port] = async () => { entered.resolve(); await release.promise; return values[port]; };
      return { entered, release };
    },
  };
  return f;
}

test('new Agent operations authenticate Host, Origin, Bearer and signed-in account before executing', async t => {
  const f = await fixture(t);
  for (const [method, route] of routes) {
    const options = { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(f.validBody(route)) : undefined };
    expectError(await request(f.agentOrigin, route, options), 401, route);
    expectError(await f.agent(route, { ...options, headers: { ...options.headers, authorization: 'Bearer incorrect' } }), 401, route);
    expectError(await f.agent(route, { ...options, headers: { ...options.headers, host: `localhost:${new URL(f.agentOrigin).port}` } }), 403, route);
    for (const origin of ['null', f.origin]) {
      expectError(await f.agent(route, { ...options, headers: { ...options.headers, origin } }), 403, route);
    }
    for (const account of ['signed_out', 'checking', 'unavailable']) {
      f.state.account = account;
      expectError(await f.agent(route, options), 401, `${route}: ${account}`);
    }
  }
  assert.deepEqual(f.state.calls, []);
  assert.deepEqual(f.state.upstreamCalls, []);
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'data/gallery')), []);
});

test('new POST operations reject non-object, extra-key and malformed JSON before forwarding', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  for (const [, route] of mutations) {
    for (const value of [null, true, 1, 'directory', [], {}, { extra: true }, { ...f.validBody(route), extra: true }]) {
      if (!directoryRoutes.has(route) && value && !Array.isArray(value) && typeof value === 'object' && !Object.keys(value).length) continue;
      expectError(await f.post(route, value), 400, `${route}: ${JSON.stringify(value)}`);
    }
    expectError(await f.agent(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), 400, route);
    expectError(await f.agent(route, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }), 415, route);
  }
  assert.deepEqual(f.state.calls, []);
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'data/gallery')), []);
});

test('explicit directory routes reject missing, relative, non-string and NUL paths', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  for (const route of directoryRoutes) {
    for (const directory of ['', '.', 'relative/folder', '../outside', null, 1, {}, [], `${f.galleryInput}\0child`]) {
      expectError(await f.post(route, { directory }), 400, `${route}: ${JSON.stringify(directory)}`);
    }
  }
  assert.deepEqual(f.state.calls, []);
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'data/gallery')), []);
});

test('new operations forward to the narrow client ports and preserve structured results', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  for (const [method, route, port] of routes.filter(([, , port]) => port)) {
    const response = method === 'POST' ? await f.post(route, f.validBody(route)) : await f.agent(route);
    assert.equal(response.status, 200, route);
    assert.deepEqual(response.json(), f.values[port], route);
    const call = f.state.calls.at(-1);
    assert.equal(call.port, port);
    if (port === 'connectRuntimeDirectory') assert.deepEqual(call.args, [f.galleryInput]);
    else assert.ok(call.args.every(value => value === undefined), 'Parameterless ports receive no payload');
  }
  assert.equal(f.state.calls.length, 6);
  assert.deepEqual(f.state.upstreamCalls, []);
});

test('runtime directory validation remains owned by the manager port', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  const directory = path.join(f.root, 'not-a-valid-runtime');
  f.state.handlers.connectRuntimeDirectory = input => {
    assert.equal(input, directory);
    throw Object.assign(new Error('Fixture runtime manifest is invalid'), { status: 409 });
  };
  expectError(await f.post('/v1/client/runtime/connect-directory', { directory }), 409);
  assert.deepEqual(f.state.calls, [{ port: 'connectRuntimeDirectory', args: [directory] }]);
  assert.equal(fs.existsSync(directory), false, 'Server must not create or fix a runtime directory');
  assert.equal((await f.post('/v1/client/runtime/check')).status, 200, 'Failed manager operation releases the action gate');
});

test('gallery directory import uses shared real-file hashing, filters entries and deduplicates', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  fs.writeFileSync(path.join(f.galleryInput, 'duplicate.PNG'), png);
  fs.writeFileSync(path.join(f.galleryInput, 'ignored.txt'), Buffer.from('not an image'));
  fs.mkdirSync(path.join(f.galleryInput, 'nested'));
  fs.writeFileSync(path.join(f.galleryInput, 'nested/ignored.png'), Buffer.from('not traversed'));
  const first = await f.post('/v1/client/gallery/import', { directory: f.galleryInput });
  assert.equal(first.status, 200);
  assert.deepEqual(first.json(), { added: 1, total: 1 });
  assert.deepEqual((await f.post('/v1/client/gallery/import', { directory: f.galleryInput })).json(), { added: 0, total: 1 });
  assert.deepEqual(f.importGallery([path.join(f.galleryInput, 'sample.png')]), { added: 0, total: 1 }, 'Existing importer and Agent route share one gallery');
  assert.equal(typeof f.importGalleryDirectory, 'function', 'Explicit directory service is shared with native import');
  assert.deepEqual(await f.importGalleryDirectory(f.galleryInput), { added: 0, total: 1 });
  const listing = (await request(f.origin, '/img/images')).json();
  assert.equal(listing.images.length, 1);
  assert.equal(listing.images[0].id, sha(png));
  const stored = await request(f.origin, listing.images[0].url);
  assert.equal(stored.status, 200);
  assert.equal(sha(stored.bytes), sha(png));
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'data/gallery.json'), 'utf8')).length, 1);
  assert.deepEqual(f.state.calls, []);
});

test('unexpected service errors return safe JSON and release the action gate', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  const sentinel = 'fixture-secret-must-not-leak';
  f.state.handlers.refreshAccount = () => { throw new Error(sentinel); };
  const result = await f.post('/v1/client/account/refresh');
  expectError(result, 500);
  assert.ok(!result.bytes.toString().includes(sentinel));
  assert.equal((await f.post('/v1/client/output/open')).status, 200);
});

test('missing or non-directory gallery sources fail without writing gallery records', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  for (const directory of [path.join(f.root, 'missing-gallery'), path.join(f.galleryInput, 'sample.png')]) {
    expectError(await f.post('/v1/client/gallery/import', { directory }), 400);
  }
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'data/gallery')), []);
  assert.equal((await f.post('/v1/client/runtime/check')).status, 200, 'Gallery failures release the action gate');
});

test('unsupported host operation returns 503 and unknown routes remain 404', async t => {
  const f = await fixture(t, { missingPort: 'checkRuntime' }); f.state.account = 'signed_in';
  expectError(await f.post('/v1/client/runtime/check'), 503);
  for (const route of ['/v1/client/runtime/unknown', '/v1/client/gallery/unknown', '/v2/client/runtime', '/v1/client/output/open-extra']) {
    expectError(await f.agent(route), 404, route);
  }
  expectError(await f.agent('/v1/client/runtime/check'), 404, 'Wrong method does not execute mutation');
  assert.deepEqual(f.state.calls, []);
});

test('an in-flight client action rejects another action, Agent/UI task submission and shutdown', { timeout: 10000 }, async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  let submissions = 0;
  f.service.submit = async () => { submissions++; return { id: 'unexpected' }; };
  const gate = f.hold('checkRuntime');
  const pending = f.post('/v1/client/runtime/check');
  await gate.entered.promise;
  try {
    expectError(await f.post('/v1/client/output/open'), 409);
    expectError(await f.post('/v1/client/gallery/import', { directory: f.galleryInput }), 409);
    expectError(await f.post('/v1/tasks', {}), 409);
    expectError(await request(f.origin, '/api/desktop/tasks', { method: 'POST', headers: { origin: f.origin, 'content-type': 'application/json' }, body: '{}' }), 409);
    expectError(await f.post('/v1/client/shutdown'), 409);
    assert.equal(submissions, 0);
    assert.equal(f.state.shutdowns, 0);
    assert.deepEqual(fs.readdirSync(path.join(f.root, 'data/gallery')), []);
    assert.deepEqual(f.state.calls.map(call => call.port), ['checkRuntime']);
    assert.equal((await f.agent('/v1/client/runtime')).status, 200, 'Runtime reads remain available during an action');
    assert.equal((await f.agent('/v1/client/output')).status, 200, 'Output reads remain available during an action');
  } finally { gate.release.resolve(); }
  assert.equal((await pending).status, 200);
  assert.equal((await f.post('/v1/client/output/open')).status, 200);
});

test('an in-flight task submission blocks every new mutation until it settles', { timeout: 10000 }, async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  const entered = deferred(), release = deferred(); f.state.releases.push(release.resolve);
  f.service.submit = async () => { entered.resolve(); await release.promise; return { id: 'fixture-task', status: 'queued' }; };
  const pending = f.post('/v1/tasks', {});
  await entered.promise;
  try {
    for (const [, route] of mutations) expectError(await f.post(route, f.validBody(route)), 409, route);
    expectError(await f.post('/v1/client/shutdown'), 409);
    assert.deepEqual(f.state.calls, []);
  } finally { release.resolve(); }
  assert.equal((await pending).status, 202);
  assert.equal((await f.post('/v1/client/runtime/check')).status, 200);
});

test('shutdown in progress rejects new mutations before any service executes', { timeout: 10000 }, async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  const entered = deferred(), release = deferred(); f.state.releases.push(release.resolve);
  f.state.queueGate = { entered, release };
  const pending = f.post('/v1/client/shutdown');
  await entered.promise;
  try {
    for (const [, route] of mutations) expectError(await f.post(route, f.validBody(route)), 409, route);
    expectError(await f.post('/v1/tasks', {}), 409);
    assert.deepEqual(f.state.calls, []);
    assert.deepEqual(fs.readdirSync(path.join(f.root, 'data/gallery')), []);
  } finally { release.resolve(); }
  assert.equal((await pending).status, 202);
  expectError(await f.post('/v1/client/runtime/check'), 409, 'Accepted shutdown continues blocking actions');
});
