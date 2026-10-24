const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { RuntimeManager, validateZip } = require('../runtime-manager.cjs');
const { createTaskService } = require('../task-service.cjs');

const tempRoot = path.join(__dirname, '.tmp', 'runtime-manager');
const live = [];
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, value] of entries) {
    const nameBuf = Buffer.from(name); const data = Buffer.from(value); const crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0x81a4 << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf); offset += local.length + nameBuf.length + data.length;
  }
  const directory = Buffer.concat(centrals); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function bundle({ version = '1.0.0', entries, compatibleClientVersions } = {}) {
  const files = entries || [['python/python.exe', 'fixture executable'], ['tools/start_comfy.py', 'fixture launcher']];
  const metadata = files.map(([file, content]) => ({ path: file, bytes: Buffer.byteLength(content), sha256: crypto.createHash('sha256').update(content).digest('hex') }));
  const runtime = JSON.stringify({ schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1, platform: 'win32-x64',
    entry: { python: 'python/python.exe', launcher: 'tools/start_comfy.py' }, compatibleClientVersions, files: metadata });
  const archive = zip([...files, ['runtime.json', runtime]]);
  return { archive, zipEntries: [...files, ['runtime.json', runtime]], manifest: { schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1, platform: 'win32-x64',
    compatibleClientVersions, archive: { url: '/runtime.zip', bytes: archive.length, sha256: crypto.createHash('sha256').update(archive).digest('hex'), unpackedBytes: metadata.reduce((sum, item) => sum + item.bytes, Buffer.byteLength(runtime)) },
    entry: { python: 'python/python.exe', launcher: 'tools/start_comfy.py' }, requiredFiles: files.map(([file]) => file) } };
}
function writeActivatedRuntime(root, version) {
  const python = 'fixture executable'; const launcher = 'fixture launcher';
  fs.mkdirSync(path.join(root, 'python'), { recursive: true }); fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(root, 'python', 'python.exe'), python); fs.writeFileSync(path.join(root, 'tools', 'start_comfy.py'), launcher);
  const files = [
    { path: 'python/python.exe', bytes: Buffer.byteLength(python), sha256: crypto.createHash('sha256').update(python).digest('hex') },
    { path: 'tools/start_comfy.py', bytes: Buffer.byteLength(launcher), sha256: crypto.createHash('sha256').update(launcher).digest('hex') }
  ];
  fs.writeFileSync(path.join(root, 'runtime.json'), JSON.stringify({ schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1,
    platform: 'win32-x64', entry: { python: 'python/python.exe', launcher: 'tools/start_comfy.py' }, files }));
}
function forceZip64(pkg, output) {
  const python = String.raw`import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w", compression=zipfile.ZIP_STORED) as z:
    for name, text in eval(sys.argv[2]):
        with z.open(name, "w", force_zip64=True) as out:
            out.write(text.encode("utf-8"))`;
  const entries = JSON.stringify(pkg.zipEntries);
  const result = spawnSync('python', ['-c', python, output, entries], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`Python zipfile ZIP64 fixture failed: ${result.stderr || result.error}`);
  pkg.archive = fs.readFileSync(output); pkg.manifest.archive.bytes = pkg.archive.length;
  pkg.manifest.archive.sha256 = crypto.createHash('sha256').update(pkg.archive).digest('hex'); return pkg;
}
function source(bundleValue, { rangeUnsupported = false, delay = 0, pauseFirst = false } = {}) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    requests.push({ url: req.url, range: req.headers.range || null });
    if (req.url === '/manifest.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(bundleValue.manifest)); return; }
    if (req.url === '/runtime.zip') {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (req.headers.range && !rangeUnsupported) {
        const start = Number(req.headers.range.match(/bytes=(\d+)-/)[1]);
        res.writeHead(206, { 'content-type': 'application/zip', 'content-range': `bytes ${start}-${bundleValue.archive.length - 1}/${bundleValue.archive.length}` });
        res.end(bundleValue.archive.subarray(start)); return;
      }
      if (pauseFirst && !req.headers.range && requests.filter(request => request.url === '/runtime.zip').length === 1) {
        res.writeHead(200, { 'content-type': 'application/zip' }); res.write(bundleValue.archive.subarray(0, 32));
        setTimeout(() => { if (!res.destroyed) res.end(bundleValue.archive.subarray(32)); }, 250); return;
      }
      res.writeHead(200, { 'content-type': 'application/zip' }); res.end(bundleValue.archive); return;
    }
    res.writeHead(404); res.end();
  });
  return { requests, server, start: async () => {
    // Windows may allocate a low ephemeral port blocked by the Fetch standard.
    for (let attempt = 0; attempt < 20; attempt++) {
      const port = crypto.randomInt(20000, 60000);
      try {
        await new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
        });
        return `http://127.0.0.1:${port}`;
      } catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
    }
    throw new Error('No Fetch-compatible fixture port was allocated');
  } };
}
function makeManager(base, origin, extras = {}) {
  fs.mkdirSync(base, { recursive: true });
  const userData = path.join(base, 'user-data'); const storage = path.join(base, 'external-runtime');
  const feedPath = path.join(base, 'runtime-feed.json'); fs.writeFileSync(feedPath, JSON.stringify({ schemaVersion: 1, manifestUrl: `${origin}/manifest.json` }));
  const manager = new RuntimeManager({ userData, feedPath, env: { VIVID_RUNTIME_ALLOW_LOCAL_TEST: '1' }, ...extras });
  manager.setStorageDirectory(storage); return manager;
}
test('runtime manifest and archive requests both use the supplied client network transport', async () => {
  const host = source(bundle()); const origin = await host.start(); live.push(host.server);
  const calls = [];
  const manager = makeManager(tempRoot, origin, { fetchImpl: (url, options) => { calls.push(String(url)); return fetch(url, options); } });
  await manager.check(); await manager.install();
  assert.deepEqual(calls, [`${origin}/manifest.json`, `${origin}/runtime.zip`]);
  assert.equal(manager.status().version, '1.0.0');
});
afterEach(async () => {
  await Promise.all(live.splice(0).map(item => new Promise(resolve => item.close(resolve))));
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('uninstalled client remains usable and reports rendering unavailable', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const manager = new RuntimeManager({ userData: path.join(tempRoot, 'user-data') });
  const status = manager.status(); assert.equal(status.state, 'not_installed'); assert.equal(status.installed, false);
  const service = createTaskService(path.join(tempRoot, 'user-data'), 'http://127.0.0.1:18295', { runtimeRoot: () => null, runtimeStatus: () => ({ installed: false, engineReady: false }) });
  live.push({ close: done => { service.close(); done(); } });
  const caps = await service.capabilities(); assert.equal(caps.capabilities.gallery.ready, true); assert.equal(caps.capabilities.render.ready, false); assert.equal(caps.engine, false);
});

test('HTTP Range unsupported restarts from zero and installs outside userData', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = bundle(); const host = source(pkg, { rangeUnsupported: true }); const origin = await host.start(); live.push(host.server);
  const manager = makeManager(tempRoot, origin); const part = path.join(manager.storageDir, 'downloads', 'vivid-comfy-1.0.0.zip.part');
  fs.mkdirSync(path.dirname(part), { recursive: true }); fs.writeFileSync(part, pkg.archive.subarray(0, 8));
  await manager.check(); await manager.install();
  assert.equal(host.requests.filter(request => request.range).length, 1);
  assert.equal(host.requests.filter(request => !request.range && request.url === '/runtime.zip').length, 1);
  assert.equal(manager.status().installed, true); assert.equal(manager.getRuntimeRoot(), path.join(manager.storageDir, 'versions', 'vivid-comfy-1.0.0'));
  assert.equal(manager.getRuntimeRoot().startsWith(manager.userData), false);
});

