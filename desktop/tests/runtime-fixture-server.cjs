// Local-only, deliberately non-ComfyUI package for Electron download/install UI testing.
// Run with VIVID_RUNTIME_ALLOW_LOCAL_TEST=1 VIVID_TEST_UI_PORT=0 VIVID_TEST_AGENT_PORT=0
// and VIVID_RUNTIME_MANIFEST_URL=http://127.0.0.1:<printed-port>/manifest.json.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '.tmp', 'runtime-electron-fixture');
fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
const pythonExe = process.env.VIVID_TEST_PYTHON || spawnSync('python', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim();
if (!pythonExe || !fs.existsSync(pythonExe)) throw new Error('设置 VIVID_TEST_PYTHON 为本机 Python 可执行文件路径');
const pythonTarget = path.join(root, 'python', 'python.exe'); fs.mkdirSync(path.dirname(pythonTarget), { recursive: true }); fs.copyFileSync(pythonExe, pythonTarget);
const launcher = 'print("R7 test fixture only; no ComfyUI runtime")\nraise SystemExit(2)\n';
const launcherPath = path.join(root, 'tools', 'start_comfy.py'); fs.mkdirSync(path.dirname(launcherPath), { recursive: true }); fs.writeFileSync(launcherPath, launcher);
const filler = Buffer.alloc(8 * 1024 * 1024, 0x52); const fillerPath = path.join(root, 'fixture', 'download-test.bin');
fs.mkdirSync(path.dirname(fillerPath), { recursive: true }); fs.writeFileSync(fillerPath, filler);
const files = ['python/python.exe', 'tools/start_comfy.py', 'fixture/download-test.bin'].map(relative => {
  const content = fs.readFileSync(path.join(root, ...relative.split('/')));
  return { path: relative, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') };
});
const version = '0.0.1-test';
const runtime = JSON.stringify({ schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1, platform: 'win32-x64',
  entry: { python: 'python/python.exe', launcher: 'tools/start_comfy.py' }, files });
fs.writeFileSync(path.join(root, 'runtime.json'), runtime);
const archive = path.join(root, 'runtime.zip');
const py = String.raw`import os, sys, zipfile
root, archive = sys.argv[1:3]
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as z:
    for base, _, names in os.walk(root):
        for name in names:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            with open(full, "rb") as src, z.open(rel, "w", force_zip64=True) as dst:
                while True:
                    block = src.read(1024 * 1024)
                    if not block: break
                    dst.write(block)`;
const zipped = spawnSync('python', ['-c', py, root, archive], { encoding: 'utf8' });
if (zipped.error || zipped.status !== 0) throw new Error(zipped.stderr || zipped.error?.message || 'ZIP64 fixture generation failed');
const archiveStat = fs.statSync(archive);
const archiveHash = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
const manifest = { schemaVersion: 1, id: 'vivid-comfy', version, protocolVersion: 1, platform: 'win32-x64',
  archive: { url: '/runtime.zip', bytes: archiveStat.size, sha256: archiveHash, unpackedBytes: files.reduce((sum, file) => sum + file.bytes, Buffer.byteLength(runtime)) },
  entry: { python: 'python/python.exe', launcher: 'tools/start_comfy.py' }, requiredFiles: files.map(file => file.path) };
const server = http.createServer(async (req, res) => {
  if (req.url === '/manifest.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(manifest)); return; }
  if (req.url !== '/runtime.zip') { res.writeHead(404); res.end(); return; }
  const start = Number((req.headers.range || '').match(/bytes=(\d+)-/)?.[1] || 0);
  const end = archiveStat.size - 1; res.writeHead(start ? 206 : 200, { 'content-type': 'application/zip', 'content-length': end - start + 1,
    ...(start ? { 'content-range': `bytes ${start}-${end}/${archiveStat.size}` } : {}) });
  const input = fs.createReadStream(archive, { start });
  for await (const chunk of input) { if (!res.write(chunk)) await new Promise(resolve => res.once('drain', resolve)); await new Promise(resolve => setTimeout(resolve, 50)); }
  res.end();
});
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/manifest.json`;
  process.stdout.write(JSON.stringify({ url, version, archiveBytes: archiveStat.size, runtimeRoot: root, note: '只验证下载/安装/状态；演示launcher退出码2，不含ComfyUI或模型' }) + '\n');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
