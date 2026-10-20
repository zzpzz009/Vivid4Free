const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Transform, Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { EventEmitter } = require('node:events');

const PROTOCOL = 1;
const ID = 'vivid-comfy';
const VERSION = /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/;
const SHA = /^[a-f0-9]{64}$/i;
const safeRelative = value => {
  if (typeof value !== 'string' || !value || value.length > 32767 || value.includes('\\') || value.includes(':') || /[\x00-\x1f]/.test(value)) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  const parts = value.replace(/\/$/, '').split('/');
  return parts.length > 0 && parts.length <= 256 && parts.every(part => part && part !== '.' && part !== '..');
};
function canonicalPath(value) {
  let current = path.resolve(value); const suffix = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current); if (parent === current) break;
    suffix.unshift(path.basename(current)); current = parent;
  }
  const base = fs.existsSync(current) ? fs.realpathSync.native(current) : current;
  return path.resolve(base, ...suffix);
}
function sameOrInside(target, root) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validateManifest(m) {
  if (!m || m.schemaVersion !== 1 || m.id !== ID || m.protocolVersion !== PROTOCOL || m.platform !== 'win32-x64' ||
      typeof m.version !== 'string' || !VERSION.test(m.version) || m.version.endsWith('.') || !m.archive || !m.entry || !Array.isArray(m.requiredFiles)) {
    throw new Error('运行包清单字段或协议版本不兼容');
  }
  const a = m.archive;
  if (typeof a.url !== 'string' || !Number.isSafeInteger(a.bytes) || a.bytes <= 0 || !Number.isSafeInteger(a.unpackedBytes) || a.unpackedBytes <= 0 || !SHA.test(a.sha256)) {
    throw new Error('运行包清单中的归档信息无效');
  }
  if (m.entry.python !== 'python/python.exe' || m.entry.launcher !== 'tools/start_comfy.py') throw new Error('运行包入口与客户端协议不兼容');
  if (!m.requiredFiles.length || m.requiredFiles.length > 10000 || m.requiredFiles.some(file => !safeRelative(file)) || new Set(m.requiredFiles.map(v => v.toLowerCase())).size !== m.requiredFiles.length) {
    throw new Error('运行包必需文件清单无效');
  }
  return m;
}

function runZipScript(archive, destination, maxBytes, validateOnly = false) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, 'extract-runtime.ps1');
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Archive', archive, '-MaxUnpackedBytes', String(maxBytes)];
    if (validateOnly) args.push('-ValidateOnly'); else args.push('-Destination', destination);
    // Windows PowerShell 5.1 ships with Windows and provides the .NET ZipArchive API used here.
    const child = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(output.slice(-1200) || `ZIP安全校验/解压失败 (${code})`)));
  });
}
function validateZip(file, maxBytes = Number.MAX_SAFE_INTEGER) { return runZipScript(file, null, maxBytes, true); }
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256'); const input = fs.createReadStream(file);
    input.on('data', chunk => hash.update(chunk)); input.once('error', reject); input.once('end', () => resolve(hash.digest('hex')));
  });
}

