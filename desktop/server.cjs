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

async function startServer({ root, uiDir, workflowDir, runtimeRoot, runtimeStatus, port = 17860, agentPort = 17861, agentToken, comfyUrl }) {
  if (!agentToken || agentToken.length < 32) throw new Error('Agent token must be at least 32 characters');
  const service = createTaskService(root, comfyUrl, { workflowDir, runtimeRoot, runtimeStatus });
  let actualPort = port, actualAgentPort = agentPort;
  let origin = `http://127.0.0.1:${actualPort}`;
  const galleryDir = path.join(root, 'data/gallery');
  fs.mkdirSync(galleryDir, { recursive: true });
  const galleryPath = path.join(root, 'data/gallery.json');
  let gallery = fs.existsSync(galleryPath) ? JSON.parse(fs.readFileSync(galleryPath, 'utf8')) : [];
  const saveGallery = () => {
    fs.writeFileSync(`${galleryPath}.tmp`, JSON.stringify(gallery, null, 2));
    fs.renameSync(`${galleryPath}.tmp`, galleryPath);
  };
  const importGallery = (files) => {
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
  const taskRoutes = async (req, res, url, prefix) => {
    if (!url.pathname.startsWith(`${prefix}/`)) throw fail(404, '接口版本不存在');
    const endpoint = url.pathname.slice(prefix.length);
    if (req.method === 'GET' && endpoint === '/capabilities') return json(res, 200, await service.capabilities());
    if (req.method === 'GET' && endpoint === '/tasks') return json(res, 200, { tasks: await service.list() });
    if (req.method === 'POST' && endpoint === '/tasks') return json(res, 202, { task: await service.submit(await body(req)) });
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
      await taskRoutes(req, res, new URL(req.url, `http://127.0.0.1:${actualAgentPort}`), '/v1');
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
  return { origin, agentOrigin: `http://127.0.0.1:${actualAgentPort}`, service, importGallery, close: async () => {
    service.close(); app.closeAllConnections(); control.closeAllConnections();
    await Promise.all([new Promise(resolve => app.close(resolve)), new Promise(resolve => control.close(resolve))]);
  } };
}

module.exports = { startServer };
