const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createTaskService, fail } = require('./task-service.cjs');

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.bmp': 'image/bmp' };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const body = async (req) => {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, '仅接受 JSON 请求');
  const chunks = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 1024 * 1024) throw fail(413, '请求过大'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw fail(400, '无效 JSON'); }
};
function file(res, base, name) {
  const resolved = path.resolve(base, name);
  if (!resolved.startsWith(`${path.resolve(base)}${path.sep}`) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw fail(404, '文件不存在');
  res.writeHead(200, { 'Content-Type': mime[path.extname(resolved).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(resolved).pipe(res);
}

async function startServer({ root, uiDir, workflows, runtimeRoot, runtimeStatus, accountStatus, port = 17860, agentPort = 17861, agentToken, comfyUrl, clientControl }) {
  if (!agentToken || agentToken.length < 32) throw new Error('Agent token must be at least 32 characters');
  const service = createTaskService(root, comfyUrl, { workflows, runtimeRoot, runtimeStatus, accountStatus: () => accountStatus?.() });
  let actualPort = port, actualAgentPort = agentPort;
  let origin = `http://127.0.0.1:${actualPort}`;
  let clientShuttingDown = false, activeSubmissions = 0, activeClientActions = 0;
  const requireAccount = () => {
    if (accountStatus?.().status !== 'signed_in') throw fail(401, '请先登录客户端');
  };
  const galleryDir = path.join(root, 'data/gallery');
  fs.mkdirSync(galleryDir, { recursive: true });
  const galleryPath = path.join(root, 'data/gallery.json');
  let gallery = fs.existsSync(galleryPath) ? JSON.parse(fs.readFileSync(galleryPath, 'utf8')) : [];
  const saveGallery = () => {
    fs.writeFileSync(`${galleryPath}.tmp`, JSON.stringify(gallery, null, 2));
    fs.renameSync(`${galleryPath}.tmp`, galleryPath);
  };
  const importGallery = (files) => {
    requireAccount();
    let added = 0;
    for (const source of files) {
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(path.extname(source).toLowerCase()) || !fs.statSync(source).isFile()) continue;
      const data = fs.readFileSync(source);
      const id = crypto.createHash('sha256').update(data).digest('hex');
      if (gallery.some(image => image.id === id)) continue;
      const name = `${id}${path.extname(source).toLowerCase()}`;
      fs.writeFileSync(path.join(galleryDir, name), data);
      gallery.push({ id, name: path.basename(source), filename: name, url: `/gallery/${name}`, path: `/gallery/${name}`, createdAt: new Date().toISOString() });
      added += 1;
    }
    saveGallery(); return { added, total: gallery.length };
  };
  const requireDirectory = directory => {
    if (typeof directory !== 'string' || !directory.trim() || directory.includes('\0') || !path.isAbsolute(directory)) throw fail(400, '需要绝对目录路径');
    return directory;
  };
  const importGalleryDirectory = directory => {
    requireAccount();
    requireDirectory(directory);
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch { throw fail(400, '图库目录不存在或无法读取'); }
    return importGallery(entries.filter(item => item.isFile()).map(item => path.join(directory, item.name)));
  };
  const taskRoutes = async (req, res, url, prefix) => {
    requireAccount();
    if (!url.pathname.startsWith(`${prefix}/`)) throw fail(404, '接口版本不存在');
    const endpoint = url.pathname.slice(prefix.length);
    if (req.method === 'GET' && endpoint === '/capabilities') return json(res, 200, await service.capabilities());
    if (req.method === 'GET' && endpoint === '/tasks') return json(res, 200, { tasks: await service.list() });
    if (req.method === 'POST' && endpoint === '/tasks') {
      if (clientShuttingDown || activeClientActions) throw fail(409, '客户端正在退出或执行控制操作');
      activeSubmissions++;
      try { return json(res, 202, { task: await service.submit(await body(req)) }); }
      finally { activeSubmissions--; }
    }
    const match = endpoint.match(/^\/tasks\/([a-zA-Z0-9-]+)(\/cancel)?$/);
    if (match && req.method === 'GET' && !match[2]) return json(res, 200, { task: await service.get(match[1]) });
    if (match && req.method === 'POST' && match[2]) return json(res, 200, { task: await service.cancel(match[1]) });
    throw fail(404, '接口不存在');
  };
  const app = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== `127.0.0.1:${actualPort}`) throw fail(403, '仅允许本机固定来源');
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) throw fail(403, '请求来源不允许');
      const url = new URL(req.url, origin);
      const uiAsset = ['GET', 'HEAD'].includes(req.method) &&
        (['/', '/index.html', '/THIRD-PARTY-NOTICES.txt'].includes(url.pathname) || url.pathname.startsWith('/assets/'));
      if (!uiAsset) requireAccount();
      if (url.pathname.startsWith('/api/desktop/')) return await taskRoutes(req, res, url, '/api/desktop');
      if (url.pathname === '/health' || url.pathname === '/api/system/status') return json(res, 200, await service.capabilities());
      if (req.method === 'GET' && ['/api/jobs', '/api/history', '/api/history/recent'].includes(url.pathname)) {
        let tasks = await service.list(); const status = url.searchParams.get('status');
        if (status) tasks = tasks.filter(task => task.status === status || status === 'processing' && task.status === 'running');
        return json(res, 200, { success: true, data: { jobs: tasks, total: tasks.length } });
      }
      const job = url.pathname.match(/^\/api\/jobs\/([a-zA-Z0-9-]+)(\/cancel|\/results|\/logs)?$/);
      if (job && req.method === 'GET') {
        const task = await service.get(job[1]);
        return json(res, 200, { success: true, data: job[2] === '/logs' ? [] : task });
      }
      if (job && req.method === 'POST' && job[2] === '/cancel') return json(res, 200, { success: true, data: await service.cancel(job[1]) });
      if (req.method === 'GET' && url.pathname === '/img/images') {
        const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit') || 1000)));
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const images = [...gallery].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        return json(res, 200, { success: true, images: images.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: images.length } });
      }
      if (req.method === 'POST' && url.pathname === '/img/meta') {
        const items = await body(req); const list = Array.isArray(items) ? items : [];
        return json(res, 200, list.map(item => gallery.find(image => image.url === item.url)).filter(Boolean));
      }
      if (req.method === 'POST' && url.pathname === '/img/filter-by-urls') {
        const items = await body(req);
        return json(res, 200, { success: true, images: (Array.isArray(items) ? items : []).filter(item => gallery.some(image => image.url === item.url)) });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/gallery/')) return file(res, galleryDir, decodeURIComponent(url.pathname.slice(9)));
      const comfyPath = url.pathname.startsWith('/comfy/') ? url.pathname.slice(6) : url.pathname;
      const readable = ['/view', '/system_stats', '/queue', '/object_info', '/history'];
      const readAllowed = req.method === 'GET' && readable.some(prefix => comfyPath === prefix || comfyPath.startsWith(`${prefix}/`));
      const uploadAllowed = req.method === 'POST' && comfyPath === '/upload/image';
      if (readAllowed || uploadAllowed) {
        const upstream = await fetch(`${service.comfyUrl}${comfyPath}${url.search}`, {
          method: req.method, headers: uploadAllowed ? { 'Content-Type': req.headers['content-type'] || '' } : {},
          body: uploadAllowed ? req : undefined, duplex: uploadAllowed ? 'half' : undefined,
          signal: AbortSignal.timeout(uploadAllowed ? 60000 : 15000)
        });
        res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
        if (upstream.body) Readable.fromWeb(upstream.body).pipe(res); else res.end();
        return;
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/comfy/')) throw fail(404, '接口未开放');
      if (req.method !== 'GET') throw fail(405, '方法不允许');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'");
      return file(res, uiDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    } catch (error) { if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : '本地服务暂时不可用' }); else res.destroy(); }
  });
  const control = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== `127.0.0.1:${actualAgentPort}` || req.headers.origin) throw fail(403, 'Agent 接口不接受网页来源');
      const expected = Buffer.from(`Bearer ${agentToken}`); const actual = Buffer.from(req.headers.authorization || '');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw fail(401, '需要 Agent 控制令牌');
      const url = new URL(req.url, `http://127.0.0.1:${actualAgentPort}`);
      if (url.pathname.startsWith('/v1/client')) {
        if (!clientControl) throw fail(503, '当前宿主未提供客户端控制');
        if (req.method === 'GET' && url.pathname === '/v1/client') return json(res, 200, await clientControl.status());
        const operations = {
          'GET /v1/client/runtime': ['runtimeStatus'],
          'POST /v1/client/runtime/check': ['checkRuntime'],
          'POST /v1/client/runtime/connect-directory': ['connectRuntimeDirectory', 'directory'],
          'POST /v1/client/account/refresh': ['refreshAccount'],
          'GET /v1/client/output': ['outputInfo'],
          'POST /v1/client/output/open': ['openOutput'],
          'POST /v1/client/gallery/import': [null, 'directory']
        };
        const operation = operations[`${req.method} ${url.pathname}`];
        if (operation) {
          requireAccount();
          const [name, argument] = operation;
          if (name && typeof clientControl[name] !== 'function') throw fail(503, '当前宿主未提供此控制能力');
          if (req.method === 'GET') return json(res, 200, await clientControl[name]());
          const input = await body(req);
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== (argument ? 1 : 0) || (argument && !Object.hasOwn(input, argument))) throw fail(400, argument ? '只接受 directory' : '此操作不接受参数');
          if (argument) requireDirectory(input.directory);
          if (clientShuttingDown || activeSubmissions || activeClientActions) throw fail(409, '客户端正在提交、退出或执行控制操作');
          activeClientActions++;
          try {
            return json(res, 200, name ? await clientControl[name](argument ? input[argument] : undefined) : importGalleryDirectory(input.directory));
          } finally { activeClientActions--; }
        }
        if (req.method === 'GET' && url.pathname === '/v1/client/screenshot') {
          const png = await clientControl.screenshot();
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); return res.end(png);
        }
        if (req.method === 'POST' && url.pathname === '/v1/client/show-task') {
          requireAccount();
          const input = await body(req);
          if (!input || Object.keys(input).length !== 1 || typeof input.taskId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(input.taskId)) throw fail(400, '只接受 taskId');
          const task = await service.get(input.taskId);
          if (task.status !== 'completed' || !task.resultImages?.length) throw fail(409, '任务尚未完成出图');
          await clientControl.showTask(task); return json(res, 200, { selectedTaskId: task.id });
        }
        if (req.method === 'POST' && url.pathname === '/v1/client/shutdown') {
          const input = await body(req);
          if (!input || Array.isArray(input) || Object.keys(input).length) throw fail(400, '退出不接受参数');
          if (clientShuttingDown || activeSubmissions || activeClientActions) throw fail(409, '仍有任务提交、控制操作或退出正在处理');
          clientShuttingDown = true;
          try {
            const tasks = await service.list();
            if (tasks.some(task => !['completed', 'failed', 'cancelled'].includes(task.status))) throw fail(409, '客户端仍有未结束任务');
            let queue;
            try {
              const response = await fetch(`${service.comfyUrl}/queue`, { signal: AbortSignal.timeout(10000) });
              if (!response.ok) throw new Error(); queue = await response.json();
              if (!Array.isArray(queue.queue_running) || !Array.isArray(queue.queue_pending)) throw new Error();
            } catch { throw fail(503, '无法确认引擎队列，未退出客户端'); }
            if (queue.queue_running.length || queue.queue_pending.length) throw fail(409, '引擎队列仍有任务');
            res.once('finish', () => setImmediate(() => clientControl.shutdown()));
            return json(res, 202, { exiting: true });
          } catch (error) { clientShuttingDown = false; throw error; }
        }
        throw fail(404, '客户端控制接口不存在');
      }
      await taskRoutes(req, res, url, '/v1');
    } catch (error) { json(res, error.status || 500, { error: error.status ? error.message : '本地服务暂时不可用' }); }
  });
  const listen = (server, number) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(number, '127.0.0.1', () => resolve(server.address().port));
  });
  try {
    actualPort = await listen(app, port); origin = `http://127.0.0.1:${actualPort}`;
    actualAgentPort = await listen(control, agentPort);
  }
  catch (error) { app.close(); control.close(); service.close(); throw error; }
  return { origin, agentOrigin: `http://127.0.0.1:${actualAgentPort}`, service, importGallery, importGalleryDirectory, close: async () => {
    service.close(); app.closeAllConnections(); control.closeAllConnections();
    await Promise.all([new Promise(resolve => app.close(resolve)), new Promise(resolve => control.close(resolve))]);
  } };
}

module.exports = { startServer };
