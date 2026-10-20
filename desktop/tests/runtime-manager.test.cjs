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
function bundle({ version = '1.0.0', entries } = {}) {
  const files = entries || [['python/python.exe', 'fixture executable'], ['tools/start_comfy.py', 'fixture launcher']];
  const metadata = files.map(([file, content]) => ({ path: file, bytes: Buffer.byteLength(content), sha256: crypto.createHash('sha256').update(content).digest('hex') }));
  const runtime = JSON.stringify({ schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1, platform: 'win32-x64',
    entry: { python: 'python/python.exe', launcher: 'tools/start_comfy.py' }, files: metadata });
  const archive = zip([...files, ['runtime.json', runtime]]);
  return { archive, zipEntries: [...files, ['runtime.json', runtime]], manifest: { schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1, platform: 'win32-x64',
    archive: { url: '/runtime.zip', bytes: archive.length, sha256: crypto.createHash('sha256').update(archive).digest('hex'), unpackedBytes: metadata.reduce((sum, item) => sum + item.bytes, Buffer.byteLength(runtime)) },
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
  return { requests, server, start: () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))) };
}
function makeManager(base, origin, extras = {}) {
  fs.mkdirSync(base, { recursive: true });
  const userData = path.join(base, 'user-data'); const storage = path.join(base, 'external-runtime');
  const feedPath = path.join(base, 'runtime-feed.json'); fs.writeFileSync(feedPath, JSON.stringify({ schemaVersion: 1, manifestUrl: `${origin}/manifest.json` }));
  const manager = new RuntimeManager({ userData, feedPath, env: { VIVID_RUNTIME_ALLOW_LOCAL_TEST: '1' }, ...extras });
  manager.setStorageDirectory(storage); return manager;
}
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
  for (const name of ['../escape.txt', '/absolute.txt', 'folder/secret:stream', 'same.txt']) {
    const entries = name === 'same.txt' ? [['same.txt', 'one'], ['same.txt', 'two']] : [[name, 'bad']];
    const file = path.join(tempRoot, 'bad.zip'); fs.writeFileSync(file, zip(entries)); await assert.rejects(validateZip(file));
  }
  const link = zip([['link', 'target']]);
  const central = link.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); link.writeUInt32LE((0xa1ff << 16) >>> 0, central + 38);
  const linkFile = path.join(tempRoot, 'link.zip'); fs.writeFileSync(linkFile, link); await assert.rejects(validateZip(linkFile), /link or special file/i);
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
