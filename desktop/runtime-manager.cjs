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
const DOWNLOAD_PROVIDERS = { quark: '夸克网盘', baidu: '百度网盘' };
function clientVersions(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || !value.length || value.length > 128 || value.some(version => typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) || new Set(value).size !== value.length) throw new Error('运行包须声明准确的兼容客户端版本');
  return value;
}
function releaseNotes(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12 || value.some(note => typeof note !== 'string' || !note.trim() || note.length > 500)) throw new Error('更新说明格式无效');
  return value;
}
function validateClientRelease(release) {
  if (release === undefined) return;
  if (!release || typeof release.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error('客户端发布版本无效');
  const url = new URL(release.downloadUrl);
  const official = url.hostname === 'github.com' && url.pathname.startsWith('/zzpzz009/Vivid4Free/releases/') ||
    url.hostname === 'pan.quark.cn' && /^\/s\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !official) throw new Error('客户端更新入口无效');
  releaseNotes(release.notes);
  clientVersions(release.supportedRuntimeVersions);
}
function downloadSources(manifest) {
  const sources = manifest?.downloads || [];
  if (!Array.isArray(sources) || sources.length > 2) throw new Error('运行包网盘下载配置无效');
  const seen = new Set();
  return sources.map(source => {
    if (!source || !Object.hasOwn(DOWNLOAD_PROVIDERS, source.provider) || seen.has(source.provider)) throw new Error('运行包网盘类型无效或重复');
    seen.add(source.provider);
    const url = new URL(source.url);
    const host = source.provider === 'quark' ? 'pan.quark.cn' : 'pan.baidu.com';
    if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || !/^\/s\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw new Error('请使用夸克或百度网盘的官方 HTTPS 分享链接');
    if (source.extractionCode != null && source.extractionCode !== '' && (typeof source.extractionCode !== 'string' || !/^[A-Za-z0-9]{1,16}$/.test(source.extractionCode))) throw new Error('网盘提取码格式无效');
    return { provider: source.provider, label: DOWNLOAD_PROVIDERS[source.provider], url: url.href, extractionCode: source.extractionCode || '' };
  });
}
const safeRelative = value => {
  if (typeof value !== 'string' || !value || value.length > 32767 || value.includes('\\') || value.includes(':') || /[\x00-\x1f]/.test(value)) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  const parts = value.replace(/\/$/, '').split('/');
  return parts.length > 0 && parts.length <= 256 && parts.every(part => part && part !== '.' && part !== '..' &&
    !/[. ]$/.test(part) && !/[<>"|?*]/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
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
  if ((a.url != null && typeof a.url !== 'string') || !Number.isSafeInteger(a.bytes) || a.bytes <= 0 || !Number.isSafeInteger(a.unpackedBytes) || a.unpackedBytes <= 0 || !SHA.test(a.sha256)) {
    throw new Error('运行包清单中的归档信息无效');
  }
  const sources = downloadSources(m);
  releaseNotes(m.releaseNotes);
  validateClientRelease(m.clientRelease);
  if (!a.url && !sources.length) throw new Error('运行包清单缺少下载入口');
  const clients = clientVersions(m.compatibleClientVersions);
  if (sources.length && !clients) throw new Error('网盘发布信息缺少兼容客户端版本');
  if (m.entry.python !== 'python/python.exe' || m.entry.launcher !== 'tools/start_comfy.py') throw new Error('运行包入口与客户端协议不兼容');
  if (!m.requiredFiles.length || m.requiredFiles.length > 10000 || m.requiredFiles.some(file => !safeRelative(file)) || new Set(m.requiredFiles.map(v => v.toLowerCase())).size !== m.requiredFiles.length) {
    throw new Error('运行包必需文件清单无效');
  }
  if (m.incremental !== undefined) {
    const d = m.incremental, a = d?.archive;
    if (!d || typeof d.baseVersion !== 'string' || !VERSION.test(d.baseVersion) || d.baseVersion.endsWith('.') ||
        !olderVersion(d.baseVersion, m.version) || !SHA.test(d.baseManifestSha256) || !a || a.url != null ||
        !Number.isSafeInteger(a.bytes) || a.bytes <= 0 || !SHA.test(a.sha256) ||
        !Number.isSafeInteger(a.unpackedBytes) || a.unpackedBytes <= 0) throw new Error('引擎增量包发布信息无效');
  }
  return m;
}

function runZipScript(archive, destination, maxBytes, validateOnly = false, inspect = false) {
  return new Promise((resolve, reject) => {
    const script = path.basename(__dirname) === 'app.asar'
      ? path.join(path.dirname(__dirname), 'app.asar.unpacked', 'extract-runtime.ps1')
      : path.join(__dirname, 'extract-runtime.ps1');
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Archive', archive, '-MaxUnpackedBytes', String(maxBytes)];
    if (inspect) args.push('-Inspect'); else if (validateOnly) args.push('-ValidateOnly'); else args.push('-Destination', destination);
    // Windows PowerShell 5.1 ships with Windows and provides the .NET ZipArchive API used here.
    const child = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(output) : reject(new Error('运行包 ZIP 无法安全解压，请检查文件是否完整、是否为官方运行包', { cause: new Error(output.slice(-1200) || `ZIP validation failed (${code})`) })));
  });
}
function validateZip(file, maxBytes = Number.MAX_SAFE_INTEGER) { return runZipScript(file, null, maxBytes, true); }
function validateRuntimeInfo(info) {
  if (!info || info.schemaVersion !== 1 || info.id !== ID || typeof info.version !== 'string' || !VERSION.test(info.version) || info.version.endsWith('.') ||
      info.protocolVersion !== PROTOCOL || info.platform !== 'win32-x64' || info.entry?.python !== 'python/python.exe' ||
      info.entry?.launcher !== 'tools/start_comfy.py' || !Array.isArray(info.files) || !info.files.length || info.files.length > 250000) throw new Error('请选择兼容的 Vivid 引擎官方运行包（需要有效 runtime.json），普通 ComfyUI 目录不能直接接入');
  const files = new Set();
  clientVersions(info.compatibleClientVersions);
  for (const item of info.files) {
    if (!item || !safeRelative(item.path) || ['runtime.json', 'delta.json'].includes(item.path.toLowerCase()) || files.has(item.path.toLowerCase()) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !SHA.test(item.sha256)) throw new Error('运行包内部文件清单无效');
    files.add(item.path.toLowerCase());
  }
  for (const file of Object.values(info.entry)) if (!files.has(file.toLowerCase())) throw new Error('运行包入口未列入文件清单');
  return info;
}
function validateDeltaInfo(delta, info) {
  if (!delta || delta.schemaVersion !== 1 || delta.targetVersion !== info.version ||
      typeof delta.baseVersion !== 'string' || !VERSION.test(delta.baseVersion) || delta.baseVersion.endsWith('.') ||
      !olderVersion(delta.baseVersion, info.version) || !SHA.test(delta.baseManifestSha256)) throw new Error('增量包基线声明无效，请使用全量包');
  const target = new Set(info.files.map(item => item.path));
  for (const key of ['files', 'removed']) {
    const list = delta[key];
    if (!Array.isArray(list) || list.length > 250000 || new Set(list.map(p => typeof p === 'string' ? p.toLowerCase() : p)).size !== list.length ||
        list.some(p => !safeRelative(p) || ['runtime.json', 'delta.json'].includes(p.toLowerCase()) || (key === 'files' ? !target.has(p) : target.has(p)))) throw new Error('增量包变更清单无效');
  }
  return delta;
}
function numericVersion(value) { return /^\d+(?:\.\d+)*$/.test(value) ? value.split('.').map(Number) : null; }
function olderVersion(candidate, current) {
  const a = numericVersion(candidate), b = numericVersion(current || '');
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  }
  return false;
}
function hashFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256'); const input = fs.createReadStream(file, { highWaterMark: 8 * 1024 * 1024 });
    let bytes = 0, lastUpdate = 0;
    input.on('data', chunk => {
      hash.update(chunk); bytes += chunk.length;
      if (onProgress && Date.now() - lastUpdate > 500) { lastUpdate = Date.now(); onProgress(bytes); }
    });
    input.once('error', reject); input.once('end', () => resolve(hash.digest('hex')));
  });
}