test('pause preserves a partial download, resumes with Range, and locks storage selection', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = bundle(); const host = source(pkg, { pauseFirst: true }); const origin = await host.start(); live.push(host.server);
  const manager = makeManager(tempRoot, origin); await manager.check(); const first = manager.install();
  for (let i = 0; i < 100 && manager.status().downloadedBytes === 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(manager.status().state, 'downloading'); assert.throws(() => manager.setStorageDirectory(path.join(tempRoot, 'other')), /不能切换/);
  await manager.pause(); await assert.rejects(first); assert.equal(manager.status().state, 'paused');
  const part = path.join(manager.storageDir, 'downloads', 'vivid-comfy-1.0.0.zip.part'); assert.ok(fs.statSync(part).size > 0);
  await manager.install(); assert.ok(host.requests.some(request => request.range)); assert.equal(manager.status().installed, true);
});

test('Python zipfile force_zip64 fixture installs through .NET ZipArchive', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = forceZip64(bundle(), path.join(tempRoot, 'zip64-fixture.zip'));
  const host = source(pkg); const origin = await host.start(); live.push(host.server); const manager = makeManager(tempRoot, origin);
  await manager.check(); await manager.install(); assert.equal(manager.status().version, '1.0.0');
});

test('bad archive digest preserves the prior activated runtime', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = bundle(); pkg.manifest.archive.sha256 = '0'.repeat(64);
  const host = source(pkg); const origin = await host.start(); live.push(host.server); const manager = makeManager(tempRoot, origin);
  const previous = path.join(manager.storageDir, 'versions', 'vivid-comfy-0.9.0'); writeActivatedRuntime(previous, '0.9.0');
  manager._saveSettings({ ...manager.settings, activePath: previous, activeVersion: '0.9.0' }); manager.refreshInstalled();
  await manager.check(); await assert.rejects(manager.install(), /SHA256/);
  assert.equal(manager.getRuntimeRoot(), previous); assert.equal(manager.status().version, '0.9.0');
});

