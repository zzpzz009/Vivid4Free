const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { startServer } = require('../server.cjs');
const { createTaskService } = require('../task-service.cjs');
const { openWorkflows } = require('../workflow-store.cjs');
const workflows = openWorkflows();

const tempRoot = path.join(__dirname, '.tmp', 'service');
const running = [];
function freshRoot() {
  fs.mkdirSync(tempRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(tempRoot, 'desktop-'));
  for (const relative of ['diffusion_models/flux-2-klein-9b.safetensors','text_encoders/qwen_3_8b_fp8mixed.safetensors','vae/flux2-vae.safetensors','loras/klein/vivid_klein_v1.4_000076275.safetensors','loras/klein/Klein 一致性增强.safetensors','LLM/Qwen3.5-9B-Q4_K_M.gguf','LLM/mmproj-BF16.gguf',
    'diffusion_models/flux.1-dev-SRPO-bf16.safetensors','text_encoders/SD3/clip_l.safetensors','text_encoders/SD3/t5xxl_fp16.safetensors','vae/ae.safetensors','loras/FLUX/Flux Dev模型4步出图lora_Flux Dev模型4步出图lora_Flux Dev 4-step.safetensors','upscale_models/2xNomosUni_span_multijpg_ldl.pth','SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf','SEEDVR2/ema_vae_fp16.safetensors']) {
    const file = path.join(root, 'runtime/models', relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'test');
  }
  return root;
}
function listen(server, port = 0) { return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server.address().port))); }
function fakeComfy({ promptDelay = 0, queue = { queue_running: [], queue_pending: [] }, history = {}, omitNode = null,
  samplerNames = ['res_2s'], schedulerNames = ['beta'], promptResult = { prompt_id: 'mine' }, cancelResult } = {}) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let data = ''; for await (const chunk of req) data += chunk;
    calls.push({ method: req.method, url: req.url, body: data ? JSON.parse(data) : null });
    const payload = req.url === '/system_stats' ? { system: {} }
      : req.url === '/object_info' ? Object.fromEntries(['render', 'upscale'].flatMap(kind => {
        const graph = workflows.load(kind);
        return [...new Set(Object.values(graph).map(node => node.class_type).filter(Boolean))].filter(type => type !== omitNode).map(type => [type, { input: { required: {} } }]);
      }).concat([['KSampler (Efficient)', { input: { required: { sampler_name: [samplerNames], scheduler: [schedulerNames] } } }]]))
      : req.url === '/prompt' ? await new Promise(resolve => setTimeout(() => resolve(promptResult), promptDelay))
      : req.url === '/api/jobs/mine/cancel' ? (typeof cancelResult === 'function'
        ? await cancelResult() : (cancelResult ?? { cancelled: [...(queue.queue_running || []), ...(queue.queue_pending || [])].some(item => item[1] === 'mine') }))
      : req.url === '/queue' ? queue
      : req.url === '/history/mine' ? (typeof history === 'function' ? await history() : history)
      : req.url.startsWith('/history/') ? {}
      : req.url === '/queue' && req.method === 'POST' ? { deleted: true }
      : {};
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload));
  });
  return { server, calls, start: async (port) => `http://127.0.0.1:${await listen(server, port)}` };
}
function fakeWebSocketClass() {
  const instances = [];
  return { instances, WebSocket: class FakeWebSocket {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor(url) { this.url = String(url); this.readyState = instances.length === 0 ? 0 : 1; this.listeners = new Map(); instances.push(this); }
    addEventListener(name, listener) { const listeners = this.listeners.get(name) || []; listeners.push(listener); this.listeners.set(name, listeners); }
    emit(name, event = {}) { for (const listener of this.listeners.get(name) || []) listener(event); }
    fail() { this.readyState = FakeWebSocket.CLOSED; this.emit('error'); this.emit('close'); }
    sendMessage(data) { this.emit('message', { data: JSON.stringify(data) }); }
    close() { this.readyState = FakeWebSocket.CLOSED; this.emit('close'); }
  } };
}
async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options); return { status: response.status, body: await response.json() };
}

