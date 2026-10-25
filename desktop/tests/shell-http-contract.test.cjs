const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { startServer } = require('../server.cjs');
const contract = require('../../contracts/shell-contract.json');

const tempRoot = path.resolve(__dirname, '.tmp/shell-http-contract');
const token = 'shell-contract-fixture-token-0000000000000000';
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]);
const parameters = { kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png', requestId: 'contract-request-0001' };
const completed = { id: 'complete-1', requestId: parameters.requestId, kind: 'render', parameters,
  status: 'completed', progress: 100, resultImages: ['/view?filename=result.png&type=output'] };
const unknown = { id: 'unknown-1', kind: 'render', status: 'submission_unknown', progress: 0, resultImages: [] };

function route(surface, method, routePath) {
  const entry = contract.http[surface].routes.find(item => item.method === method && item.path === routePath);
  assert.ok(entry, `Missing contract route: ${surface} ${method} ${routePath}`);
  return entry;
}
function aliases(entry) { return [entry.path, ...(entry.aliases || [])]; }
function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}
function request(origin, routePath, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(routePath, origin), { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, bytes,
          json: () => JSON.parse(bytes.toString('utf8')) });
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Fixture HTTP request timed out')));
    req.once('error', reject);
    req.end(body);
  });
}
function expectError(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers['content-type'], contract.http.json.contentType);
  assert.equal(response.headers['cache-control'], contract.http.json.cacheControl);
  assert.deepEqual(Object.keys(response.json()), ['error']);
  assert.equal(typeof response.json().error, 'string');
}
async function fixture(t, { tasks = [] } = {}) {
  fs.mkdirSync(tempRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(tempRoot, 'case-'));
  let server, upstream;
  t.after(async () => {
    try { await server?.close(); }
    finally {
      if (upstream?.listening) {
        upstream.closeAllConnections();
        await new Promise(resolve => upstream.close(resolve));
      }
      assert.ok(root.startsWith(`${tempRoot}${path.sep}`), 'Only remove the isolated fixture');
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'ui/assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/tasks.json'), JSON.stringify(tasks));
  fs.writeFileSync(path.join(root, 'ui/index.html'), '<html>contract fixture</html>');
  fs.writeFileSync(path.join(root, 'ui/THIRD-PARTY-NOTICES.txt'), 'fixture notice');
  fs.writeFileSync(path.join(root, 'ui/assets/app.js'), '/* fixture */');
  fs.writeFileSync(path.join(root, 'ui/private.txt'), 'signed-in static file');
  const state = { account: 'signed_out', queue: { queue_running: [], queue_pending: [] }, calls: [], actions: [] };
  upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    state.calls.push({ method: req.method, url: req.url, headers: req.headers, bytes: Buffer.concat(chunks) });
    const url = new URL(req.url, 'http://fixture.invalid');
    if (url.pathname === '/view') {
      res.writeHead(206, { 'Content-Type': 'image/png', 'X-Fixture-Upstream': 'not-forwarded' }); return res.end(png);
    }
    const value = url.pathname === '/queue' ? state.queue
      : url.pathname === '/upload/image' ? { name: 'uploaded.png', subfolder: '', type: 'input' }
      : url.pathname === '/api/jobs/fixture-prompt/cancel' ? { cancelled: true } : {};
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value));
  });
  const comfyUrl = await listen(upstream);
  // Explicit fake workflows and a null runtime prevent private resources/model probes.
  // Signed-out construction also prevents the task service opening a progress socket.
  server = await startServer({ root, uiDir: path.join(root, 'ui'), port: 0, agentPort: 0,
    agentToken: token, comfyUrl, runtimeRoot: () => null, accountStatus: () => ({ status: state.account }),
    workflows: { available: () => false, load: () => { throw new Error('No fixture workflow'); } },
    clientControl: { status: () => ({ version: 'fixture', window: { available: true, visible: true } }),
      screenshot: () => png, showTask: task => state.actions.push(task.id), shutdown: () => state.actions.push('shutdown') } });
  const auth = { authorization: `Bearer ${token}` };
  return { ...server, root, state, auth,
    ui: (url, options) => request(server.origin, url, options),
    agent: (url, options = {}) => request(server.agentOrigin, url, { ...options, headers: { ...auth, ...options.headers } }),
    uiPost: body => ({ method: 'POST', headers: { origin: server.origin, 'content-type': 'application/json' }, body }),
    agentPost: body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body }) };
}