test('verified archive is reused after activation is deferred without leaving staging debris', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = bundle(); const host = source(pkg); const origin = await host.start(); live.push(host.server);
  let canActivate = false;
  const manager = makeManager(tempRoot, origin, { beforeActivate: async () => { if (!canActivate) throw new Error('引擎仍在运行'); } });
  await manager.check(); await assert.rejects(manager.install(), /引擎仍在运行/);
  assert.equal(fs.readdirSync(path.join(manager.storageDir, 'staging')).length, 0);
  canActivate = true; await manager.install();
  assert.equal(manager.status().installed, true);
  assert.equal(host.requests.filter(request => request.url === '/runtime.zip').length, 1);
  assert.equal(fs.existsSync(path.join(manager.storageDir, 'downloads', 'vivid-comfy-1.0.0.zip')), true);
});

test('ZIP path traversal, absolute path, ADS, duplicate overwrite, and symlink entries are rejected', async () => {
  fs.mkdirSync(tempRoot, { recursive: true });
  for (const name of ['../escape.txt', '/absolute.txt', 'folder/secret:stream', 'folder/CON.txt', 'folder/file. ', 'same.txt']) {
    const entries = name === 'same.txt' ? [['same.txt', 'one'], ['same.txt', 'two']] : [[name, 'bad']];
    const file = path.join(tempRoot, 'bad.zip'); fs.writeFileSync(file, zip(entries)); await assert.rejects(validateZip(file));
  }
  const link = zip([['link', 'target']]);
  const central = link.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); link.writeUInt32LE((0xa1ff << 16) >>> 0, central + 38);
  const linkFile = path.join(tempRoot, 'link.zip'); fs.writeFileSync(linkFile, link); await assert.rejects(validateZip(linkFile), /ZIP/);
});

test('protocol mismatch, disk shortage, and concurrent install fail or coalesce safely', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = bundle(); const host = source(pkg, { delay: 60 }); const origin = await host.start(); live.push(host.server);
  const lowSpace = makeManager(path.join(tempRoot, 'low'), origin, { freeBytes: () => 1 }); await lowSpace.check();
  await assert.rejects(lowSpace.install(), /磁盘空间不足/); assert.equal(host.requests.some(request => request.url === '/runtime.zip'), false);
  const parallel = makeManager(path.join(tempRoot, 'parallel'), origin); await parallel.check();
  const first = parallel.install(); const second = parallel.install(); await Promise.all([first, second]);
  assert.equal(host.requests.filter(request => request.url === '/runtime.zip').length, 1);
  const incompatible = source({ ...pkg, manifest: { ...pkg.manifest, protocolVersion: 9 } }); const badOrigin = await incompatible.start(); live.push(incompatible.server);
  const bad = makeManager(path.join(tempRoot, 'bad-version'), badOrigin); await assert.rejects(bad.check(), /不兼容/);
});

test('restart recognizes a selected external directory and activated version', () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const userData = path.join(tempRoot, 'user-data'); const storage = path.join(tempRoot, 'outside');
  const first = new RuntimeManager({ userData }); first.setStorageDirectory(storage);
  const active = path.join(storage, 'versions', 'vivid-comfy-2.1'); writeActivatedRuntime(active, '2.1');
  first._saveSettings({ ...first.settings, activePath: active, activeVersion: '2.1' });
  const restarted = new RuntimeManager({ userData }); assert.equal(restarted.status().installed, true); assert.equal(restarted.status().version, '2.1'); assert.equal(restarted.getRuntimeRoot(), active);
});

test('storage selection rejects client install and userData paths, including junction aliases', () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const userData = path.join(tempRoot, 'user-data'); const clientInstall = path.join(tempRoot, 'client-install');
  fs.mkdirSync(clientInstall, { recursive: true }); const manager = new RuntimeManager({ userData, forbiddenRoots: [clientInstall] });
  assert.throws(() => manager.setStorageDirectory(clientInstall), /独立位置/);
  assert.throws(() => manager.setStorageDirectory(path.join(userData, 'runtime')), /独立位置/);
  const junction = path.join(tempRoot, 'client-alias');
  try { fs.symlinkSync(clientInstall, junction, 'junction'); }
  catch { return; }
  assert.throws(() => manager.setStorageDirectory(path.join(junction, 'runtime')), /独立位置/);
});

