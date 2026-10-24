const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { openWorkflows } = require('./workflow-store.cjs');

const terminal = new Set(['completed', 'failed', 'cancelled']);
const fail = (status, message) => Object.assign(new Error(message), { status });
const imageName = (value) => {
  if (typeof value !== 'string' || !value || value.length > 255 || value.includes('..') ||
      /[:/\\\x00-\x1f]/.test(value) || value === '.' || value === '..') {
    throw fail(400, '请选择已上传的本地图片');
  }
  return value.replaceAll('\\', '/');
};

function validate(input) {
  if (!input || !['render', 'upscale'].includes(input.kind)) throw fail(400, '仅支持渲染和放大');
  const allowed = ['kind', 'mainImage', 'referenceImage', 'prompt', 'seed', 'mirror', 'referenceStrength', 'colorMatchStrength', 'addScene', 'size', 'denoise', 'requestId'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw fail(400, '请求包含未开放的参数');
  const data = { ...input, mainImage: imageName(input.mainImage) };
  if (input.kind === 'render') data.referenceImage = imageName(input.referenceImage);
  for (const [key, low, high] of [['referenceStrength', 0, 1], ['colorMatchStrength', 0, 1], ['denoise', 0, 1], ['size', 512, 16000]]) {
    if (input[key] !== undefined && (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < low || input[key] > high)) {
      throw fail(400, `参数 ${key} 超出范围`);
    }
  }
  if (input.seed !== undefined && (!Number.isSafeInteger(input.seed) || input.seed < 0)) throw fail(400, '种子必须是非负安全整数');
  for (const key of ['mirror', 'addScene']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw fail(400, `${key} 必须是布尔值`);
  if (input.prompt !== undefined && (typeof input.prompt !== 'string' || input.prompt.length > 16000)) throw fail(400, '提示词长度超限');
  if (input.requestId !== undefined && (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(input.requestId))) throw fail(400, '无效的 requestId');
  return data;
}

function createTaskService(root, comfyUrl = 'http://127.0.0.1:18295', options = {}) {
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const recordPath = path.join(dataDir, 'tasks.json');
  const jobs = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, 'utf8')) : [];
  const inFlight = new Map();
  const refreshing = new Map();
  const clientId = `vivid-desktop-${randomUUID()}`;
  const activeRuntimeRoot = () => {
    if (typeof options.runtimeRoot === 'function') return options.runtimeRoot();
    return options.runtimeRoot || path.join(root, 'runtime');
  };
  const workflows = options.workflows || openWorkflows(options.workflowBundle);
  const getRuntimeStatus = () => typeof options.runtimeStatus === 'function' ? options.runtimeStatus() : options.runtimeStatus || null;
  const save = () => {
    const temp = `${recordPath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(jobs, null, 2));
    fs.renameSync(temp, recordPath);
  };
  const comfy = async (route, body) => {
    const response = await fetch(`${comfyUrl}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok) throw fail(response.status, result.error?.message || '本地工作流未通过校验，请检查引擎配置');
    return result;
  };
  const modelRequirements = {
    render: ['diffusion_models/flux-2-klein-9b.safetensors', 'text_encoders/qwen_3_8b_fp8mixed.safetensors',
      'vae/flux2-vae.safetensors', 'loras/klein/vivid_klein_v1.4_000076275.safetensors',
      'loras/klein/Klein 一致性增强.safetensors', 'LLM/Qwen3.5-9B-Q4_K_M.gguf', 'LLM/mmproj-BF16.gguf'],
    upscale: ['diffusion_models/flux.1-dev-SRPO-bf16.safetensors', 'text_encoders/SD3/clip_l.safetensors',
      'text_encoders/SD3/t5xxl_fp16.safetensors', 'vae/ae.safetensors',
      'loras/FLUX/Flux Dev模型4步出图lora_Flux Dev模型4步出图lora_Flux Dev 4-step.safetensors',
      'upscale_models/2xNomosUni_span_multijpg_ldl.pth', 'SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf',
      'SEEDVR2/ema_vae_fp16.safetensors']
  };
  const expectedModelBytes = new Map();
  const requiredModels = new Set(Object.values(modelRequirements).flat());
  const modelManifestPath = (value, runtimeManifest) => {
    if (typeof value !== 'string' || !value || value.length > 1024 || /[\x00-\x1f:]/.test(value)) return null;
    let relative = value.replaceAll('\\', '/');
    if (relative.startsWith('/') || /^[a-zA-Z]:/.test(relative)) return null;
    if (runtimeManifest) {
      if (!relative.toLowerCase().startsWith('models/')) return null;
      relative = relative.slice('models/'.length);
    } else if (relative.toLowerCase().startsWith('models/')) {
      relative = relative.slice('models/'.length);
    }
    const parts = relative.split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) return null;
    return requiredModels.has(relative) ? relative : null;
  };
  const nodeTypes = async (kind) => {
    try {
      const graph = workflows.load(kind);
      return [...new Set(Object.values(graph).map(node => node.class_type).filter(Boolean))];
    } catch { return null; }
  };
  const capabilities = async () => {
    const activeRoot = activeRuntimeRoot();
    const modelBytes = new Map(expectedModelBytes);
    if (activeRoot) {
      const collectSizes = (file, entries, pathKey, bytesKey, runtimeManifest = false) => {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          for (const item of entries(data)) {
            const modelPath = modelManifestPath(item?.[pathKey], runtimeManifest);
            if (modelPath && Number.isSafeInteger(item[bytesKey]) && item[bytesKey] > 0) modelBytes.set(modelPath, item[bytesKey]);
          }
        } catch {}
      };
      collectSizes(path.join(activeRoot, 'local-models.json'), data => Array.isArray(data) ? data : [], 'path', 'bytes');
      collectSizes(path.join(activeRoot, 'runtime.json'), data => Array.isArray(data.files) ? data.files : [], 'path', 'bytes', true);
    }
    const modelAvailable = name => {
      if (!activeRoot) return false;
      const file = path.join(activeRoot, 'models', name);
      try {
        const stat = fs.statSync(file);
        const expectedBytes = modelBytes.get(name);
        return stat.isFile() && stat.size > 0 && (expectedBytes === undefined || stat.size === expectedBytes);
      }
      catch { return false; }
    };
    const missing = Object.fromEntries(Object.entries(modelRequirements).map(([kind, names]) =>
      [kind, names.filter(name => !modelAvailable(name))]));
    const kinds = ['render', 'upscale'];
    const missingWorkflow = Object.fromEntries(kinds.map(kind => [kind, !workflows.available(kind)]));
    let engine = false;
    const missingNodes = { render: [], upscale: [] };
    const runtime = getRuntimeStatus();
    try {
      if (activeRoot && (!runtime || runtime.engineReady === true)) {
        const [stats, info] = await Promise.all([comfy('/system_stats'), comfy('/object_info')]);
        engine = Boolean(stats.system);
        if (engine) ensureProgressSocket();
        for (const kind of kinds) {
          const types = await nodeTypes(kind);
          missingNodes[kind] = types ? types.filter(type => !Object.hasOwn(info, type)) : ['工作流缺失或无效'];
        }
        const optionValues = value => Array.isArray(value) && Array.isArray(value[0]) ? value[0] : [];
        const sampler = optionValues(info['KSampler (Efficient)']?.input?.required?.sampler_name);
        const scheduler = optionValues(info['KSampler (Efficient)']?.input?.required?.scheduler);
        if (!sampler.includes('res_2s')) missingNodes.upscale.push('KSampler (Efficient):res_2s');
        if (!scheduler.includes('beta')) missingNodes.upscale.push('KSampler (Efficient):beta');
      }
    } catch {}
    const ready = kind => engine && !missingWorkflow[kind] && missing[kind].length === 0 && missingNodes[kind].length === 0;
    return { version: '1.0', engine, account: 'deferred', billing: 'local-free',
      runtime,
      capabilities: { render: { ready: ready('render'), missing: [...missing.render, ...(missingWorkflow.render ? ['客户端内置渲染资源'] : []), ...missingNodes.render] },
        upscale: { ready: ready('upscale'), missing: [...missing.upscale, ...(missingWorkflow.upscale ? ['客户端内置放大资源'] : []), ...missingNodes.upscale] },
        gallery: { ready: true }, creativeWorkshop: { ready: false } } };
  };
  const build = (input) => {
    const p = validate(input);
    let graph;
    try { graph = workflows.load(p.kind); }
    catch { throw fail(503, '客户端内置资源缺失或损坏，请重新安装客户端'); }
    if (p.kind === 'render') {
      graph['536'].inputs.image = p.mainImage;
      graph['605'].inputs.image = p.referenceImage;
      graph['762'].inputs.positive = p.prompt || '';
      graph['1321'].inputs.noise_seed = p.seed ?? 0;
      graph['735'].inputs.boolean = p.mirror ?? false;
      graph['1322'].inputs.value = p.referenceStrength ?? 1;
      graph['1323'].inputs.value = p.colorMatchStrength ?? .285403;
      if (p.addScene === false) graph['1329'].inputs.positive = '不增加任何场景，不要增加任何配景，如人、车、植物';
    } else {
      const anchors = [['48','LoadImage'], ['127','KSampler (Efficient)'], ['130','InjectLatentNoise+'],
        ['271','SeedVR2VideoUpscaler'], ['277','If ANY execute A else B'], ['278','ImpactCompare'],
        ['279','PrimitiveInt'], ['96','PrimitiveInt'], ['274','JWImageResizeByLongerSide'], ['89','easy float']];
      for (const [id, type] of anchors) if (graph[id]?.class_type !== type) throw fail(503, `放大工作流节点映射无效: ${id}`);
      graph['48'].inputs.image = p.mainImage;
      if (p.seed !== undefined) {
        // One user seed drives all stochastic stages so a task is reproducible as a whole.
        graph['127'].inputs.seed = p.seed;
        graph['130'].inputs.noise_seed = p.seed;
        graph['271'].inputs.seed = p.seed % 2 ** 32;
      }
      if (p.size !== undefined) {
        // Keep the source graph's 5500 upper branch while applying the selected target below it.
        graph['278'].inputs.a = p.size;
        graph['96'].inputs.value = p.size;
        graph['274'].inputs.size = p.size;
      }
      if (p.denoise !== undefined) graph['89'].inputs.value = p.denoise;
    }
    return graph;
  };
  const submit = async (input) => {
    const parameters = validate(input);
    if (parameters.requestId) {
      const prior = jobs.find(j => j.requestId === parameters.requestId);
      if (prior) {
        const stable = value => JSON.stringify(value, Object.keys(value).sort());
        if (stable(prior.parameters) !== stable(parameters)) throw fail(409, '同一 requestId 的参数不可更改');
        return prior;
      }
      if (inFlight.has(parameters.requestId)) {
        const current = inFlight.get(parameters.requestId);
        if (JSON.stringify(current.parameters) !== JSON.stringify(parameters)) throw fail(409, '同一 requestId 的参数不可更改');
        return current.promise;
      }
    }
    const operation = (async () => {
      const graph = build(parameters);
      const caps = await capabilities();
      if (!caps.capabilities[parameters.kind].ready) throw fail(503, '本地工作流依赖尚未完整，请在引擎状态中检查');
      const task = { id: randomUUID(), requestId: parameters.requestId, kind: parameters.kind,
        parameters, status: 'submitting', progress: 0, createdAt: new Date().toISOString(),
        title: parameters.kind === 'render' ? '渲染任务' : '放大任务', workflowId: parameters.kind,
        input: { floorplanImage: { filename: parameters.mainImage, type: 'input' },
          styleImage: parameters.referenceImage ? { filename: parameters.referenceImage, type: 'input' } : null },
        resultImages: [] };
      jobs.unshift(task); save();
      try {
        const result = await comfy('/prompt', { prompt: graph, client_id: clientId,
          extra_data: { vivid_task_id: task.id } });
        if (!result.prompt_id) throw fail(502, '提交状态待确认，请勿重复提交');
        task.promptId = result.prompt_id;
        const nodeErrors = result.node_errors;
        const hasNodeErrors = Array.isArray(nodeErrors) ? nodeErrors.length > 0
          : typeof nodeErrors === 'string' ? nodeErrors.length > 0
            : Boolean(nodeErrors && typeof nodeErrors === 'object' && Object.keys(nodeErrors).length > 0);
        if (hasNodeErrors) {
          try {
            const cancellation = await comfy(`/api/jobs/${encodeURIComponent(task.promptId)}/cancel`, {});
            if (cancellation.cancelled === true) {
              task.status = 'failed';
              task.errorMessage = '本地工作流参数校验失败，已取消本次任务';
              task.completedAt = new Date().toISOString();
            } else {
              task.status = 'submission_unknown';
              task.errorMessage = '本地工作流参数校验失败，任务取消状态待确认';
            }
          } catch {
            task.status = 'submission_unknown';
            task.errorMessage = '本地工作流参数校验失败，任务取消状态待确认';
          }
        } else task.status = 'queued';
      } catch (error) {
        task.status = error.status ? 'failed' : 'submission_unknown';
        task.errorMessage = error.status ? error.message : '提交状态待确认，请勿重复提交';
      }
      save(); return task;
    })();
    if (parameters.requestId) inFlight.set(parameters.requestId, { parameters, promise: operation });
    try { return await operation; } finally { if (parameters.requestId) inFlight.delete(parameters.requestId); }
  };
  const refreshOne = async (task) => {
    if (!task.promptId || terminal.has(task.status)) return task;
    const history = await comfy(`/history/${encodeURIComponent(task.promptId)}`);
    if (terminal.has(task.status)) return task;
    ensureProgressSocket();
    const entry = history[task.promptId];
    if (entry) {
      const images = Object.values(entry.outputs || {}).flatMap(output => output.images || [])
        .filter(image => image.type === 'output');
      if (entry.status?.status_str === 'error') {
        task.status = 'failed'; task.errorMessage = '本地工作流执行失败，请检查引擎日志';
      } else if (entry.status?.completed) {
        if (images.length) {
          task.status = 'completed'; task.progress = 100;
          task.resultImages = images.map(image => `/view?${new URLSearchParams(image)}`);
          task.output = { imageUrl: task.resultImages[0], resultUrls: task.resultImages };
        } else {
          task.status = 'failed'; task.errorMessage = '引擎已完成任务，但没有生成可用图片';
        }
      }
      if (terminal.has(task.status)) task.completedAt = new Date().toISOString();
    } else {
      const queue = await comfy('/queue');
      if (terminal.has(task.status)) return task;
      const has = list => (list || []).some(item => item[1] === task.promptId);
      if (has(queue.queue_running)) task.status = 'running';
      else if (has(queue.queue_pending)) task.status = 'queued';
      else {
        // History and queue can briefly disagree while ComfyUI moves a prompt.
        const retryHistory = await comfy(`/history/${encodeURIComponent(task.promptId)}`);
        if (terminal.has(task.status)) return task;
        if (retryHistory[task.promptId]) return refreshOne(task);
        const retryQueue = await comfy('/queue');
        if (terminal.has(task.status)) return task;
        if (has(retryQueue.queue_running)) task.status = 'running';
        else if (has(retryQueue.queue_pending)) task.status = 'queued';
        else { task.status = 'failed'; task.errorMessage = '引擎中未找到该任务，未自动重新提交'; }
      }
    }
    save(); return task;
  };
  const refresh = (task) => {
    if (refreshing.has(task.id)) return refreshing.get(task.id);
    const operation = refreshOne(task).finally(() => refreshing.delete(task.id));
    refreshing.set(task.id, operation);
    return operation;
  };
  const get = async (id) => {
    const task = jobs.find(item => item.id === id);
    if (!task) throw fail(404, '任务不存在');
    return refresh(task);
  };
  const list = async () => {
    await Promise.all(jobs.filter(j => !terminal.has(j.status)).map(refresh));
    return jobs;
  };
  const cancel = async (id) => {
    const task = jobs.find(item => item.id === id);
    if (!task) throw fail(404, '不能取消不属于客户端的任务');
    if (terminal.has(task.status)) return task;
    if (!task.promptId) throw fail(409, '提交状态尚未确认，不能中断其他任务');
    // This project runtime exposes an atomic prompt-id cancellation endpoint;
    // unlike /interrupt it cannot hit whichever prompt wins a queue race.
    const result = await comfy(`/api/jobs/${encodeURIComponent(task.promptId)}/cancel`, {});
    if (result.cancelled === true) {
      // A confirmed cancellation wins over an interruption error observed while
      // this request was pending, but it cannot replace a completed result.
      if (task.status === 'completed') return task;
      task.status = 'cancelled'; delete task.errorMessage; task.completedAt = new Date().toISOString(); save();
      return task;
    }
    if (terminal.has(task.status)) return task;
    const history = await comfy(`/history/${encodeURIComponent(task.promptId)}`);
    if (terminal.has(task.status)) return task;
    if (history[task.promptId]) return refresh(task);
    throw fail(409, '引擎未确认该任务仍在队列中，未发送中断');
  };
  let socket;
  let closed = false;
  const WebSocketImpl = options.WebSocket || globalThis.WebSocket;
  const progressUrl = new URL('/ws', comfyUrl.replace('http', 'ws'));
  progressUrl.searchParams.set('clientId', clientId);
  const ensureProgressSocket = () => {
    if (closed || typeof WebSocketImpl !== 'function') return;
    const closedState = WebSocketImpl.CLOSED ?? 3;
    if (socket && socket.readyState !== closedState) return;
    try {
      socket = new WebSocketImpl(progressUrl);
      socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'progress') return;
        const task = jobs.find(job => job.promptId === message.data.prompt_id);
        if (task && message.data.max > 0) {
          if (task.kind === 'render') {
            if (terminal.has(task.status)) return;
            const node = String(message.data.node);
            if (!['1294', '9106'].includes(node)) return;
            const fraction = Math.max(0, Math.min(1, message.data.value / message.data.max));
            const combined = node === '1294' ? fraction * 25 : 25 + fraction * 75;
            task.progress = Math.max(task.progress || 0, Math.min(99, Math.round(combined)));
            task.stage = '渲染中';
            return;
          }
          task.progress = Math.round(message.data.value / message.data.max * 100);
          task.stage = '节点处理进度';
        }
      } catch {}
      });
      socket.addEventListener('error', () => {});
    } catch {}
  };
  ensureProgressSocket();
  return { capabilities, build, submit, get, list, cancel, close: () => { closed = true; socket?.close(); }, comfyUrl };
}

module.exports = { createTaskService, validate, fail };