test('UI HTTP gates use the actual Host and exact write Origin before checking the account', async t => {
  const f = await fixture(t);
  const publicPaths = aliases(route('ui', 'GET', '/')).map(value => value.replace('/assets/*', '/assets/app.js'));
  for (const url of publicPaths) assert.equal((await f.ui(url)).status, 200, url);
  expectError(await f.ui('/', { headers: { host: `localhost:${new URL(f.origin).port}` } }), 403);
  const taskPath = route('ui', 'GET', '/api/desktop/tasks').path;
  for (const account of ['signed_out', 'checking', 'unavailable']) {
    f.state.account = account;
    expectError(await f.ui(taskPath), 401);
    expectError(await f.ui('/private.txt'), 401);
    expectError(await f.ui(taskPath, { method: 'POST', body: '{}' }), 403);
    expectError(await f.ui(taskPath, f.uiPost('{}')), 401);
  }
  f.state.account = 'signed_in';
  for (const origin of ['null', 'http://evil.invalid', f.agentOrigin, `${f.origin}/`]) {
    expectError(await f.ui('/img/meta', { ...f.uiPost('[]'), headers: { origin, 'content-type': 'application/json' } }), 403);
  }
  assert.equal((await f.ui('/img/meta', f.uiPost('[]'))).status, 200);
  assert.equal((await f.ui(taskPath, { headers: { origin: 'http://evil.invalid' } })).status, 200, 'GET Origin is not checked');
  assert.equal((await f.ui('/private.txt')).bytes.toString(), 'signed-in static file');
  assert.equal(f.state.calls.length, 0, 'Authentication/static requests do not reach the upstream');
});

test('Agent HTTP enforces Host, Origin, Bearer then route-specific account access', async t => {
  const f = await fixture(t);
  const taskPath = route('agent', 'GET', '/v1/tasks').path;
  expectError(await request(f.agentOrigin, taskPath), 401);
  for (const authorization of ['Bearer wrong', `bearer ${token}`, `Bearer ${'z'.repeat(token.length)}`]) {
    expectError(await f.agent(taskPath, { headers: { authorization } }), 401);
  }
  expectError(await f.agent(taskPath, { headers: { host: new URL(f.origin).host, authorization: '' } }), 403);
  for (const origin of [f.origin, 'null', 'http://evil.invalid']) {
    expectError(await f.agent(taskPath, { headers: { origin, authorization: '' } }), 403);
  }
  for (const account of ['signed_out', 'checking', 'unavailable']) {
    f.state.account = account;
    expectError(await f.agent(taskPath), 401);
    expectError(await f.agent('/v1/client/show-task', f.agentPost('{"taskId":"complete-1"}')), 401);
    assert.equal((await f.agent(route('agent', 'GET', '/v1/client').path)).status, 200);
  }
  f.state.account = 'signed_in';
  assert.deepEqual((await f.agent(taskPath, { headers: { origin: '' } })).json(), { tasks: [] });
  expectError(await f.agent('/v2/tasks'), 404);
  expectError(await f.agent('/view?filename=result.png'), 404, 'Agent does not serve UI resources');
  assert.equal(f.state.calls.length, 0);
});