test('offline ZIP installs without a download source and does not copy or remove the source archive', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = bundle();
  const file = path.join(tempRoot, 'offline.zip'); fs.writeFileSync(file, pkg.archive);
  const manager = new RuntimeManager({ userData: path.join(tempRoot, 'user'), feedPath: path.join(tempRoot, 'no-feed.json'), env: {} });
  manager.setStorageDirectory(path.join(tempRoot, 'storage'));
  await manager.importArchive(file);
  assert.equal(manager.status().installed, true); assert.equal(manager.status().downloadConfigured, false);
  await manager.importArchive(file); assert.equal(manager.status().state, 'installed');
  assert.deepEqual(fs.readFileSync(file), pkg.archive);
  assert.deepEqual(fs.readdirSync(path.join(manager.storageDir, 'downloads')), []);
  const restarted = new RuntimeManager({ userData: manager.userData });
  assert.equal(restarted.getRuntimeRoot(), manager.getRuntimeRoot());
});

test('existing official directory is verified and persists independently of the update storage directory', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const root = path.join(tempRoot, 'unpacked'); writeActivatedRuntime(root, '1.0.0');
  fs.mkdirSync(path.join(root, 'output')); fs.writeFileSync(path.join(root, 'output', 'user-image.jpg'), 'keep');
  const manager = new RuntimeManager({ userData: path.join(tempRoot, 'user') });
  await manager.connectDirectory(root);
  assert.equal(manager.getRuntimeRoot(), root);
  const info = JSON.parse(fs.readFileSync(path.join(root, 'runtime.json')));
  assert.equal(manager.status().downloadedBytes, info.files.reduce((sum, item) => sum + item.bytes, 0));
  assert.equal(manager.status().downloadedBytes, manager.status().totalBytes);
  assert.equal(manager.status().availableVersion, null);
  manager.setStorageDirectory(path.join(tempRoot, 'future-updates'));
  const restarted = new RuntimeManager({ userData: manager.userData });
  assert.equal(restarted.getRuntimeRoot(), root); assert.equal(restarted.status().installed, true);
  assert.equal(fs.readFileSync(path.join(root, 'output', 'user-image.jpg'), 'utf8'), 'keep');
});

test('corrupt or linked directory cannot replace the active runtime; ordinary ComfyUI is rejected', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const root = path.join(tempRoot, 'good'); writeActivatedRuntime(root, '1.0.0');
  const manager = new RuntimeManager({ userData: path.join(tempRoot, 'user') }); await manager.connectDirectory(root);
  const bad = path.join(tempRoot, 'bad'); writeActivatedRuntime(bad, '2.0.0');
  fs.writeFileSync(path.join(bad, 'python', 'python.exe'), 'corrupt executable');
  await assert.rejects(manager.connectDirectory(bad), /大小错误|校验失败/); assert.equal(manager.getRuntimeRoot(), root);
  const ordinary = path.join(tempRoot, 'ordinary'); fs.mkdirSync(ordinary);
  await assert.rejects(manager.connectDirectory(ordinary), /普通 ComfyUI/);
  const link = path.join(tempRoot, 'linked'); fs.symlinkSync(root, link, 'junction');
  await assert.rejects(manager.connectDirectory(link), /实体/); assert.equal(manager.getRuntimeRoot(), root);
});

test('offline startup failure restores old settings and engine and retains the users source files', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const root = path.join(tempRoot, 'old'); writeActivatedRuntime(root, '1.0.0');
  let restores = 0;
  const manager = new RuntimeManager({ userData: path.join(tempRoot, 'user'),
    beforeActivate: async ({ previousRoot }) => previousRoot ? async () => { restores++; } : null,
    afterActivate: async ({ version }) => { if (version === '2.0.0') throw new Error('缺少当前工作流节点'); return { ready: true }; } });
  await manager.connectDirectory(root); manager.setStorageDirectory(path.join(tempRoot, 'updates'));
  const oldSettings = fs.readFileSync(manager.settingsPath, 'utf8');
  const file = path.join(tempRoot, 'new.zip'); fs.writeFileSync(file, bundle({ version: '2.0.0' }).archive);
  await assert.rejects(manager.importArchive(file), /缺少当前工作流节点/);
  assert.equal(manager.getRuntimeRoot(), root); assert.equal(restores, 1);
  assert.equal(fs.readFileSync(manager.settingsPath, 'utf8'), oldSettings);
  assert.equal(fs.existsSync(file), true); assert.equal(fs.readdirSync(path.join(manager.storageDir, 'versions')).length, 1);
  manager.afterActivate = async () => ({ ready: true });
  await manager.importArchive(file); assert.equal(manager.status().version, '2.0.0');
});

test('first connection fails closed when engine cannot start and never deletes the selected directory', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const root = path.join(tempRoot, 'new'); writeActivatedRuntime(root, '1.0.0');
  const manager = new RuntimeManager({ userData: path.join(tempRoot, 'user'), afterActivate: async () => ({ ready: false, error: '缺少 GPU 驱动' }) });
  await assert.rejects(manager.connectDirectory(root), /GPU/);
  assert.equal(manager.getRuntimeRoot(), null); assert.equal(manager.status().installed, false);
  assert.equal(fs.existsSync(path.join(root, 'python', 'python.exe')), true);
});