test('render submits source strengths and original nodes, with explicit controls applied only to their inputs', async () => {
  const root = freshRoot(); const service = createTaskService(root, 'http://127.0.0.1:1');
  running.push({ close: service.close });
  const input = { kind: 'render', mainImage: 'main.png', referenceImage: 'reference.png', prompt: 'first user edit', seed: 123 };
  const graph = service.build(input);
  assert.equal(graph['1322'].inputs.value, 1);
  assert.equal(graph['1323'].inputs.value, 0.285403);
  assert.equal(graph['1318'].class_type, 'Power Lora Loader (rgthree)');
  assert.equal(graph['1318'].inputs.lora_1.lora, 'klein\\vivid_klein_v1.4_000076275.safetensors');
  assert.equal(graph['1318'].inputs.lora_1.strength, 1);
  assert.equal(graph['1318'].inputs.lora_2.lora, 'klein\\Klein 一致性增强.safetensors');
  assert.equal(graph['1318'].inputs.lora_2.strength, 0.7);
  assert.deepEqual(graph['9101'].inputs.lora_2, graph['1318'].inputs.lora_2);
  assert.equal(graph['9101'].inputs.lora_1, undefined);
  assert.equal(graph['622'].class_type, 'Image Save');
  assert.equal(graph['622'].inputs.extension, 'jpg');
  assert.deepEqual(graph['1330'].inputs.text_a, ['9210', 3]);
  assert.equal(graph['1329'], undefined);
  assert.equal(graph['9205'].class_type, 'Switch any [Crystools]');
  assert.equal(graph['9205'].inputs.boolean, true);
  assert.equal(graph['536'].inputs.image, input.mainImage);
  assert.equal(graph['605'].inputs.image, input.referenceImage);
  assert.equal(graph['762'].inputs.positive, input.prompt);
  assert.equal(graph['1321'].inputs.noise_seed, 123);
  const changed = service.build({ ...input, mainImage: 'other-main.png', referenceImage: 'other-reference.png', prompt: 'second user edit', referenceStrength: 0.5, colorMatchStrength: 0.4, addScene: false, mirror: true });
  assert.equal(changed['1322'].inputs.value, 0.5);
  assert.equal(changed['1323'].inputs.value, 0.4);
  assert.equal(changed['735'].inputs.boolean, true);
  assert.equal(changed['9205'].inputs.boolean, false);
  assert.equal(changed['536'].inputs.image, 'other-main.png');
  assert.equal(changed['605'].inputs.image, 'other-reference.png');
  assert.equal(changed['762'].inputs.positive, 'second user edit');
  const enabled = service.build({ ...input, addScene: true });
  assert.equal(enabled['9205'].inputs.boolean, true);
  assert.equal(service.build(input)['9205'].inputs.boolean, true);
  assert.equal(changed['9205'].inputs.boolean, false);
  assert.equal(graph['9205'].inputs.boolean, true);
  for (const fresh of [graph, enabled]) {
    assert.equal(fresh['536'].inputs.image, input.mainImage);
    assert.equal(fresh['605'].inputs.image, input.referenceImage);
    assert.equal(fresh['762'].inputs.positive, input.prompt);
    for (const id of ['760', '9200', '9201']) assert.equal(fresh[id].class_type, 'VividLocalCaption');
    assert.deepEqual(fresh['9200'].inputs.image, ['1293', 0]);
    assert.deepEqual(fresh['9201'].inputs.image, ['1293', 0]);
  }
  assert.deepEqual(changed['1294'], graph['1294']);
});
test('render rejects a missing or invalid scene switch anchor with a service error', () => {
  const root = freshRoot();
  for (const corrupt of [graph => { delete graph['9205']; }, graph => { graph['9205'].class_type = 'easy positive'; }, graph => { delete graph['9205'].inputs.boolean; }]) {
    const service = createTaskService(root, 'http://127.0.0.1:1', { workflows: {
      load(kind) { const graph = workflows.load(kind); corrupt(graph); return graph; }
    } });
    running.push({ close: service.close });
    assert.throws(() => service.build({ kind: 'render', mainImage: 'main.png', referenceImage: 'reference.png', addScene: false }),
      error => error.status === 503 && error.message === '渲染工作流配景开关映射无效');
  }
});
afterEach(async () => {
  await Promise.all(running.splice(0).map(async item => { try { await item.close(); } catch {} }));
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('render requires the selected v1.4 and consistency weights without falling back to old LoRAs', async () => {
  const root = freshRoot(); const comfy = fakeComfy();
  const service = createTaskService(root, await comfy.start());
  running.push({ close: service.close }, { close: () => new Promise(resolve => comfy.server.close(resolve)) });
  for (const name of ['vivid_klein_v1.3_000035148.safetensors', 'realistic.safetensors']) {
    fs.writeFileSync(path.join(root, 'runtime/models/loras/klein', name), 'old weight');
  }
  assert.equal((await service.capabilities()).capabilities.render.ready, true);
  for (const name of ['vivid_klein_v1.4_000076275.safetensors', 'Klein 一致性增强.safetensors']) {
    const relative = `loras/klein/${name}`;
    const file = path.join(root, 'runtime/models', relative);
    fs.renameSync(file, `${file}.held`);
    const caps = await service.capabilities();
    assert.equal(caps.capabilities.render.ready, false);
    assert(caps.capabilities.render.missing.includes(relative));
    await assert.rejects(service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' }), { status: 503 });
    fs.renameSync(`${file}.held`, file);
  }
  assert.equal(comfy.calls.some(call => call.url === '/prompt'), false);
});

test('render progress spans both sampler stages and waits for the saved result', async () => {
  const root = freshRoot(); let completed = false;
  const comfy = fakeComfy({ queue: { queue_running: [], queue_pending: [['mine', 'mine']] },
    history: () => completed ? { mine: { status: { completed: true, status_str: 'success' },
      outputs: { '622': { images: [{ filename: 'render.jpg', subfolder: '', type: 'output' }] } } } } : {} });
  const sockets = fakeWebSocketClass();
  const service = createTaskService(root, await comfy.start(), { WebSocket: sockets.WebSocket });
  running.push({ close: service.close }, { close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const task = await service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  const socket = sockets.instances[0];
  const progress = (node, value, max) => socket.sendMessage({ type: 'progress', data: { prompt_id: 'mine', node, value, max } });
  progress('760', 256, 256);
  assert.equal((await service.get(task.id)).progress, 0);
  progress('1294', 1, 1);
  assert.equal((await service.get(task.id)).progress, 25);
  progress('9106', 1, 3);
  assert.equal((await service.get(task.id)).progress, 50);
  progress('9106', 2, 3);
  assert.equal((await service.get(task.id)).progress, 75);
  progress('9106', 3, 3);
  assert.equal((await service.get(task.id)).progress, 99);
  progress('1294', 1, 1);
  assert.equal((await service.get(task.id)).progress, 99);
  completed = true;
  const result = await service.get(task.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.progress, 100);
  progress('9106', 1, 3);
  assert.equal((await service.get(task.id)).progress, 100);
});

test('signed-out, unverified and logged-out sessions cannot reach workspace APIs even with an Agent token', async () => {
  const root = freshRoot(); fs.writeFileSync(path.join(root, 'index.html'), '<html>login shell</html>');
  const comfy = fakeComfy(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  let status = 'signed_out';
  const token = 'f'.repeat(64), server = await startServer({ root, uiDir: root, port: 0, agentPort: 0, agentToken: token,
    comfyUrl: await comfy.start(), accountStatus: () => ({ status }),
    clientControl: { status: () => ({ version: '0.7.0' }), screenshot: () => Buffer.from('login screenshot') } }); running.push(server);
  const auth = { authorization: `Bearer ${token}` };
  const paths = ['/health', '/api/desktop/capabilities', '/api/desktop/tasks', '/api/jobs', '/api/history', '/img/images', '/gallery/private.png', '/view?filename=result.png', '/comfy/queue', '/comfy/object_info'];
  for (status of ['signed_out', 'checking', 'unavailable']) {
    assert.equal((await fetch(server.origin)).status, 200);
    for (const route of paths) assert.equal((await fetch(server.origin + route)).status, 401, `${status}: ${route}`);
    assert.equal((await fetch(server.agentOrigin + '/v1/tasks', { headers: auth })).status, 401);
    assert.equal((await fetch(server.agentOrigin + '/v1/tasks', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' }) })).status, 401);
    assert.equal((await fetch(server.origin + '/api/desktop/tasks', { method: 'POST', headers: { origin: server.origin, 'content-type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await fetch(server.origin + '/upload/image', { method: 'POST', headers: { origin: server.origin } })).status, 401);
    assert.throws(() => server.importGallery([]), /请先登录/);
  }
  assert.equal(comfy.calls.length, 0, 'Locked routes must not contact the engine');
  status = 'signed_in';
  assert.equal((await fetch(server.origin + '/api/desktop/capabilities')).status, 200);
  assert.equal((await fetch(server.agentOrigin + '/v1/tasks', { headers: auth })).status, 200);
  status = 'signed_out';
  assert.equal((await fetch(server.origin + '/api/jobs')).status, 401);
  assert.equal((await fetch(server.agentOrigin + '/v1/client/show-task', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{"taskId":"mine"}' })).status, 401);
  assert.equal((await fetch(server.agentOrigin + '/v1/client', { headers: auth })).status, 200);
});

test('server defaults to a locked account when no account verifier is supplied', async () => {
  const root = freshRoot(); const server = await startServer({ root, uiDir: root, port: 0, agentPort: 0, agentToken: 'e'.repeat(64) }); running.push(server);
  assert.equal((await fetch(server.origin + '/api/desktop/tasks')).status, 401);
  assert.equal((await fetch(server.agentOrigin + '/v1/capabilities', { headers: { authorization: `Bearer ${'e'.repeat(64)}` } })).status, 401);
});

test('Agent auth, origin rejection, unknown version, and strict task image validation', async () => {
  const root = freshRoot(); const comfy = fakeComfy(); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const token = 'a'.repeat(64);
  const server = await startServer({ accountStatus: () => ({ status: 'signed_in' }), root, uiDir: root, port: 0, agentPort: 0, agentToken: token, comfyUrl }); running.push(server);
  assert.equal((await jsonFetch(`${server.agentOrigin}/v1/capabilities`)).status, 401);
  assert.equal((await jsonFetch(`${server.agentOrigin}/v1/capabilities`, { headers: { authorization: 'Bearer wrong' } })).status, 401);
  const auth = { authorization: `Bearer ${token}` };
  assert.equal((await jsonFetch(`${server.agentOrigin}/v2/capabilities`, { headers: auth })).status, 404);
  assert.equal((await jsonFetch(`${server.agentOrigin}/v1/capabilities`, { headers: { ...auth, origin: 'http://evil.example' } })).status, 403);
  const bad = await jsonFetch(`${server.agentOrigin}/v1/tasks`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'render', mainImage: '..\\secret.png', referenceImage: 'ref.png' }) });
  assert.equal(bad.status, 400);
  const rawGraph = await jsonFetch(`${server.agentOrigin}/v1/tasks`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png', graph: {} }) });
  assert.equal(rawGraph.status, 400);
});

test('Agent client controls require auth, expose only fixed operations, and refuse shutdown with queued work', async () => {
  const root = freshRoot(); const queue = { queue_running: [['other', 'other']], queue_pending: [] };
  const comfy = fakeComfy({ queue, history: { mine: { status: { completed: true, status_str: 'success' },
    outputs: { '622': { images: [{ filename: 'result.jpg', subfolder: '', type: 'output' }] } } } } });
  running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const actions = [], png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const server = await startServer({ accountStatus: () => ({ status: 'signed_in' }), root, uiDir: root, port: 0, agentPort: 0, agentToken: 'c'.repeat(64), comfyUrl: await comfy.start(),
    clientControl: { status: () => ({ version: '0.6.0' }), screenshot: () => png,
      showTask: task => actions.push(task.id), shutdown: () => actions.push('shutdown') } }); running.push(server);
  const base = `${server.agentOrigin}/v1/client`, auth = { authorization: `Bearer ${'c'.repeat(64)}` };
  const post = input => ({ method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal((await jsonFetch(base)).status, 401);
  assert.equal((await fetch(`${base}/screenshot`)).status, 401);
  assert.equal((await fetch(`${base}/shutdown`, { method: 'POST' })).status, 401);
  assert.equal((await jsonFetch(base, { headers: { ...auth, origin: 'http://evil.example' } })).status, 403);
  assert.equal((await jsonFetch(base, { headers: auth })).body.version, '0.6.0');
  const screenshot = await fetch(`${base}/screenshot`, { headers: auth });
  assert.equal(screenshot.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await screenshot.arrayBuffer()), png);
  assert.equal((await jsonFetch(`${base}/execute`, post({ code: 'not allowed' }))).status, 404);
  assert.equal((await jsonFetch(`${base}/show-task`, post({ taskId: '../other' }))).status, 400);
  const task = await server.service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  assert.equal((await jsonFetch(`${base}/show-task`, post({ taskId: task.id }))).body.selectedTaskId, task.id);
  assert.deepEqual(actions, [task.id]);
  assert.equal((await jsonFetch(`${base}/shutdown`, post({}))).status, 409);
  assert.equal(actions.includes('shutdown'), false);
  assert.equal((await jsonFetch(`${base}/shutdown`, post({ force: true }))).status, 400);
  queue.queue_running = [];
  assert.equal((await jsonFetch(`${base}/shutdown`, post({}))).status, 202);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(actions.includes('shutdown'), true);
  assert.equal((await jsonFetch(`${server.agentOrigin}/v1/tasks`, post({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' }))).status, 409);
});

test('Agent shutdown refuses an unverifiable engine queue', async () => {
  const root = freshRoot(); const comfy = fakeComfy({ queue: null }); let exited = false;
  running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const server = await startServer({ accountStatus: () => ({ status: 'signed_in' }), root, uiDir: root, port: 0, agentPort: 0, agentToken: 'd'.repeat(64), comfyUrl: await comfy.start(),
    clientControl: { shutdown: () => { exited = true; } } }); running.push(server);
  const result = await jsonFetch(`${server.agentOrigin}/v1/client/shutdown`, { method: 'POST',
    headers: { authorization: `Bearer ${'d'.repeat(64)}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(result.status, 503); assert.equal(exited, false);
});

test('UI mutations require exact same-origin and fixed loopback Host', async () => {
  const root = freshRoot(); const comfy = fakeComfy(); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const server = await startServer({ accountStatus: () => ({ status: 'signed_in' }), root, uiDir: root, port: 0, agentPort: 0, agentToken: 'b'.repeat(64), comfyUrl }); running.push(server);
  const url = `${server.origin}/api/desktop/tasks`;
  const payload = JSON.stringify({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  const noOrigin = await jsonFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
  assert.equal(noOrigin.status, 403);
  const foreignOrigin = await jsonFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.example' }, body: payload });
  assert.equal(foreignOrigin.status, 403);
  const rebindingStatus = await new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'POST', headers: { host: 'attacker.example', origin: server.origin, 'content-type': 'application/json' } }, response => {
      response.resume(); response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject); request.end(payload);
  });
  assert.equal(rebindingStatus, 403);
});

test('parallel identical requestIds coalesce; conflicting payload gets 409', async () => {
  const root = freshRoot(); const comfy = fakeComfy({ promptDelay: 150 }); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const base = { kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png', requestId: 'req_1234567890123456' };
  const one = service.submit(base); const same = service.submit({ ...base });
  const conflict = service.submit({ ...base, prompt: 'different' });
  await assert.rejects(conflict, error => error.status === 409);
  const [a, b] = await Promise.all([one, same]);
  assert.equal(a.id, b.id); assert.equal(comfy.calls.filter(call => call.url === '/prompt').length, 1);
});

test('cancel targets only the client prompt id and never calls global interrupt', async () => {
  const root = freshRoot();
  const comfy = fakeComfy({ queue: { queue_running: [['other', 'foreign-prompt']], queue_pending: [['mine', 'mine']] } });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const task = await service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  assert.equal(task.promptId, 'mine');
  assert.equal((await service.cancel(task.id)).status, 'cancelled');
  assert.equal(comfy.calls.some(call => call.url === '/api/jobs/mine/cancel'), true);
  assert.equal(comfy.calls.some(call => call.url === '/interrupt'), false);
});

test('confirmed cancel wins over an older deferred refresh result without masking ordinary failures', async () => {
  const root = freshRoot();
  let releaseHistory;
  let markHistoryRequested;
  const historyRequested = new Promise(resolve => { markHistoryRequested = resolve; });
  const comfy = fakeComfy({
    queue: { queue_running: [['mine', 'mine']], queue_pending: [] },
    history: () => new Promise(resolve => { releaseHistory = resolve; markHistoryRequested(); }),
    cancelResult: { cancelled: true }
  });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const task = await service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  const staleRefresh = service.get(task.id);
  await historyRequested;
  const cancelled = await service.cancel(task.id);
  assert.equal(cancelled.status, 'cancelled');
  releaseHistory({ mine: { status: { status_str: 'error' }, outputs: {} } });
  assert.equal((await staleRefresh).status, 'cancelled');
  assert.equal((await service.get(task.id)).status, 'cancelled');
  assert.equal(comfy.calls.some(call => call.url === '/api/jobs/mine/cancel'), true);
  assert.equal(comfy.calls.some(call => call.url === '/interrupt'), false);
});

test('confirmed cancel wins when interruption history arrives before the cancel response', async () => {
  const root = freshRoot();
  let releaseCancel;
  let markCancelRequested;
  const cancelRequested = new Promise(resolve => { markCancelRequested = resolve; });
  const comfy = fakeComfy({
    queue: { queue_running: [['mine', 'mine']], queue_pending: [] },
    history: { mine: { status: { status_str: 'error' }, outputs: {} } },
    cancelResult: () => new Promise(resolve => { releaseCancel = resolve; markCancelRequested(); })
  });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const task = await service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  const cancelRequest = service.cancel(task.id);
  await cancelRequested;
  assert.equal((await service.get(task.id)).status, 'failed');
  releaseCancel({ cancelled: true });
  const cancelled = await cancelRequest;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.errorMessage, undefined);
  const refreshed = await service.get(task.id);
  assert.equal(refreshed.status, 'cancelled');
  assert.equal(refreshed.errorMessage, undefined);
  assert.equal(comfy.calls.some(call => call.url === '/api/jobs/mine/cancel'), true);
  assert.equal(comfy.calls.some(call => call.url === '/interrupt'), false);
});

test('history completed without output images is an explicit failed task', async () => {
  const root = freshRoot(); const comfy = fakeComfy({ history: { mine: { status: { completed: true }, outputs: {} } } });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const task = await service.submit({ kind: 'render', mainImage: 'main.png', referenceImage: 'ref.png' });
  const refreshed = await service.get(task.id);
  assert.equal(refreshed.status, 'failed');
  assert.match(refreshed.errorMessage, /没有生成可用图片/);
  assert.equal((await service.cancel(task.id)).status, 'failed');
  assert.equal(comfy.calls.some(call => call.url === '/api/jobs/mine/cancel'), false);
});

test('upscale maps the real API graph controls, submits and cancels through the shared task service', async () => {
  const root = freshRoot(); const comfy = fakeComfy({ queue: { queue_running: [], queue_pending: [['mine', 'mine']] } });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const original = workflows.load('upscale');
  const graph = service.build({ kind: 'upscale', mainImage: 'facade.png', seed: 123456789, size: 6000, denoise: 0.17 });
  assert.equal(graph['48'].inputs.image, 'facade.png');
  assert.equal(graph['127'].inputs.seed, 123456789);
  assert.equal(graph['130'].inputs.noise_seed, 123456789);
  assert.equal(graph['271'].inputs.seed, 123456789);
  assert.equal(graph['278'].inputs.a, 6000);
  assert.equal(graph['96'].inputs.value, 6000);
  assert.equal(graph['274'].inputs.size, 6000);
  assert.equal(graph['279'].inputs.value, original['279'].inputs.value);
  assert.equal(graph['89'].inputs.value, 0.17);
  for (const id of ['127', '130', '271']) assert.equal(graph[id].inputs.seed ?? graph[id].inputs.noise_seed, 123456789);
  const task = await service.submit({ kind: 'upscale', mainImage: 'facade.png', seed: 123456789, size: 6000, denoise: 0.17 });
  assert.equal(task.status, 'queued');
  assert.deepEqual(comfy.calls.find(call => call.url === '/prompt').body.prompt['48'].inputs.image, 'facade.png');
  assert.equal((await service.cancel(task.id)).status, 'cancelled');
  const defaults = service.build({ kind: 'upscale', mainImage: 'default.png' });
  assert.equal(defaults['127'].inputs.seed, original['127'].inputs.seed);
  assert.equal(defaults['130'].inputs.noise_seed, original['130'].inputs.noise_seed);
  assert.equal(defaults['271'].inputs.seed, original['271'].inputs.seed);
  const largeSeed = 179244553332592;
  const largeSeedGraph = service.build({ kind: 'upscale', mainImage: 'large-seed.png', seed: largeSeed });
  assert.equal(largeSeedGraph['127'].inputs.seed, largeSeed);
  assert.equal(largeSeedGraph['130'].inputs.noise_seed, largeSeed);
  assert.equal(largeSeedGraph['271'].inputs.seed, largeSeed % 2 ** 32);
  assert.equal(defaults['96'].inputs.value, 8000);
  assert.equal(defaults['274'].inputs.size, 8000);
});

test('HTTP 200 node_errors cancels only the accepted prompt and reports parameter validation failure', async () => {
  const root = freshRoot();
  const comfy = fakeComfy({
    promptResult: { prompt_id: 'mine', node_errors: { '271': { errors: [{ message: 'do not expose this' }] } } },
    cancelResult: { cancelled: true }
  });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const task = await service.submit({ kind: 'upscale', mainImage: 'facade.png', seed: 179244553332592 });
  assert.equal(task.promptId, 'mine');
  assert.equal(task.status, 'failed');
  assert.match(task.errorMessage, /参数校验失败/);
  assert.doesNotMatch(task.errorMessage, /do not expose this/);
  assert.equal(comfy.calls.some(call => call.url === '/api/jobs/mine/cancel'), true);
  assert.equal(comfy.calls.some(call => call.url === '/interrupt'), false);
});

test('node_errors with an unconfirmed scoped cancel keeps submission_unknown and prompt identity', async () => {
  const root = freshRoot();
  const comfy = fakeComfy({
    promptResult: { prompt_id: 'mine', node_errors: { '271': { errors: ['private detail'] } } },
    cancelResult: { cancelled: false }
  });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const task = await service.submit({ kind: 'upscale', mainImage: 'facade.png' });
  assert.equal(task.promptId, 'mine');
  assert.equal(task.status, 'submission_unknown');
  assert.match(task.errorMessage, /取消状态待确认/);
  assert.doesNotMatch(task.errorMessage, /private detail/);
});

test('upscale readiness rejects missing required model files and unavailable workflow nodes', async () => {
  const root = freshRoot();
  fs.rmSync(path.join(root, 'runtime/models/SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf'));
  const comfy = fakeComfy(); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const caps = await service.capabilities();
  assert.equal(caps.capabilities.upscale.ready, false);
  assert.ok(caps.capabilities.upscale.missing.some(item => item.includes('seedvr2_ema_7b-Q8_K_M.gguf')));
  await assert.rejects(service.submit({ kind: 'upscale', mainImage: 'facade.png' }), error => error.status === 503);
  fs.writeFileSync(path.join(root, 'runtime/models/SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf'), 'test');
  const nodeLess = fakeComfy({ omitNode: 'SeedVR2VideoUpscaler' }); const nodeLessUrl = await nodeLess.start(); running.push({ close: () => new Promise(resolve => nodeLess.server.close(resolve)) });
  const nodeLessService = createTaskService(root, nodeLessUrl); running.push({ close: nodeLessService.close });
  const nodeCaps = await nodeLessService.capabilities();
  assert.equal(nodeCaps.capabilities.upscale.ready, false);
  assert.ok(nodeCaps.capabilities.upscale.missing.includes('SeedVR2VideoUpscaler'));
});

test('runtime model manifest sizes are normalized under models and compared exactly', async () => {
  const root = freshRoot();
  fs.writeFileSync(path.join(root, 'runtime/runtime.json'), JSON.stringify({ files: [
    { path: 'models/SEEDVR2/ema_vae_fp16.safetensors', bytes: 99, sha256: 'a'.repeat(64) }
  ] }));
  const comfy = fakeComfy(); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const caps = await service.capabilities();
  assert.equal(caps.capabilities.upscale.ready, false);
  assert.ok(caps.capabilities.upscale.missing.includes('SEEDVR2/ema_vae_fp16.safetensors'));
});

test('sampler readiness requires exact advertised values', async () => {
  const root = freshRoot(); const comfy = fakeComfy({ samplerNames: ['res_2s_sde'] });
  const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const service = createTaskService(root, comfyUrl); running.push({ close: service.close });
  const caps = await service.capabilities();
  assert.equal(caps.capabilities.upscale.ready, false);
  assert.ok(caps.capabilities.upscale.missing.includes('KSampler (Efficient):res_2s'));
});

test('progress socket reconnects after the engine starts and updates an active task', async () => {
  const root = freshRoot();
  const reservation = http.createServer(); const port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const sockets = fakeWebSocketClass();
  const service = createTaskService(root, `http://127.0.0.1:${port}`, { WebSocket: sockets.WebSocket }); running.push({ close: service.close });
  assert.equal(sockets.instances.length, 1);
  sockets.instances[0].fail();
  const beforeStart = await service.capabilities();
  assert.equal(beforeStart.engine, false);

  const comfy = fakeComfy({ queue: { queue_running: [], queue_pending: [['mine', 'mine']] } });
  const comfyUrl = await comfy.start(port);
  running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  assert.equal(service.comfyUrl, comfyUrl);
  const ready = await service.capabilities();
  assert.equal(ready.engine, true);
  assert.equal(sockets.instances.length, 2);

  const task = await service.submit({ kind: 'upscale', mainImage: 'progress.png' });
  assert.equal(task.status, 'queued');
  assert.equal(sockets.instances.length, 2);
  sockets.instances[1].sendMessage({ type: 'progress', data: { prompt_id: 'mine', value: 37, max: 100 } });
  const refreshed = await service.get(task.id);
  assert.equal(refreshed.progress, 37);
  assert.equal(refreshed.stage, '节点处理进度');
  service.close();
  assert.equal(sockets.instances[1].readyState, sockets.WebSocket.CLOSED);
});
