const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { startServer } = require('../server.cjs');
const { createTaskService } = require('../task-service.cjs');

const tempRoot = path.join(__dirname, '.tmp', 'service');
const running = [];
function freshRoot() {
  fs.mkdirSync(tempRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(tempRoot, 'desktop-'));
  fs.mkdirSync(path.join(root, 'workflows'), { recursive: true });
  for (const name of ['preview.json', 'upscale.json']) fs.copyFileSync(path.join(__dirname, '..', '..', 'workflows', name), path.join(root, 'workflows', name));
  for (const relative of ['diffusion_models/flux-2-klein-9b.safetensors','text_encoders/qwen_3_8b_fp8mixed.safetensors','vae/flux2-vae.safetensors','loras/klein/vivid_klein_v1.4_000076275.safetensors','loras/klein/realistic.safetensors','LLM/Qwen3.5-9B-Q4_K_M.gguf','LLM/mmproj-BF16.gguf',
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
      : req.url === '/object_info' ? Object.fromEntries(['preview.json', 'upscale.json'].flatMap(name => {
        const graph = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'workflows', name), 'utf8'));
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
afterEach(async () => {
  await Promise.all(running.splice(0).map(async item => { try { await item.close(); } catch {} }));
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('Agent auth, origin rejection, unknown version, and strict task image validation', async () => {
  const root = freshRoot(); const comfy = fakeComfy(); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const token = 'a'.repeat(64);
  const server = await startServer({ root, uiDir: root, port: 0, agentPort: 0, agentToken: token, comfyUrl }); running.push(server);
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

test('UI mutations require exact same-origin and fixed loopback Host', async () => {
  const root = freshRoot(); const comfy = fakeComfy(); const comfyUrl = await comfy.start(); running.push({ close: () => new Promise(resolve => comfy.server.close(resolve)) });
  const server = await startServer({ root, uiDir: root, port: 0, agentPort: 0, agentToken: 'b'.repeat(64), comfyUrl }); running.push(server);
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
  const original = JSON.parse(fs.readFileSync(path.join(root, 'workflows', 'upscale.json'), 'utf8'));
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