test('same-version check avoids redownloading and failed checks clear stale update offers', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const host = source(bundle()); const origin = await host.start(); live.push(host.server);
  const manager = makeManager(tempRoot, origin); await manager.check(); await manager.install();
  await manager.check(); assert.equal(manager.status().updateAvailable, false);
  await manager.install(); assert.equal(host.requests.filter(request => request.url === '/runtime.zip').length, 1);
  manager.env.VIVID_RUNTIME_MANIFEST_URL = 'file:///not-a-feed';
  await assert.rejects(manager.check(), /HTTPS/);
  assert.equal(manager.available, null); assert.equal(manager.status().availableVersion, null);
  assert.equal(manager.status().installed, true); assert.equal(manager.status().state, 'installed');
});

test('changing update storage retains a managed active version from the original storage', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const host = source(bundle()); const origin = await host.start(); live.push(host.server);
  const manager = makeManager(tempRoot, origin); await manager.check(); await manager.install();
  const root = manager.getRuntimeRoot(); manager.setStorageDirectory(path.join(tempRoot, 'new-storage'));
  assert.equal(manager.getRuntimeRoot(), root);
  assert.equal(new RuntimeManager({ userData: manager.userData }).getRuntimeRoot(), root);
});

function cloudBundle(options = {}) {
  const pkg = bundle({ version: '1.1.0', compatibleClientVersions: ['0.6.0'], ...options });
  pkg.manifest.archive.url = null;
  pkg.manifest.downloads = [
    { provider: 'quark', url: 'https://pan.quark.cn/s/fixture', extractionCode: 'q123' },
    { provider: 'baidu', url: 'https://pan.baidu.com/s/fixture?pwd=b123', extractionCode: 'b123' }
  ];
  return pkg;
}

test('cloud release enables Quark, disables Baidu, and only installs an imported ZIP after whole-archive verification', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = cloudBundle();
  const host = source(pkg); const origin = await host.start(); live.push(host.server);
  let activations = 0;
  const manager = makeManager(tempRoot, origin, { clientVersion: '0.6.0', supportedRuntimeVersions: ['1.0.0'], afterActivate: async () => { activations++; return { ready: true }; } });
  const old = path.join(tempRoot, 'previous'); writeActivatedRuntime(old, '1.0.0'); await manager.connectDirectory(old);
  await manager.check();
  assert.deepEqual(manager.status().downloadSources.map(s => s.provider), ['quark', 'baidu']);
  assert.equal(manager.downloadSource('quark').extractionCode, 'q123');
  assert.deepEqual(manager.status().downloadSources.map(s => s.enabled), [true, false]);
  assert.throws(() => manager.downloadSource('baidu'), /暂未开放/);
  assert.throws(() => manager.downloadSource('https://evil.test'), /尚未配置/);
  assert.equal(manager.status().updateAvailable, true); assert.equal(manager.status().availableCompatible, true);
  assert.deepEqual(manager.status().supportedRuntimeVersions, ['1.0.0', '1.1.0']);
  await assert.rejects(manager.install(), /官方客户端下载 ZIP/);
  assert.equal(host.requests.some(r => r.url === '/runtime.zip'), false);
  const file = path.join(tempRoot, 'downloaded.zip'); const corrupt = Buffer.from(pkg.archive); corrupt[50] ^= 1; fs.writeFileSync(file, corrupt);
  await assert.rejects(manager.importArchive(file), /SHA256/); assert.equal(manager.getRuntimeRoot(), old); assert.equal(activations, 1);
  fs.writeFileSync(file, pkg.archive); await manager.importArchive(file);
  assert.equal(manager.status().version, '1.1.0'); assert.equal(manager.status().runtimeCompatible, true); assert.equal(activations, 2);
  assert.equal(manager.status().updateAvailable, false); assert.deepEqual(fs.readFileSync(file), pkg.archive);
  const restarted = new RuntimeManager({ userData: manager.userData, clientVersion: '0.6.0', supportedRuntimeVersions: ['1.0.0'] });
  assert.equal(restarted.status().runtimeCompatible, true); assert.equal(restarted.status().version, '1.1.0');
});

