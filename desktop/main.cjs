const { createElectronAdapter } = require('./electron-adapter.cjs');
const host = createElectronAdapter();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { startServer } = require('./server.cjs');
const { openWorkflows } = require('./workflow-store.cjs');
const { RuntimeManager } = require('./runtime-manager.cjs');
const { createAccountService } = require('./account-service.cjs');
const clientPolicy = require('./client-runtime-policy.json');

let server, root, manager, account, ownedEngineRoot = null, engineReady = false, engineStartPromise = null, engineStartRoot = null;
function listenPort(variable, fallback) {
  if (process.env.VIVID_RUNTIME_ALLOW_LOCAL_TEST !== '1' || process.env[variable] === undefined) return fallback;
  const value = Number(process.env[variable]);
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error(`${variable}必须是0到65535的端口号`);
  return value;
}
function runtimeRoot() {
  const development = !host.isPackaged && process.env.VIVID_RUNTIME_DEV_PATH;
  return development ? path.resolve(development) : manager?.status().runtimeCompatible === false ? null : manager?.getRuntimeRoot();
}
function samePath(left, right) { return path.relative(path.resolve(left), path.resolve(right)) === ''; }
function engine(action, engineRoot = runtimeRoot()) {
  if (!engineRoot) return Promise.reject(new Error('尚未安装引擎运行包'));
  let info;
  try {
    const rootStat = fs.lstatSync(engineRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || !samePath(fs.realpathSync.native(engineRoot), engineRoot)) throw new Error('运行包根目录无效');
    const manifestFile = path.join(engineRoot, 'runtime.json'); const manifestStat = fs.lstatSync(manifestFile);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64 * 1024 * 1024) throw new Error('运行包清单无效');
    info = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (info.schemaVersion !== 1 || info.id !== 'vivid-comfy' || info.protocolVersion !== 1 || info.platform !== 'win32-x64' ||
        info.entry?.python !== 'python/python.exe' || info.entry?.launcher !== 'tools/start_comfy.py') throw new Error('运行包入口或协议不兼容');
  }
  catch { return Promise.reject(new Error('运行包缺少有效 runtime.json')); }
  const python = path.join(engineRoot, ...info.entry.python.split('/'));
  const launcher = path.join(engineRoot, ...info.entry.launcher.split('/'));
  for (const file of [python, launcher]) {
    try { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || !samePath(fs.realpathSync.native(file), file) || !path.resolve(file).startsWith(`${path.resolve(engineRoot)}${path.sep}`)) throw new Error(); }
    catch { return Promise.reject(new Error('运行包启动入口缺失或路径无效')); }
  }
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-s', '-X', 'utf8', launcher, action], {
      cwd: engineRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VIVID_RUNTIME_DIR: engineRoot }
    });
    let output = '';
    child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('本地引擎操作超时')); }, 150000);
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(output.slice(-1200) || `引擎${action}失败 (${code})`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
}
function startEngine(options = {}) {
  const target = options.runtimePath || runtimeRoot();
  if (!target) return startEngineOnce(options);
  if (engineStartPromise) {
    if (samePath(engineStartRoot, target)) return engineStartPromise;
    return Promise.reject(new Error('另一个运行包正在启动，当前操作未启动第二个引擎'));
  }
  engineStartRoot = target;
  engineStartPromise = startEngineOnce({ ...options, runtimePath: target }).finally(() => { engineStartPromise = null; engineStartRoot = null; });
  return engineStartPromise;
}
async function startEngineOnce({ background = false, runtimePath } = {}) {
  if (account?.status().status !== 'signed_in') return { ready: false, message: '请先登录客户端' };
  if (manager.status().runtimeCompatible === false) {
    engineReady = false;
    const error = manager.status().compatibilityMessage;
    manager._set({ state: 'installed', message: error, error });
    return { ready: false, error };
  }
  const engineRoot = runtimePath || runtimeRoot();
  if (!engineRoot) {
    engineReady = false;
    manager.refreshInstalled();
    return { ready: false, message: '引擎运行包尚未安装' };
  }
  manager._set({ state: 'starting', message: '正在启动本地引擎', error: null });
  try {
    try { await engine('status', engineRoot); }
    catch { await engine('start', engineRoot); ownedEngineRoot = engineRoot; }
    engineReady = true;
    const capabilities = await server.service.capabilities();
    if (!capabilities.capabilities.render.ready || !capabilities.capabilities.upscale.ready) {
      const missing = [...capabilities.capabilities.render.missing, ...capabilities.capabilities.upscale.missing];
      throw new Error(`运行包与当前客户端工作流不兼容，请使用更新的官方 引擎 包。缺少：${[...new Set(missing)].slice(0, 8).join('、') || '引擎能力'}`);
    }
    manager._set({ state: 'ready', message: '本地引擎已就绪', error: null });
    return { ready: true, message: '本地引擎已就绪' };
  } catch (error) {
    engineReady = false;
    if (ownedEngineRoot && samePath(ownedEngineRoot, engineRoot)) {
      try { await engine('stop', engineRoot); ownedEngineRoot = null; }
      catch (stopError) { throw new Error(`${error.message}；未能停止本次启动的引擎：${stopError.message}`); }
    }
    manager._set({ state: manager.status().installed ? 'installed' : 'error', message: '运行包已安装，但引擎启动失败', error: error.message });
    if (!background) throw error;
    return { ready: false, message: '运行包已安装，但引擎启动失败', error: error.message };
  }
}
function enginePortOpen() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 18295 });
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(1000, () => done(false));
  });
}
async function beforeRuntimeActivate({ previousRoot }) {
  if (!previousRoot) return null;
  if (!await enginePortOpen()) return null;
  const oldRoot = previousRoot;
  if (!oldRoot || !ownedEngineRoot || !samePath(oldRoot, ownedEngineRoot)) {
    throw new Error('检测到本地引擎由其他客户端或进程运行；关闭该引擎后再安装新版运行包');
  }
  try { await engine('status', oldRoot); }
  catch { throw new Error('当前引擎身份校验失败，未切换运行包'); }
  let queue;
  try {
    const response = await fetch('http://127.0.0.1:18295/queue', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(); queue = await response.json();
  } catch { throw new Error('无法确认当前引擎队列状态，未切换运行包'); }
  if ((queue.queue_running || []).length || (queue.queue_pending || []).length) throw new Error('引擎队列仍有任务，完成或清空任务后再更新运行包');
  await engine('stop', oldRoot); ownedEngineRoot = null; engineReady = false;
  return async () => {
    const restored = await startEngine({ runtimePath: oldRoot, background: true });
    if (!restored.ready) throw new Error(restored.error || '旧版引擎恢复失败');
  };
}

host.run(async () => {
  root = host.userData();
  fs.mkdirSync(root, { recursive: true });
  account = createAccountService({ userData: root, secureStorage: host.secureStorage,
    fetchImpl: host.fetch });
  manager = new RuntimeManager({ userData: root, feedPath: path.join(__dirname, 'runtime-feed.json'),
    fetchImpl: host.fetch,
    clientVersion: host.version(), supportedRuntimeVersions: clientPolicy.supportedRuntimeVersions, compatibilityNote: clientPolicy.note,
    forbiddenRoots: [path.dirname(host.executablePath())], beforeActivate: beforeRuntimeActivate,
    afterActivate: ({ runtimeRoot: installedRoot }) => startEngine({ runtimePath: installedRoot, background: false }) });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenPath = path.join(root, 'agent-control.json');
  const workflows = openWorkflows();
  server = await startServer({ root, uiDir: path.join(__dirname, 'ui'), workflows,
    runtimeRoot, runtimeStatus: () => ({ ...manager.status(), engineReady }), accountStatus: () => account.status(), agentToken: token,
    port: listenPort('VIVID_TEST_UI_PORT', 17860), agentPort: listenPort('VIVID_TEST_AGENT_PORT', 17861),
    clientControl: host.clientControl(workflows) });
  fs.writeFileSync(tokenPath, JSON.stringify({ endpoint: `${server.agentOrigin}/v1`, token, protocolVersion: '1.0' }, null, 2));
  await host.openWorkspace({ server, account, manager, clientPolicy, runtimeRoot, root, tokenPath,
    startEngine, getEngineReady: () => engineReady });
}, async () => {
  await manager?.pause();
  await server?.close();
  if (ownedEngineRoot) await engine('stop', ownedEngineRoot);
});