test('declared HTTP aliases preserve envelopes, ANY health behavior and static HEAD exceptions', async t => {
  const f = await fixture(t, { tasks: [completed, unknown] }); f.state.account = 'signed_in';
  for (const url of aliases(route('ui', 'GET', '/api/jobs'))) {
    const response = await f.ui(`${url}?page=9&limit=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.json(), { success: true, data: { jobs: [completed, unknown], total: 2 } });
  }
  for (const url of aliases(route('ui', 'GET', '/api/jobs/{id}'))) {
    assert.deepEqual((await f.ui(url.replace('{id}', unknown.id))).json(), { success: true, data: unknown });
  }
  assert.deepEqual((await f.ui('/api/jobs/complete-1/logs')).json(), { success: true, data: [] });
  assert.equal(f.state.calls.length, 0, 'GET cancel alias does not cancel or contact the engine');
  for (const url of aliases(route('ui', 'ANY', '/health'))) {
    for (const method of ['GET', 'POST']) {
      const response = await f.ui(url, { method, headers: { origin: f.origin } });
      assert.equal(response.status, 200); assert.equal(response.json().version, '1.0');
    }
    const head = await f.ui(url, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.bytes.length, 0);
  }
  f.state.account = 'signed_out';
  assert.equal((await f.ui('/', { method: 'HEAD' })).status, 405);
  assert.equal((await f.ui('/health', { method: 'HEAD' })).status, 401);
});

test('task replay retains 202 and the original record while changed parameters conflict', async t => {
  const f = await fixture(t, { tasks: [completed] }); f.state.account = 'signed_in';
  for (const [send, url, options] of [
    [f.ui, route('ui', 'POST', '/api/desktop/tasks').path, f.uiPost],
    [f.agent, route('agent', 'POST', '/v1/tasks').path, f.agentPost]
  ]) {
    const replay = await send(url, options(JSON.stringify(parameters)));
    assert.equal(replay.status, 202); assert.deepEqual(replay.json(), { task: completed });
    expectError(await send(url, options(JSON.stringify({ ...parameters, seed: 1 }))), 409);
  }
  assert.equal(f.state.calls.length, 0, 'Idempotent replay never resubmits a prompt');
});

test('task cancellation ignores body, targets only the recorded prompt and is terminal-idempotent', async t => {
  const active = { ...unknown, id: 'active-1', status: 'queued', promptId: 'fixture-prompt' };
  const f = await fixture(t, { tasks: [active, unknown] }); f.state.account = 'signed_in';
  expectError(await f.agent('/v1/tasks/unknown-1/cancel', { method: 'POST' }), 409);
  expectError(await f.ui('/api/desktop/tasks/missing/cancel', f.uiPost('')), 404);
  const cancelled = await f.ui('/api/desktop/tasks/active-1/cancel', { method: 'POST', headers: { origin: f.origin }, body: 'not JSON' });
  assert.equal(cancelled.status, 200); assert.equal(cancelled.json().task.status, 'cancelled');
  assert.deepEqual(f.state.calls.map(call => [call.method, call.url, call.bytes.toString()]), [['POST', '/api/jobs/fixture-prompt/cancel', '{}']]);
  const second = await f.agent('/v1/tasks/active-1/cancel', { method: 'POST' });
  assert.deepEqual(second.json(), cancelled.json());
  const legacy = await f.ui('/api/jobs/active-1/cancel', f.uiPost('ignored'));
  assert.deepEqual(legacy.json(), { success: true, data: cancelled.json().task });
  assert.equal(f.state.calls.length, 1, 'Repeated cancellation never sends a global interrupt or another cancel');
});

test('JSON parsing, size and unopened-route errors retain status and the public error envelope', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  expectError(await f.ui('/img/meta', { method: 'POST', headers: { origin: f.origin, 'content-type': 'text/plain' }, body: '[]' }), 415);
  expectError(await f.ui('/img/meta', f.uiPost('{')), 400);
  expectError(await f.ui('/img/meta', f.uiPost(' '.repeat(contract.http.json.requestLimitBytes + 1))), 413);
  assert.deepEqual((await f.ui('/img/meta', f.uiPost(''))).json(), []);
  expectError(await f.agent('/v1/tasks', f.agentPost('{')), 400);
  expectError(await f.agent('/v1/tasks', f.agentPost('{"kind":"render","mainImage":"../private.png"}')), 400);
  expectError(await f.ui('/api/generate', f.uiPost('{}')), 404);
  expectError(await f.ui('/comfy/prompt', f.uiPost('{}')), 404);
  expectError(await f.ui('/private.txt', f.uiPost('{}')), 405);
  expectError(await f.agent('/v1/client/execute', f.agentPost('{}')), 404);
  // Invalid percent encoding throws internally and must not expose the native exception.
  const unexpected = await f.ui('/gallery/%ZZ');
  expectError(unexpected, 500);
  assert.equal(unexpected.json().error, '本地服务暂时不可用');
});

test('binary responses and both multipart upload aliases preserve upstream bytes and query strings', async t => {
  const f = await fixture(t); f.state.account = 'signed_in';
  const view = route('ui', 'GET', '/view');
  for (const url of aliases(view)) {
    const response = await f.ui(`${url}?filename=a%20b.png&type=output`);
    assert.equal(response.status, 206); assert.equal(response.headers['content-type'], 'image/png');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-fixture-upstream'], undefined); assert.deepEqual(response.bytes, png);
    assert.equal(f.state.calls.at(-1).url, '/view?filename=a%20b.png&type=output');
  }
  const contentType = 'multipart/form-data; boundary=fixture-boundary';
  const multipart = Buffer.concat([Buffer.from('--fixture-boundary\r\nContent-Disposition: form-data; name="image"; filename="input.png"\r\nContent-Type: image/png\r\n\r\n'),
    png, Buffer.from('\r\n--fixture-boundary\r\nContent-Disposition: form-data; name="type"\r\n\r\ninput\r\n--fixture-boundary\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--fixture-boundary--\r\n')]);
  for (const url of aliases(route('ui', 'POST', '/upload/image'))) {
    const response = await f.ui(`${url}?fixture=1`, { method: 'POST', headers: { origin: f.origin, 'content-type': contentType }, body: multipart });
    assert.equal(response.status, 200); assert.deepEqual(response.json(), { name: 'uploaded.png', subfolder: '', type: 'input' });
    const forwarded = f.state.calls.at(-1);
    assert.equal(forwarded.url, '/upload/image?fixture=1'); assert.equal(forwarded.headers['content-type'], contentType);
    assert.deepEqual(forwarded.bytes, multipart);
  }
  f.state.account = 'signed_out';
  const screenshot = await f.agent(route('agent', 'GET', '/v1/client/screenshot').path);
  assert.equal(screenshot.status, 200); assert.equal(screenshot.headers['content-type'], 'image/png');
  assert.equal(screenshot.headers['cache-control'], 'no-store'); assert.deepEqual(screenshot.bytes, png);
});

test('Agent show-task delivers the recorded completed payload without acknowledging UI rendering', async t => {
  const f = await fixture(t, { tasks: [completed, unknown] }); f.state.account = 'signed_in';
  const url = route('agent', 'POST', '/v1/client/show-task').path;
  expectError(await f.agent(url, f.agentPost('{"taskId":"complete-1","extra":true}')), 400);
  expectError(await f.agent(url, f.agentPost('{"taskId":"unknown-1"}')), 409);
  const response = await f.agent(url, f.agentPost('{"taskId":"complete-1"}'));
  assert.equal(response.status, 200); assert.deepEqual(response.json(), { selectedTaskId: 'complete-1' });
  assert.deepEqual(f.state.actions, ['complete-1']);
});

test('Agent shutdown preserves the documented primitive-body exception and strict queue gate', async t => {
  const url = route('agent', 'POST', '/v1/client/shutdown').path;
  for (const value of [{}, true, 1]) {
    await t.test(`accepted body ${JSON.stringify(value)}`, async child => {
      const f = await fixture(child);
      for (const invalid of [null, false, 0, '', 'text', [], { force: true }]) {
        expectError(await f.agent(url, f.agentPost(JSON.stringify(invalid))), 400);
      }
      f.state.queue = {};
      expectError(await f.agent(url, f.agentPost(JSON.stringify(value))), 503);
      f.state.queue = { queue_running: [['foreign', 'foreign']], queue_pending: [] };
      expectError(await f.agent(url, f.agentPost(JSON.stringify(value))), 409);
      assert.deepEqual(f.state.actions, []);
      f.state.queue = { queue_running: [], queue_pending: [] };
      const response = await f.agent(url, f.agentPost(JSON.stringify(value)));
      assert.equal(response.status, 202); assert.deepEqual(response.json(), { exiting: true });
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(f.state.actions, ['shutdown']);
      f.state.account = 'signed_in';
      expectError(await f.agent('/v1/tasks', f.agentPost(JSON.stringify(parameters))), 409);
    });
  }
});