test('publisher-generated Quark-only release is read and imported by the client without downloading archive bytes', async () => {
  fs.mkdirSync(tempRoot, { recursive: true });
  const script = String.raw`import sys, json
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import package_runtime as package
root = Path(sys.argv[2])
source = root / 'fixture-source'
for name in ('python/python.exe', 'comfyui/main.py', 'custom_nodes/fixture/__init__.py', 'models/fixture.safetensors', 'llama/llama-server.exe'):
    file = source / name
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(b'fixture only; not a working engine')
for name in ('tools/start_comfy.py', 'workflows/preview.json', 'workflows/upscale.json'):
    file = root / name
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(b'fixture only')
package.ROOT = root
result = package.create(source, '1.1.0', None, root / 'release', node_packs=('fixture',), models=('fixture.safetensors',),
                        compatible_clients=['0.6.0'], quark_share_url='https://pan.quark.cn/s/fixture', quark_extraction_code='q123')
(root / 'generated-result.json').write_text(json.dumps(result), encoding='utf-8')`;
  const generated = spawnSync('python', ['-X', 'utf8', '-c', script, path.resolve(__dirname, '../../tools'), tempRoot], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const result = JSON.parse(fs.readFileSync(path.join(tempRoot, 'generated-result.json'), 'utf8'));
  const host = source({ manifest: JSON.parse(fs.readFileSync(result.manifest, 'utf8')) });
  const origin = await host.start(); live.push(host.server);
  let activations = 0;
  const manager = makeManager(path.join(tempRoot, 'client'), origin, { clientVersion: '0.6.0', afterActivate: async () => { activations++; return { ready: true }; } });
  await manager.check();
  assert.deepEqual(manager.status().downloadSources.map(s => s.provider), ['quark']);
  assert.equal(manager.downloadSource('quark').extractionCode, 'q123');
  await assert.rejects(manager.install(), /官方客户端下载 ZIP/);
  await manager.importArchive(result.archive);
  assert.equal(manager.status().state, 'ready'); assert.equal(manager.status().version, '1.1.0');
  assert.equal(manager.status().runtimeCompatible, true); assert.equal(activations, 1);
  assert.deepEqual(host.requests.map(request => request.url), ['/manifest.json']);
  assert.equal(fs.existsSync(result.archive), true);
});

test('front-end upgrade reports required CF update and incompatible imports cannot stop or replace the active engine', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const old = path.join(tempRoot, 'old'); writeActivatedRuntime(old, '1.0.0');
  const original = new RuntimeManager({ userData: path.join(tempRoot, 'user') }); await original.connectDirectory(old);
  let switches = 0;
  const upgraded = new RuntimeManager({ userData: original.userData, clientVersion: '0.7.0', supportedRuntimeVersions: ['2.0.0'], beforeActivate: async () => { switches++; } });
  assert.equal(upgraded.status().clientVersion, '0.7.0'); assert.equal(upgraded.status().runtimeCompatible, false);
  assert.match(upgraded.status().compatibilityMessage, /必须更新引擎.*不保证兼容性和出图可靠性/);
  const incompatible = path.join(tempRoot, 'not-compatible'); writeActivatedRuntime(incompatible, '3.0.0');
  await assert.rejects(upgraded.connectDirectory(incompatible), /未声明兼容/);
  assert.equal(switches, 0); assert.equal(upgraded.getRuntimeRoot(), old);
  const compatible = path.join(tempRoot, 'compatible'); writeActivatedRuntime(compatible, '2.0.0');
  await upgraded.connectDirectory(compatible); assert.equal(upgraded.status().runtimeCompatible, true); assert.equal(switches, 1);
});

test('cloud CF requiring a different front-end is shown but rejected before ZIP inspection and activation', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = cloudBundle({ compatibleClientVersions: ['0.7.0'] });
  const host = source(pkg); const origin = await host.start(); live.push(host.server);
  const manager = makeManager(tempRoot, origin, { clientVersion: '0.6.0', supportedRuntimeVersions: ['1.0.0'] });
  await manager.check(); assert.equal(manager.status().availableCompatible, false);
  assert.match(manager.status().compatibilityMessage, /先更新客户端/);
  const file = path.join(tempRoot, 'new.zip'); fs.writeFileSync(file, pkg.archive);
  await assert.rejects(manager.importArchive(file), /未声明兼容/); assert.equal(manager.status().installed, false);
});

test('cloud links reject lookalike hosts and protocols and clear stale offers', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = cloudBundle(); const host = source(pkg); const origin = await host.start(); live.push(host.server);
  const manager = makeManager(tempRoot, origin); await manager.check();
  for (const url of ['https://pan.quark.cn.evil.test/s/a', 'file:///tmp/a', 'https://user:pass@pan.quark.cn/s/a', 'https://pan.baidu.com/s/a']) {
    pkg.manifest.downloads[0].url = url;
    await assert.rejects(manager.check()); assert.equal(manager.status().downloadSources.length, 0);
  }
  pkg.manifest.downloads[0].url = 'https://pan.quark.cn/s/fixture'; delete pkg.manifest.compatibleClientVersions;
  await assert.rejects(manager.check(), /兼容客户端版本/);
});