class RuntimeManager extends EventEmitter {
  constructor({ userData, feedPath = path.join(__dirname, 'runtime-feed.json'), env = process.env, freeBytes, extract, forbiddenRoots = [], beforeActivate, afterActivate,
    clientVersion = null, supportedRuntimeVersions = [], compatibilityNote = '', fetchImpl = fetch } = {}) {
    super();
    this.userData = path.resolve(userData || path.join(os.tmpdir(), 'vivid-runtime-test-userdata'));
    this.forbiddenRoots = [this.userData, ...forbiddenRoots].filter(Boolean).map(root => path.resolve(root));
    this.feedPath = feedPath; this.env = env; this.freeBytes = freeBytes || (() => {
      const stats = fs.statfsSync(this.storageDir || this.userData);
      return stats.bavail * stats.bsize;
    });
    this.extract = extract || null; this.fetch = fetchImpl;
    this.beforeActivate = beforeActivate; this.afterActivate = afterActivate;
    this.clientVersion = clientVersion; this.supportedRuntimeVersions = supportedRuntimeVersions; this.compatibilityNote = compatibilityNote;
    this.settingsPath = path.join(this.userData, 'runtime-settings.json');
    this.settings = this._readSettings(); this.available = null; this.installPromise = null; this.checkPromise = null; this.controller = null;
    this.updateCheckState = 'not_checked';
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
    this._saveSettings({ ...this.settings, activeStorageDir: this.settings.activeStorageDir || this.storageDir,
      storageDir: canonicalPath(directory) }); this.data.storageDir = this.storageDir;
    return this.refreshInstalled();
  }
  _assertAllowedStorage(directory) {
    const targetPaths = [path.resolve(directory), canonicalPath(directory)];
    const roots = this.forbiddenRoots.flatMap(root => [root, canonicalPath(root)]);
    if (targetPaths.some(target => roots.some(root => sameOrInside(target, root)))) {
      throw new Error('运行包必须保存在客户端安装目录和用户数据目录之外的独立位置');
    }
  }
  status() {
    const active = this.activeInfo ? this.compatibility(this.activeInfo) : null;
    const available = this.available ? this.compatibility(this.available) : null;
    const issue = active && !active.compatible ? active : available && !available.compatible ? available : null;
    return { ...this.data, storageDir: this.storageDir, activePath: this.activeRoot,
    updateCheckState: this.updateCheckState,
    clientRelease: this.available?.clientRelease || null,
    clientUpdateAvailable: Boolean(this.clientVersion && this.available?.clientRelease && olderVersion(this.clientVersion, this.available.clientRelease.version)),
    releaseNotes: releaseNotes(this.available?.releaseNotes),
    updateAvailable: Boolean(this.available && this.available.version !== this.data.version && !olderVersion(this.available.version, this.data.version)),
    downloadSources: downloadSources(this.available).map(source => ({ ...source, enabled: source.provider === 'quark' })),
    clientVersion: this.clientVersion, supportedRuntimeVersions: this._supportedVersions(), compatibilityNote: this.compatibilityNote,
    runtimeCompatible: active?.compatible ?? null,
    runtimeCompatibilityState: active?.state ?? null,
    availableCompatible: available?.compatible ?? null,
    availableCompatibilityState: available?.state ?? null,
    availableCompatibilitySource: available?.source ?? null,
    compatibleClientVersions: this.available?.compatibleClientVersions || [],
    recommendedPackage: this.available?.incremental?.baseVersion === this.data.version ? 'incremental' : 'full',
    incrementalBaseVersion: this.available?.incremental?.baseVersion || null,
    fullPackageBytes: this.available?.archive?.bytes || null,
    incrementalPackageBytes: this.available?.incremental?.archive?.bytes || null,
    compatibilityMessage: issue?.message || '',
    downloadConfigured: Boolean(this.env.VIVID_RUNTIME_MANIFEST_URL || this._feedUrl()) }; }
  compatibility(info) {
    if (info?.id !== ID || info.protocolVersion !== PROTOCOL || info.platform !== 'win32-x64') {
      return { compatible: false, state: 'incompatible', source: 'protocol', message: `引擎 ${info?.version || ''} 的协议或平台与当前客户端不兼容，请使用匹配的引擎版本` };
    }
    // A newer client can explicitly support an existing engine without rewriting its ZIP.
    if (!this.clientVersion || this.supportedRuntimeVersions.includes(info.version)) {
      return { compatible: true, state: 'supported', source: 'client-policy', message: '' };
    }
    if (clientVersions(info.compatibleClientVersions)?.includes(this.clientVersion)) {
      return { compatible: true, state: 'supported', source: 'engine-manifest', message: '' };
    }
    return { compatible: false, state: 'unverified', source: null,
      message: `引擎 ${info.version} 与客户端 ${this.clientVersion} 的组合待验证，尚未声明兼容；请使用当前客户端已支持的引擎，不能保证未验证组合的兼容性和出图可靠性` };
  }
  isRuntimeCompatible(info) {
    return this.compatibility(info).compatible;
  }
  _supportedVersions() {
    const candidates = [this.activeInfo, this.available].filter(info => info && this.isRuntimeCompatible(info)).map(info => info.version);
    return [...new Set([...this.supportedRuntimeVersions, ...candidates])];
  }
  _assertCompatible(info) {
    const result = this.compatibility(info);
    if (!result.compatible) throw new Error(result.message);
  }
  downloadSource(provider) {
    if (this.installPromise || this.checkPromise) throw new Error('请等待当前运行包操作完成');
    if (provider === 'baidu') throw new Error('百度网盘暂未开放，请使用夸克网盘');
    const source = downloadSources(this.available).find(source => source.provider === provider);
    if (!source) throw new Error('该网盘下载入口尚未配置，请先检查引擎新版');
    return source;
  }
  _feedUrl() { try { return JSON.parse(fs.readFileSync(this.feedPath, 'utf8')).manifestUrl || null; } catch { return null; } }
  _set(patch) { Object.assign(this.data, patch); this.data.storageDir = this.storageDir; this.emit('change', this.status()); }
  getRuntimeRoot() {
    if (!this.activeRoot || !this.activeInfo || this.activeInfo.version !== this.settings.activeVersion || !this.settings.activeVersion || !VERSION.test(this.settings.activeVersion) || this.settings.activeVersion.endsWith('.')) return null;
    const activeStorage = this.settings.activeStorageDir || this.storageDir;
    if (!this.settings.external && !activeStorage) return null;
    const expected = this.settings.external ? this.settings.activePath : path.join(activeStorage, 'versions', `${ID}-${this.settings.activeVersion}`);
    if (path.resolve(this.settings.activePath || '') !== path.resolve(expected)) return null;
    try {
      this._assertAllowedStorage(expected);
      const rootStat = fs.lstatSync(expected);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (!this.settings.external && !sameOrInside(canonicalPath(expected), canonicalPath(activeStorage)))) return null;
    } catch { return null; }
    return expected;
  }
  refreshInstalled() {
    let root = null, version = null, info = null;
    try {
      const activeStorage = this.settings.activeStorageDir || this.storageDir;
      if ((!this.settings.external && !activeStorage) || !this.settings.activeVersion || !VERSION.test(this.settings.activeVersion) || this.settings.activeVersion.endsWith('.')) throw new Error('invalid active version');
      const expected = this.settings.external ? this.settings.activePath : path.join(activeStorage, 'versions', `${ID}-${this.settings.activeVersion}`);
      this._assertAllowedStorage(expected);
      if (path.resolve(this.settings.activePath || '') !== path.resolve(expected)) throw new Error('active path mismatch');
      const rootStat = fs.lstatSync(expected); if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (!this.settings.external && !sameOrInside(canonicalPath(expected), canonicalPath(activeStorage)))) throw new Error('active root is unsafe');
      const manifestPath = path.join(expected, 'runtime.json'); const manifestStat = fs.lstatSync(manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64 * 1024 * 1024) throw new Error('runtime manifest is unsafe');
      info = validateRuntimeInfo(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
      if (info.version !== this.settings.activeVersion) throw new Error('runtime version mismatch');
      for (const entry of [info.entry.python, info.entry.launcher]) {
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
    this.updateCheckState = 'checking';
    this._set({ state: 'checking', error: null, message: '正在检查运行包版本' });
    try {
      const url = await this._manifestUrl(); const response = await this.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`获取运行包清单失败 (${response.status})`);
      const chunks = []; let manifestBytes = 0;
      if (Number(response.headers.get('content-length') || 0) > 1024 * 1024) throw new Error('运行包清单超过1MiB限制');
      for await (const chunk of response.body) { manifestBytes += chunk.length; if (manifestBytes > 1024 * 1024) throw new Error('运行包清单超过1MiB限制'); chunks.push(chunk); }
      const m = validateManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      let archiveUrl = null;
      if (m.archive.url) {
        const archive = new URL(m.archive.url, url);
        const localTest = this.env.VIVID_RUNTIME_ALLOW_LOCAL_TEST === '1' && archive.protocol === 'http:' && archive.hostname === '127.0.0.1';
        if (archive.protocol !== 'https:' && !localTest) throw new Error('运行包下载必须使用HTTPS');
        archiveUrl = archive.href;
      }
      this.available = { ...m, archive: { ...m.archive, url: archiveUrl } };
      this.updateCheckState = 'checked';
      this._set({ available: true, availableVersion: m.version, state: this.data.installed ? 'installed' : 'not_installed',
        message: m.version === this.data.version ? '当前运行包已是此下载源提供的版本' : olderVersion(m.version, this.data.version) ? '下载源版本早于当前版本，已保留现用环境' : `可安装运行包 ${m.version}`, error: null });
      return this.status();
    } catch (error) { this.updateCheckState = 'failed'; this.available = null; this._set({ available: false, availableVersion: null, state: this.data.installed ? 'installed' : 'error', error: error.message, message: error.message }); throw error; }
  }
  install() {
    if (this.installPromise) return this.installPromise;
    if (this.checkPromise) return Promise.reject(new Error('运行包检查期间不能开始安装'));
    const ready = this.available ? Promise.resolve(this.available) : this.check();
    this.installPromise = ready.then(() => {
      if (!this.available.archive.url) throw new Error('请打开网盘链接，用官方客户端下载 ZIP 后返回导入');
      return this._install();
    }).catch(error => {
      if (!['paused', 'error'].includes(this.data.state)) this._set({ state: 'error', error: error.message, message: error.message });
      throw error;
    }).finally(() => { this.installPromise = null; this.controller = null; });
    return this.installPromise;
  }
  async pause() { if (this.controller) { this.controller.abort(new Error('用户暂停下载')); return true; } return false; }
  _localOperation(operation) {
    if (this.installPromise || this.checkPromise) return Promise.reject(new Error('请等待当前运行包操作完成'));
    this.installPromise = Promise.resolve().then(operation).catch(error => {
      this.refreshInstalled(); this._set({ state: this.data.installed ? 'installed' : 'error', error: error.message, message: error.message }); throw error;
    }).finally(() => { this.installPromise = null; this.controller = null; });
    return this.installPromise;
  }
  importArchive(file) {
    return this._localOperation(async () => {
      if (!this.storageDir) throw new Error('请先选择运行包存储目录，再导入离线 ZIP');
      if (typeof file !== 'string' || !path.isAbsolute(file) || !fs.lstatSync(file).isFile()) throw new Error('请选择官方运行包 ZIP 文件');
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('请选择实体 ZIP 文件，不能导入链接');
      const release = this.available;
      this._set({ state: 'verifying', message: '正在读取离线包清单', error: null, progress: 0 });
      const inspected = JSON.parse(await runZipScript(file, null, Number.MAX_SAFE_INTEGER, false, true));
      const info = validateRuntimeInfo(inspected.info);
      const delta = inspected.delta == null ? null : validateDeltaInfo(inspected.delta, info);
      this._assertCompatible(info);
      if (release) {
        this._assertCompatible(release);
        const published = delta ? release.incremental?.archive : release.archive;
        if (!published || (delta && (release.incremental.baseVersion !== delta.baseVersion ||
            release.incremental.baseManifestSha256.toLowerCase() !== delta.baseManifestSha256.toLowerCase()))) throw new Error('所选增量包与发布信息不一致，请下载全量包');
        this._set({ state: 'verifying', message: '正在核对下载 ZIP 的大小和 SHA256', error: null, progress: 0,
          downloadedBytes: 0, totalBytes: published.bytes });
        if (fs.statSync(file).size !== published.bytes) throw new Error('所选 ZIP 大小与发布信息不一致，请确认已下载完整且版本正确');
        const digest = await hashFile(file, bytes => this._set({ downloadedBytes: bytes, progress: Math.floor(bytes / published.bytes * 100) }));
        if (digest.toLowerCase() !== published.sha256.toLowerCase()) throw new Error('所选 ZIP 的 SHA256 与发布信息不一致，请重新下载官方运行包');
        if (delta && inspected.unpackedBytes > published.unpackedBytes) throw new Error('增量包解压大小超过发布声明');
      }
      if (release && info.version !== release.version) throw new Error(`所选 ZIP 不是已检查的 引擎 ${release.version}，未切换环境`);
      const manifest = release || { ...info, requiredFiles: Object.values(info.entry),
        archive: { bytes: fs.statSync(file).size, unpackedBytes: delta ? info.files.reduce((sum, item) => sum + item.bytes, 0) + 64 * 1024 * 1024 : inspected.unpackedBytes } };
      if (delta && info.version !== this.data.version) await this._verifyDeltaBase(delta, info);
      return this._install(manifest, file, delta ? { delta, info, unpackedBytes: inspected.unpackedBytes } : null);
    });
  }
  connectDirectory(directory) {
    return this._localOperation(async () => {
      if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('请选择已解压的官方 引擎 版本目录');
      this._assertAllowedStorage(directory);
      const root = canonicalPath(directory);
      if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(root).isDirectory()) throw new Error('请选择独立的实体运行包目录');
      const file = path.join(root, 'runtime.json');
      if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 64 * 1024 * 1024) throw new Error('请选择含 runtime.json 的官方 引擎 版本目录，普通 ComfyUI 不能直接接入');
      const info = validateRuntimeInfo(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (root === this.getRuntimeRoot()) return this.status();
      if (olderVersion(info.version, this.data.version)) throw new Error('所选运行包早于当前版本，未切换环境');
      const manifest = { ...info, requiredFiles: Object.values(info.entry), archive: { unpackedBytes: info.files.reduce((sum, item) => sum + item.bytes, 0) } };
      this._set({ state: 'verifying', message: '正在校验已有运行包，模型较大时需要一些时间', error: null, progress: 0 });
      await this._verifyRuntime(root, manifest, true);
      return this._activate(root, info, { external: true });
    });
  }
  async _activate(finalPath, info, patch = {}) {
    this._assertCompatible(info);
    const previousSettings = this.settings, previousRoot = this.getRuntimeRoot(), previousInfo = this.activeInfo;
    const rollback = this.beforeActivate ? await this.beforeActivate({ previousRoot, runtimeRoot: finalPath, version: info.version }) : null;
    try {
      this._saveSettings({ ...previousSettings, activePath: finalPath, activeVersion: info.version,
        activeStorageDir: this.storageDir, external: false, ...patch });
      this.activeRoot = finalPath; this.activeInfo = info;
      this._set({ installed: true, version: info.version });
      const result = this.afterActivate ? await this.afterActivate({ previousRoot, runtimeRoot: finalPath, version: info.version }) : null;
      if (result?.ready === false) throw new Error(result.error || '新版引擎未就绪');
      this._set({ state: result?.ready ? 'ready' : 'installed', available: Boolean(this.available), availableVersion: this.available?.version || null,
        message: result?.ready ? `运行包 ${info.version} 已接入，引擎已就绪` : `运行包 ${info.version} 已接入`, error: null });
      return this.status();
    } catch (error) {
      const errors = [error.message];
      try { this._saveSettings(previousSettings); }
      catch (saveError) { this.settings = previousSettings; errors.push(`旧版设置恢复失败：${saveError.message}`); }
      this.activeRoot = previousRoot; this.activeInfo = previousInfo;
      this._set({ installed: Boolean(previousRoot), version: previousInfo?.version || null });
      if (typeof rollback === 'function') {
        try { await rollback(); } catch (restoreError) { errors.push(`旧版引擎恢复失败：${restoreError.message}`); }
      }
      throw new Error(errors.join('；'));
    }
  }
  async _verifyDeltaBase(delta, target) {
    const root = this.getRuntimeRoot();
    if (!root || this.activeInfo?.version !== delta.baseVersion) throw new Error(`此增量包仅适用于引擎 ${delta.baseVersion}，请下载全量包`);
    const raw = fs.readFileSync(path.join(root, 'runtime.json'));
    if (crypto.createHash('sha256').update(raw).digest('hex') !== delta.baseManifestSha256.toLowerCase()) throw new Error('现有引擎基线与增量包不符，请下载全量包');
    const base = validateRuntimeInfo(JSON.parse(raw));
    const old = new Map(base.files.map(item => [item.path, item]));
    const next = new Map(target.files.map(item => [item.path, item]));
    const changed = target.files.filter(item => { const before = old.get(item.path); return !before || before.bytes !== item.bytes || before.sha256.toLowerCase() !== item.sha256.toLowerCase(); }).map(item => item.path).sort();
    const removed = base.files.filter(item => !next.has(item.path)).map(item => item.path).sort();
    if (JSON.stringify(changed) !== JSON.stringify([...delta.files].sort()) || JSON.stringify(removed) !== JSON.stringify([...delta.removed].sort())) throw new Error('增量包变更与基础版本不一致，请下载全量包');
    try {
      await this._verifyRuntime(root, { ...base, requiredFiles: Object.values(base.entry), archive: { unpackedBytes: base.files.reduce((sum, item) => sum + item.bytes, 0) } }, true);
    } catch (error) { throw new Error('现有引擎文件校验失败，请下载全量包', { cause: error }); }
  }
  async _extractDelta(archive, stage, patch) {
    const payload = `${stage}-payload`;
    fs.mkdirSync(payload);
    try {
      await runZipScript(archive, payload, patch.unpackedBytes);
      const expected = new Set([...patch.delta.files, 'runtime.json', 'delta.json']);
      const actual = [];
      const walk = (directory, prefix = '') => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error('增量包不能包含链接');
        if (entry.isDirectory()) walk(path.join(directory, entry.name), rel);
        else if (entry.isFile()) actual.push(rel); else throw new Error('增量包含特殊文件');
      } };
      walk(payload);
      if (actual.length !== expected.size || actual.some(name => !expected.has(name))) throw new Error('增量包载荷与变更清单不一致');
      const changed = new Set(patch.delta.files);
      const sourceRoot = this.getRuntimeRoot();
      if (!sourceRoot) throw new Error('增量安装的基础引擎已不可用');
      for (const item of patch.info.files) {
        const root = changed.has(item.path) ? payload : sourceRoot;
        const source = path.join(root, ...item.path.split('/'));
        const stat = fs.lstatSync(source);
        if (!stat.isFile() || stat.isSymbolicLink() || !sameOrInside(canonicalPath(source), canonicalPath(root))) throw new Error(`增量包文件路径无效: ${item.path}`);
        const destination = path.join(stage, ...item.path.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        // Separate copies preserve rollback even when a node modifies its files later.
        await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
      }
      fs.copyFileSync(path.join(payload, 'runtime.json'), path.join(stage, 'runtime.json'), fs.constants.COPYFILE_EXCL);
    } finally { fs.rmSync(payload, { recursive: true, force: true }); }
  }
  async _install(manifest = this.available, localArchive = null, patch = null) {
    if (!this.storageDir) throw new Error('请先选择运行包存储目录');
    this._assertAllowedStorage(this.storageDir);
    const m = manifest; if (!localArchive) validateManifest(m);
    if (m.version === this.data.version) { this._set({ state: 'installed', message: '当前运行包已接入，无需重复安装', error: null }); return this.status(); }
    if (olderVersion(m.version, this.data.version)) throw new Error('运行包版本早于当前版本，未切换环境');
    const base = this.storageDir; const downloads = path.join(base, 'downloads'); const staging = path.join(base, 'staging'); const versions = path.join(base, 'versions');
    for (const directory of [downloads, staging, versions]) {
      fs.mkdirSync(directory, { recursive: true });
      const stat = fs.lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || path.relative(canonicalPath(directory), path.resolve(directory)) !== '') throw new Error('运行包工作目录不能包含链接或重定向目录');
    }
    const finalPath = path.join(versions, `${ID}-${m.version}`);
    if (fs.existsSync(finalPath)) {
      this._set({ state: 'verifying', error: null, message: '正在重新校验之前准备的运行包', progress: 0 });
      await this._verifyRuntime(finalPath, m, true);
      return this._activate(finalPath, JSON.parse(fs.readFileSync(path.join(finalPath, 'runtime.json'), 'utf8')));
    }
    const archivePath = localArchive || path.join(downloads, `${ID}-${m.version}.zip`); const partPath = `${archivePath}.part`;
    for (const file of localArchive ? [archivePath] : [archivePath, partPath]) {
      try { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('运行包归档或下载片段不能是链接或特殊文件'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    let archiveReady = false;
    const matchesArchive = async file => {
      if (!fs.existsSync(file)) return false;
      const stat = fs.statSync(file);
      if (stat.size !== m.archive.bytes) return false;
      return (await hashFile(file)).toLowerCase() === m.archive.sha256.toLowerCase();
    };
    archiveReady = Boolean(localArchive) || await matchesArchive(archivePath);
    if (!archiveReady && fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true });
    if (!archiveReady && await matchesArchive(partPath)) { fs.renameSync(partPath, archivePath); archiveReady = true; }
    let partialBytes = !archiveReady && fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
    if (partialBytes > m.archive.bytes) { fs.rmSync(partPath, { force: true }); partialBytes = 0; }
    const required = (archiveReady ? 0 : Math.max(0, m.archive.bytes - Math.min(partialBytes, m.archive.bytes))) + m.archive.unpackedBytes + (patch?.unpackedBytes || 0) + 64 * 1024 * 1024;
    if (this.freeBytes(base) < required) throw new Error(`磁盘空间不足，需要约 ${Math.ceil(required / 1024 / 1024)} MB`);
    let stage = null;
    this.controller = new AbortController();
    this._set({ state: archiveReady ? 'verifying' : 'downloading', error: null, message: archiveReady ? '正在复用已校验归档' : `正在下载运行包 ${m.version}`,
      availableVersion: this.available?.version || null, downloadedBytes: archiveReady ? m.archive.bytes : partialBytes, totalBytes: m.archive.bytes,
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
      if (patch) await this._extractDelta(archivePath, stage, patch);
      else if (this.extract) { await validateZip(archivePath, m.archive.unpackedBytes); await this.extract(archivePath, stage); }
      else await runZipScript(archivePath, stage, m.archive.unpackedBytes, false);
      await this._verifyRuntime(stage, m);
      if (fs.existsSync(finalPath)) throw new Error(`运行包目录已存在，未覆盖: ${finalPath}`);
      fs.renameSync(stage, finalPath); stage = null;
      // Activation may fail after starting a process. Retain verified files for retry;
      // deleting here could remove files still used by an engine that failed to stop.
      return await this._activate(finalPath, JSON.parse(fs.readFileSync(path.join(finalPath, 'runtime.json'), 'utf8')));
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
    const fetchRange = async (start) => this.fetch(url, { headers: start ? { Range: `bytes=${start}-` } : {}, redirect: 'error', signal });
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
  async _verifyRuntime(stage, manifest, existing = false) {
    const file = path.join(stage, 'runtime.json');
    if (!fs.existsSync(file)) throw new Error('运行包缺少 runtime.json');
    if (!fs.lstatSync(stage).isDirectory() || fs.lstatSync(stage).isSymbolicLink() ||
        !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('运行包目录或清单不是实体文件');
    if (fs.statSync(file).size > 64 * 1024 * 1024) throw new Error('runtime.json超过64MiB限制');
    const info = validateRuntimeInfo(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (info.schemaVersion !== 1 || info.id !== ID || info.version !== manifest.version || info.protocolVersion !== PROTOCOL || info.platform !== 'win32-x64' ||
        JSON.stringify(info.entry) !== JSON.stringify(manifest.entry) || !Array.isArray(info.files) || info.files.length > 250000) throw new Error('运行包内部版本清单不匹配');
    const expected = new Map();
    for (const item of info.files) {
      if (!item || !safeRelative(item.path) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !SHA.test(item.sha256) || expected.has(item.path.toLowerCase())) throw new Error('运行包内部文件清单无效');
      expected.set(item.path.toLowerCase(), item);
    }
    const declaredBytes = [...expected.values()].reduce((sum, item) => sum + item.bytes, 0);
    if (declaredBytes > manifest.archive.unpackedBytes) throw new Error('运行包解压大小超过清单声明');
    this._set({ state: 'verifying', downloadedBytes: 0, totalBytes: declaredBytes, progress: 0,
      message: '正在校验运行包文件', error: null });
    for (const required of manifest.requiredFiles) if (!expected.has(required.toLowerCase())) throw new Error(`运行包缺少声明文件: ${required}`);
    for (const required of [manifest.entry.python, manifest.entry.launcher]) if (!expected.has(required.toLowerCase())) throw new Error(`运行包入口未列入文件清单: ${required}`);
    const actual = new Map();
    const walk = (directory, prefix = '') => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name; const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`运行包含链接文件: ${rel}`);
      if (entry.isDirectory()) walk(full, rel); else if (entry.isFile()) { if (rel !== 'runtime.json') actual.set(rel.toLowerCase(), full); } else throw new Error(`运行包含特殊文件: ${rel}`);
    } };
    if (existing) {
      // Existing engines create logs, output and caches; only declared package files are hashed.
      for (const [key, meta] of expected) {
        const full = path.join(stage, ...meta.path.split('/'));
        const stat = fs.lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink() || !sameOrInside(canonicalPath(full), canonicalPath(stage))) throw new Error(`运行包文件路径无效: ${meta.path}`);
        let parent = path.dirname(full);
        while (parent !== stage) { if (fs.lstatSync(parent).isSymbolicLink()) throw new Error(`运行包含链接目录: ${meta.path}`); parent = path.dirname(parent); }
        actual.set(key, full);
      }
    } else walk(stage);
    if (actual.size !== expected.size) throw new Error('运行包实际文件与内部清单不一致');
    let verified = 0;
    for (const [key, meta] of expected) {
      const full = actual.get(key); if (!full) throw new Error(`运行包缺少文件: ${meta.path}`);
      const stat = fs.statSync(full); if (stat.size !== meta.bytes) throw new Error(`运行包文件大小错误: ${meta.path}`);
      const hash = await hashFile(full, bytes => this._set({
        downloadedBytes: verified + bytes,
        progress: declaredBytes ? Math.floor((verified + bytes) / declaredBytes * 100) : 100,
        message: '正在校验运行包文件，大模型校验期间请等待' }));
      if (hash.toLowerCase() !== meta.sha256.toLowerCase()) throw new Error(`运行包文件校验失败: ${meta.path}`);
      verified += meta.bytes;
      this._set({ progress: declaredBytes ? Math.floor(verified / declaredBytes * 100) : 100,
        downloadedBytes: verified,
        message: `正在校验运行包文件（${declaredBytes ? Math.floor(verified / declaredBytes * 100) : 100}%）` });
    }
    for (const required of manifest.requiredFiles) if (!actual.has(required.toLowerCase())) throw new Error(`运行包缺少必需文件: ${required}`);
  }
}

module.exports = { RuntimeManager, validateManifest, validateZip, safeRelative };