class RuntimeManager extends EventEmitter {
  constructor({ userData, feedPath = path.join(__dirname, 'runtime-feed.json'), env = process.env, freeBytes, extract, forbiddenRoots = [], beforeActivate, afterActivate } = {}) {
    super();
    this.userData = path.resolve(userData || path.join(os.tmpdir(), 'vivid-runtime-test-userdata'));
    this.forbiddenRoots = [this.userData, ...forbiddenRoots].filter(Boolean).map(root => path.resolve(root));
    this.feedPath = feedPath; this.env = env; this.freeBytes = freeBytes || (() => {
      const stats = fs.statfsSync(this.storageDir || this.userData);
      return stats.bavail * stats.bsize;
    });
    this.extract = extract || null;
    this.beforeActivate = beforeActivate; this.afterActivate = afterActivate;
    this.settingsPath = path.join(this.userData, 'runtime-settings.json');
    this.settings = this._readSettings(); this.available = null; this.installPromise = null; this.checkPromise = null; this.controller = null;
    this.activeRoot = null; this.activeInfo = null;
    this.data = { state: 'not_installed', installed: false, available: false, version: null, availableVersion: null,
      storageDir: this.storageDir, downloadedBytes: 0, totalBytes: 0, progress: 0, message: '运行包尚未安装', error: null };
    this.refreshInstalled();
  }
  _readSettings() { try { return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8')); } catch { return {}; } }
  get storageDir() { return this.settings.storageDir ? path.resolve(this.settings.storageDir) : null; }
  _saveSettings(next) {
    fs.mkdirSync(this.userData, { recursive: true }); const tmp = `${this.settingsPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2)); fs.renameSync(tmp, this.settingsPath); this.settings = next;
  }
  setStorageDirectory(directory) {
    if (this.installPromise || this.checkPromise) throw new Error('运行包检查或安装期间不能切换存储目录');
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('运行包目录必须由系统目录选择器提供');
    this._assertAllowedStorage(directory);
    fs.mkdirSync(directory, { recursive: true });
    this._saveSettings({ ...this.settings, storageDir: canonicalPath(directory) }); this.data.storageDir = this.storageDir;
    return this.status();
  }
  _assertAllowedStorage(directory) {
    const targetPaths = [path.resolve(directory), canonicalPath(directory)];
    const roots = this.forbiddenRoots.flatMap(root => [root, canonicalPath(root)]);
    if (targetPaths.some(target => roots.some(root => sameOrInside(target, root)))) {
      throw new Error('运行包必须保存在客户端安装目录和用户数据目录之外的独立位置');
    }
  }
  status() { return { ...this.data, storageDir: this.storageDir }; }
  _set(patch) { Object.assign(this.data, patch); this.data.storageDir = this.storageDir; this.emit('change', this.status()); }
  getRuntimeRoot() {
    if (!this.activeRoot || !this.activeInfo || this.activeInfo.version !== this.settings.activeVersion || !this.storageDir || !this.settings.activeVersion || !VERSION.test(this.settings.activeVersion) || this.settings.activeVersion.endsWith('.')) return null;
    const expected = path.join(this.storageDir, 'versions', `${ID}-${this.settings.activeVersion}`);
    if (path.resolve(this.settings.activePath || '') !== path.resolve(expected)) return null;
    try {
      this._assertAllowedStorage(this.storageDir);
      const rootStat = fs.lstatSync(expected);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || !sameOrInside(canonicalPath(expected), canonicalPath(this.storageDir))) return null;
    } catch { return null; }
    return expected;
  }
  refreshInstalled() {
    let root = null, version = null, info = null;
    try {
      if (!this.storageDir || !this.settings.activeVersion || !VERSION.test(this.settings.activeVersion) || this.settings.activeVersion.endsWith('.')) throw new Error('invalid active version');
      this._assertAllowedStorage(this.storageDir);
      const expected = path.join(this.storageDir, 'versions', `${ID}-${this.settings.activeVersion}`);
      if (path.resolve(this.settings.activePath || '') !== path.resolve(expected)) throw new Error('active path mismatch');
      const rootStat = fs.lstatSync(expected); if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || !sameOrInside(canonicalPath(expected), canonicalPath(this.storageDir))) throw new Error('active root is unsafe');
      const manifestPath = path.join(expected, 'runtime.json'); const manifestStat = fs.lstatSync(manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64 * 1024 * 1024) throw new Error('runtime manifest is unsafe');
      info = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (info.schemaVersion !== 1 || info.id !== ID || info.version !== this.settings.activeVersion || info.protocolVersion !== PROTOCOL || info.platform !== 'win32-x64' ||
          info.entry?.python !== 'python/python.exe' || info.entry?.launcher !== 'tools/start_comfy.py' || !Array.isArray(info.files) || info.files.length > 250000) throw new Error('runtime manifest is incompatible');
      const entries = new Set();
      for (const item of info.files) {
        if (!item || !safeRelative(item.path) || entries.has(item.path.toLowerCase()) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !SHA.test(item.sha256)) throw new Error('runtime file metadata is invalid');
        entries.add(item.path.toLowerCase());
      }
      for (const entry of [info.entry.python, info.entry.launcher]) {
        if (!entries.has(entry.toLowerCase())) throw new Error('runtime entry is not listed');
        const full = path.join(expected, ...entry.split('/')); const stat = fs.lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink() || !sameOrInside(canonicalPath(full), canonicalPath(expected))) throw new Error('runtime entry path is unsafe');
      }
      root = expected; version = info.version;
    } catch { root = null; version = null; info = null; }
    this.activeRoot = root; this.activeInfo = info;
    this._set({ installed: Boolean(root && version), version, state: root && version ? (this.data.state === 'ready' ? 'ready' : 'installed') : 'not_installed', message: root ? '运行包已安装' : '运行包尚未安装' });
    return this.status();
  }
  async _manifestUrl() {
    let url = this.env.VIVID_RUNTIME_MANIFEST_URL;
    if (!url) {
      try {
        const feed = JSON.parse(fs.readFileSync(this.feedPath, 'utf8'));
        if (feed.schemaVersion !== 1) throw new Error('运行包下载配置版本不兼容');
        url = feed.manifestUrl;
      } catch (error) { if (error.message.includes('不兼容')) throw error; }
    }
    if (!url) throw new Error('运行包下载地址尚未配置');
    const parsed = new URL(url);
    const testAllowed = this.env.VIVID_RUNTIME_ALLOW_LOCAL_TEST === '1' && parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !testAllowed) throw new Error('运行包清单必须使用HTTPS');
    return parsed;
  }
  check() {
    if (this.installPromise) return Promise.reject(new Error('运行包安装期间不能重新检查版本'));
    if (this.checkPromise) return this.checkPromise;
    this.checkPromise = this._check().finally(() => { this.checkPromise = null; });
    return this.checkPromise;
  }
  async _check() {
    this._set({ state: 'checking', error: null, message: '正在检查运行包版本' });
    try {
      const url = await this._manifestUrl(); const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`获取运行包清单失败 (${response.status})`);
      const chunks = []; let manifestBytes = 0;
      if (Number(response.headers.get('content-length') || 0) > 1024 * 1024) throw new Error('运行包清单超过1MiB限制');
      for await (const chunk of response.body) { manifestBytes += chunk.length; if (manifestBytes > 1024 * 1024) throw new Error('运行包清单超过1MiB限制'); chunks.push(chunk); }
      const m = validateManifest(JSON.parse(Buffer.concat(chunks).toString('utf8'))); const archive = new URL(m.archive.url, url);
      const localTest = this.env.VIVID_RUNTIME_ALLOW_LOCAL_TEST === '1' && archive.protocol === 'http:' && archive.hostname === '127.0.0.1';
      if (archive.protocol !== 'https:' && !localTest) throw new Error('运行包下载必须使用HTTPS');
      this.available = { ...m, archive: { ...m.archive, url: archive.href } };
      this._set({ available: true, availableVersion: m.version, state: this.data.installed ? 'installed' : 'not_installed', message: `可安装运行包 ${m.version}`, error: null });
      return this.status();
    } catch (error) { this._set({ available: false, state: 'error', error: error.message, message: error.message }); throw error; }
  }
  install() {
    if (this.installPromise) return this.installPromise;
    if (this.checkPromise) return Promise.reject(new Error('运行包检查期间不能开始安装'));
    const ready = this.available ? Promise.resolve(this.available) : this.check();
    this.installPromise = ready.then(() => this._install()).catch(error => {
      if (!['paused', 'error'].includes(this.data.state)) this._set({ state: 'error', error: error.message, message: error.message });
      throw error;
    }).finally(() => { this.installPromise = null; this.controller = null; });
    return this.installPromise;
  }
  async pause() { if (this.controller) { this.controller.abort(new Error('用户暂停下载')); return true; } return false; }
  async _install() {
    if (!this.storageDir) throw new Error('请先选择运行包存储目录');
    this._assertAllowedStorage(this.storageDir);
    const m = this.available; validateManifest(m);
    const base = this.storageDir; const downloads = path.join(base, 'downloads'); const staging = path.join(base, 'staging'); const versions = path.join(base, 'versions');
    fs.mkdirSync(downloads, { recursive: true }); fs.mkdirSync(staging, { recursive: true }); fs.mkdirSync(versions, { recursive: true });
    const archivePath = path.join(downloads, `${ID}-${m.version}.zip`); const partPath = `${archivePath}.part`;
    let archiveReady = false;
    const matchesArchive = async file => {
      if (!fs.existsSync(file)) return false;
      const stat = fs.statSync(file);
      if (stat.size !== m.archive.bytes) return false;
      return (await hashFile(file)).toLowerCase() === m.archive.sha256.toLowerCase();
    };
    archiveReady = await matchesArchive(archivePath);
    if (!archiveReady && fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true });
    if (!archiveReady && await matchesArchive(partPath)) { fs.renameSync(partPath, archivePath); archiveReady = true; }
    let partialBytes = !archiveReady && fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
    if (partialBytes > m.archive.bytes) { fs.rmSync(partPath, { force: true }); partialBytes = 0; }
    const required = (archiveReady ? 0 : Math.max(0, m.archive.bytes - Math.min(partialBytes, m.archive.bytes))) + m.archive.unpackedBytes + 64 * 1024 * 1024;
    if (this.freeBytes(base) < required) throw new Error(`磁盘空间不足，需要约 ${Math.ceil(required / 1024 / 1024)} MB`);
    let stage = null;
    this.controller = new AbortController();
    this._set({ state: archiveReady ? 'verifying' : 'downloading', error: null, message: archiveReady ? '正在复用已校验归档' : `正在下载运行包 ${m.version}`,
      availableVersion: m.version, downloadedBytes: archiveReady ? m.archive.bytes : partialBytes, totalBytes: m.archive.bytes,
      progress: archiveReady ? 100 : Math.floor(partialBytes / m.archive.bytes * 100) });
    try {
      if (!archiveReady) {
        await this._download(m.archive.url, partPath, m.archive.bytes, this.controller.signal);
        const stat = fs.statSync(partPath); const digest = await hashFile(partPath);
        if (stat.size !== m.archive.bytes || digest.toLowerCase() !== m.archive.sha256.toLowerCase()) throw new Error('运行包大小或SHA256校验失败');
        fs.renameSync(partPath, archivePath);
        this._set({ state: 'verifying', downloadedBytes: stat.size, progress: 100, message: '正在校验运行包结构' });
      }
      stage = path.join(staging, `${ID}-${m.version}-${crypto.randomUUID()}`); fs.mkdirSync(stage, { recursive: false });
      this._set({ state: 'installing', message: '正在安全解压并验证文件' });
      if (this.extract) { await validateZip(archivePath, m.archive.unpackedBytes); await this.extract(archivePath, stage); }
      else await runZipScript(archivePath, stage, m.archive.unpackedBytes, false);
      await this._verifyRuntime(stage, m);
      const finalPath = path.join(versions, `${ID}-${m.version}`);
      if (fs.existsSync(finalPath)) throw new Error(`运行包目录已存在，未覆盖: ${finalPath}`);
      const previousSettings = this.settings; const previousRoot = this.getRuntimeRoot(); const previousInfo = this.activeInfo;
      const rollback = this.beforeActivate ? await this.beforeActivate({ previousRoot, runtimeRoot: finalPath, version: m.version }) : null;
      let engineResult = null;
      try {
        fs.renameSync(stage, finalPath); stage = null;
        this._saveSettings({ ...previousSettings, activePath: finalPath, activeVersion: m.version });
        this.activeRoot = finalPath; this.activeInfo = JSON.parse(fs.readFileSync(path.join(finalPath, 'runtime.json'), 'utf8'));
        if (this.afterActivate) {
          try { engineResult = await this.afterActivate({ previousRoot, runtimeRoot: finalPath, version: m.version }); }
          catch (error) { if (previousRoot) throw error; engineResult = { ready: false, error: error.message }; }
        }
      } catch (error) {
        try { this._saveSettings(previousSettings); } catch {}
        this.activeRoot = previousRoot; this.activeInfo = previousInfo;
        if (typeof rollback === 'function') { try { await rollback(); } catch {} }
        fs.rmSync(finalPath, { recursive: true, force: true });
        throw error;
      }
      this._set({ installed: true, version: m.version, state: engineResult?.ready ? 'ready' : 'installed',
        message: engineResult?.ready ? `运行包 ${m.version} 已激活，引擎已就绪` : engineResult?.error ? '运行包已安装，但引擎启动失败' : `运行包 ${m.version} 安装并激活成功`, error: engineResult?.error || null });
      return this.status();
    } catch (error) {
      if (stage && fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
      const paused = this.controller?.signal.aborted;
      this.refreshInstalled();
      if (paused) this._set({ state: 'paused', message: '下载已暂停，可继续安装', error: null, downloadedBytes: fs.existsSync(partPath) ? fs.statSync(partPath).size : 0 });
      else this._set({ state: 'error', message: error.message, error: error.message });
      throw error;
    }
  }
  async _download(url, partPath, expectedBytes, signal) {
    let offset = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
    if (offset > expectedBytes) { fs.rmSync(partPath); offset = 0; }
    this._set({ downloadedBytes: offset, totalBytes: expectedBytes, progress: Math.floor(offset / expectedBytes * 100) });
    const fetchRange = async (start) => fetch(url, { headers: start ? { Range: `bytes=${start}-` } : {}, redirect: 'error', signal });
    let response = await fetchRange(offset);
    if (offset && (response.status !== 206 || !response.headers.get('content-range')?.startsWith(`bytes ${offset}-`))) {
      await response.body?.cancel(); fs.rmSync(partPath, { force: true }); offset = 0; response = await fetchRange(0);
    }
    if ((!offset && response.status !== 200) || (offset && response.status !== 206)) throw new Error(`下载运行包失败 (${response.status})`);
    const mode = offset ? 'a' : 'w'; const output = fs.createWriteStream(partPath, { flags: mode });
    let downloaded = offset;
    const meter = new Transform({ transform: (chunk, encoding, callback) => {
      downloaded += chunk.length;
      if (downloaded > expectedBytes) return callback(new Error('下载文件超过清单声明大小'));
      this._set({ downloadedBytes: downloaded, totalBytes: expectedBytes, progress: Math.floor(downloaded / expectedBytes * 100) });
      callback(null, chunk);
    } });
    try { await pipeline(Readable.fromWeb(response.body), meter, output, { signal }); }
    catch (error) { await response.body?.cancel().catch(() => {}); throw error; }
    if (downloaded !== expectedBytes) throw new Error('下载中断，保留已下载部分以便续传');
  }
  async _verifyRuntime(stage, manifest) {
    const file = path.join(stage, 'runtime.json');
    if (!fs.existsSync(file)) throw new Error('运行包缺少 runtime.json');
    if (fs.statSync(file).size > 64 * 1024 * 1024) throw new Error('runtime.json超过64MiB限制');
    const info = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (info.schemaVersion !== 1 || info.id !== ID || info.version !== manifest.version || info.protocolVersion !== PROTOCOL || info.platform !== 'win32-x64' ||
        JSON.stringify(info.entry) !== JSON.stringify(manifest.entry) || !Array.isArray(info.files) || info.files.length > 250000) throw new Error('运行包内部版本清单不匹配');
    const expected = new Map();
    for (const item of info.files) {
      if (!item || !safeRelative(item.path) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !SHA.test(item.sha256) || expected.has(item.path.toLowerCase())) throw new Error('运行包内部文件清单无效');
      expected.set(item.path.toLowerCase(), item);
    }
    const declaredBytes = [...expected.values()].reduce((sum, item) => sum + item.bytes, 0);
    if (declaredBytes > manifest.archive.unpackedBytes) throw new Error('运行包解压大小超过清单声明');
    for (const required of manifest.requiredFiles) if (!expected.has(required.toLowerCase())) throw new Error(`运行包缺少声明文件: ${required}`);
    for (const required of [manifest.entry.python, manifest.entry.launcher]) if (!expected.has(required.toLowerCase())) throw new Error(`运行包入口未列入文件清单: ${required}`);
    const actual = new Map();
    const walk = (directory, prefix = '') => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name; const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`运行包含链接文件: ${rel}`);
      if (entry.isDirectory()) walk(full, rel); else if (entry.isFile()) { if (rel !== 'runtime.json') actual.set(rel.toLowerCase(), full); } else throw new Error(`运行包含特殊文件: ${rel}`);
    } };
    walk(stage);
    if (actual.size !== expected.size) throw new Error('运行包实际文件与内部清单不一致');
    for (const [key, meta] of expected) {
      const full = actual.get(key); if (!full) throw new Error(`运行包缺少文件: ${meta.path}`);
      const stat = fs.statSync(full); if (stat.size !== meta.bytes) throw new Error(`运行包文件大小错误: ${meta.path}`);
      const hash = await hashFile(full);
      if (hash.toLowerCase() !== meta.sha256.toLowerCase()) throw new Error(`运行包文件校验失败: ${meta.path}`);
    }
    for (const required of manifest.requiredFiles) if (!actual.has(required.toLowerCase())) throw new Error(`运行包缺少必需文件: ${required}`);
  }
}

module.exports = { RuntimeManager, validateManifest, validateZip, safeRelative };