test('cloud import rejects a ZIP whose internal version differs from its trusted release metadata', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const pkg = cloudBundle(); pkg.manifest.version = '1.2.0';
  const host = source(pkg); const origin = await host.start(); live.push(host.server); const manager = makeManager(tempRoot, origin);
  const file = path.join(tempRoot, 'wrong-version.zip'); fs.writeFileSync(file, pkg.archive);
  await manager.check(); await assert.rejects(manager.importArchive(file), /不是已检查的 引擎 1.2.0/); assert.equal(manager.status().installed, false);
});

test('managed install rejects redirected working directories and linked partial paths without writing their targets', async () => {
  fs.mkdirSync(tempRoot, { recursive: true }); const host = source(bundle()); const origin = await host.start(); live.push(host.server);
  const protectedRoot = path.join(tempRoot, 'protected'); fs.mkdirSync(protectedRoot);
  const manager = makeManager(path.join(tempRoot, 'linked-directory'), origin); await manager.check();
  fs.symlinkSync(protectedRoot, path.join(manager.storageDir, 'staging'), 'junction');
  await assert.rejects(manager.install(), /链接|重定向/); assert.deepEqual(fs.readdirSync(protectedRoot), []);
  const second = makeManager(path.join(tempRoot, 'linked-file'), origin); await second.check();
  const downloads = path.join(second.storageDir, 'downloads'); fs.mkdirSync(downloads);
  const target = path.join(protectedRoot, 'original'); fs.writeFileSync(target, 'keep');
  fs.symlinkSync(protectedRoot, path.join(downloads, 'vivid-comfy-1.0.0.zip.part'), 'junction');
  await assert.rejects(second.install(), /链接|特殊文件/); assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
});

function publisherPair(root) {
  fs.mkdirSync(root, { recursive: true });
  const script = String.raw`import sys,json
from pathlib import Path
sys.path.insert(0,sys.argv[1])
import package_runtime as p
root=Path(sys.argv[2]); source=root/'source'
for name in ('python/python.exe','comfyui/main.py','comfyui/obsolete.py','custom_nodes/fixture/__init__.py','models/fixture.safetensors','llama/llama-server.exe'):
    file=source/name; file.parent.mkdir(parents=True,exist_ok=True); file.write_bytes(b'fixture only; not an executable')
kwargs=dict(node_packs=('fixture',),models=('fixture.safetensors',),compatible_clients=['0.6.1'],quark_share_url='https://pan.quark.cn/s/fixture')
base=p.create(source,'1.0.0',None,root/'base',**kwargs)
(source/'comfyui/obsolete.py').unlink()
(source/'comfyui/main.py').write_bytes(b'new fixture code')
target=p.create(source,'1.1.0',None,root/'target',base_archive=Path(base['archive']),**kwargs)
print(json.dumps(dict(base=base,target=target)))`;
  const result = spawnSync('python', ['-X', 'utf8', '-c', script, path.resolve(__dirname, '../../tools'), root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const pair = JSON.parse(result.stdout.trim().split('\n').at(-1));
  pair.delta = path.join(path.dirname(pair.target.archive), pair.target.incremental.filename);
  return pair;
}
function offlineManager(root, extras = {}) {
  const feedPath = path.join(root, 'no-feed.json'); fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(feedPath, JSON.stringify({ schemaVersion: 1, manifestUrl: null }));
  const manager = new RuntimeManager({ userData: path.join(root, 'user'), feedPath, env: {}, clientVersion: '0.6.1', ...extras });
  manager.setStorageDirectory(path.join(root, 'engine')); return manager;
}
test('publisher full and incremental ZIPs produce identical independent native installations and omit deleted files', async () => {
  const pair = publisherPair(path.join(tempRoot, 'publisher'));
  const deltaManager = offlineManager(path.join(tempRoot, 'delta'));
  await deltaManager.importArchive(pair.base.archive); const old = deltaManager.getRuntimeRoot();
  fs.writeFileSync(path.join(old, 'user-output.txt'), 'retained user data');
  deltaManager.available = JSON.parse(fs.readFileSync(pair.target.manifest, 'utf8'));
  assert.equal(deltaManager.status().recommendedPackage, 'incremental');
  await deltaManager.importArchive(pair.delta);
  const fullManager = offlineManager(path.join(tempRoot, 'full'));
  fullManager.available = deltaManager.available;
  assert.equal(fullManager.status().recommendedPackage, 'full');
  await fullManager.importArchive(pair.target.archive);
  const next = deltaManager.getRuntimeRoot(), full = fullManager.getRuntimeRoot();
  const raw = fs.readFileSync(path.join(next, 'runtime.json'));
  assert.deepEqual(raw, fs.readFileSync(path.join(full, 'runtime.json')));
  for (const item of JSON.parse(raw).files) assert.deepEqual(fs.readFileSync(path.join(next, item.path)), fs.readFileSync(path.join(full, item.path)));
  assert.equal(fs.existsSync(path.join(next, 'comfyui/obsolete.py')), false);
  assert.equal(fs.existsSync(path.join(old, 'comfyui/obsolete.py')), true);
  assert.equal(fs.existsSync(path.join(next, 'user-output.txt')), false);
  assert.equal(fs.readFileSync(path.join(old, 'user-output.txt'), 'utf8'), 'retained user data');
  await deltaManager.importArchive(pair.delta); assert.equal(deltaManager.getRuntimeRoot(), next);
  fs.writeFileSync(path.join(next, 'models/fixture.safetensors'), 'changed after install');
  assert.equal(fs.readFileSync(path.join(old, 'models/fixture.safetensors'), 'utf8'), 'fixture only; not an executable');
});
test('incremental import rejects missing, altered and mismatched bases without switching the active engine', async () => {
  const pair = publisherPair(path.join(tempRoot, 'publisher'));
  const manager = offlineManager(path.join(tempRoot, 'client'));
  await assert.rejects(manager.importArchive(pair.delta), /仅适用于/);
  await manager.importArchive(pair.base.archive); const old = manager.getRuntimeRoot();
  const original = fs.readFileSync(path.join(old, 'runtime.json'));
  fs.appendFileSync(path.join(old, 'runtime.json'), '\n');
  await assert.rejects(manager.importArchive(pair.delta), /基线.*不符/);
  fs.writeFileSync(path.join(old, 'runtime.json'), original);
  fs.writeFileSync(path.join(old, 'comfyui/main.py'), 'tampered');
  await assert.rejects(manager.importArchive(pair.delta), /文件大小错误|校验失败/);
  assert.equal(manager.getRuntimeRoot(), old); assert.equal(manager.status().version, '1.0.0');
  assert.equal(fs.existsSync(path.join(manager.storageDir, 'versions/vivid-comfy-1.1.0')), false);
});
test('incremental startup failure restores old settings, supports retry and rejects damaged released ZIPs', async () => {
  const pair = publisherPair(path.join(tempRoot, 'publisher'));
  let restores = 0;
  const manager = offlineManager(path.join(tempRoot, 'client'), {
    beforeActivate: async ({ previousRoot }) => previousRoot ? async () => { restores++; } : null,
    afterActivate: async ({ version }) => { if (version === '1.1.0') throw new Error('fixture startup failed'); return { ready: true }; }
  });
  await manager.importArchive(pair.base.archive); const old = manager.getRuntimeRoot();
  manager.available = JSON.parse(fs.readFileSync(pair.target.manifest));
  manager.available.incremental.archive.sha256 = '0'.repeat(64);
  await assert.rejects(manager.importArchive(pair.delta), /SHA256/);
  assert.equal(manager.getRuntimeRoot(), old);
  manager.available = JSON.parse(fs.readFileSync(pair.target.manifest));
  const settings = fs.readFileSync(manager.settingsPath);
  await assert.rejects(manager.importArchive(pair.delta), /fixture startup failed/);
  assert.equal(manager.getRuntimeRoot(), old); assert.equal(restores, 1);
  assert.deepEqual(fs.readFileSync(manager.settingsPath), settings);
  manager.afterActivate = async () => ({ ready: true });
  await manager.importArchive(pair.delta); assert.equal(manager.status().version, '1.1.0');
});
test('offline incremental rejects extra payload, incomplete change declarations and insufficient reconstruction space', async () => {
  const pair = publisherPair(path.join(tempRoot, 'publisher'));
  const manager = offlineManager(path.join(tempRoot, 'client'));
  await manager.importArchive(pair.base.archive); const old = manager.getRuntimeRoot();
  const mutate = (mode) => {
    const output = path.join(tempRoot, `${mode}.zip`);
    const script = String.raw`import sys,json,zipfile
with zipfile.ZipFile(sys.argv[1]) as src:
    entries={n:src.read(n) for n in src.namelist()}
if sys.argv[3]=='extra': entries['unlisted.py']=b'not declared'
else:
    delta=json.loads(entries['delta.json']); delta['files']=[]; entries['delta.json']=json.dumps(delta).encode()
with zipfile.ZipFile(sys.argv[2],'w') as dst:
    for name,data in entries.items(): dst.writestr(name,data)`;
    const result = spawnSync('python', ['-c', script, pair.delta, output, mode], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return output;
  };
  await assert.rejects(manager.importArchive(mutate('extra')), /载荷.*不一致/);
  await assert.rejects(manager.importArchive(mutate('incomplete')), /变更.*不一致/);
  manager.freeBytes = () => 0;
  await assert.rejects(manager.importArchive(pair.delta), /磁盘空间不足/);
  assert.equal(manager.getRuntimeRoot(), old);
  assert.equal(fs.existsSync(path.join(manager.storageDir, 'versions/vivid-comfy-1.1.0')), false);
  assert.deepEqual(fs.readdirSync(path.join(manager.storageDir, 'staging')), []);
});
