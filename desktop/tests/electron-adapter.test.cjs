const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createElectronAdapter } = require('../electron-adapter.cjs');

function fixture() {
  const handlers = new Map(), sent = [], opened = [];
  let win, signedIn = false, engineReady = false;
  const runtime = { state: 'installed', installed: true };
  const account = { status: () => ({ status: signedIn ? 'signed_in' : 'signed_out' }),
    login: async input => ({ status: input.username ? 'signed_in' : 'signed_out' }),
    refresh: async () => account.status(), logout: async () => { signedIn = false; return account.status(); },
    passwordResetUrl: async () => 'https://www.vividai.com.cn/reset', registrationUrl: async () => 'https://www.vividai.com.cn/signup' };
  class Window extends EventEmitter {
    constructor(options) {
      super(); win = this; this.options = options; this.maximized = false; this.fullscreen = false; this.visible = true;
      this.webContents = new EventEmitter(); this.webContents.mainFrame = { url: 'http://127.0.0.1:27860/' };
      this.webContents.send = (...args) => sent.push(args);
      this.webContents.setWindowOpenHandler = handler => { this.openHandler = handler; };
      this.webContents.capturePage = async () => ({ toPNG: () => Buffer.from('png') });
    }
    isDestroyed() { return false; }
    isVisible() { return this.visible; }
    isMaximized() { return this.maximized; }
    isFullScreen() { return this.fullscreen; }
    maximize() { this.maximized = true; this.emit('maximize'); }
    unmaximize() { this.maximized = false; this.emit('unmaximize'); }
    setFullScreen(value) { this.fullscreen = value; this.emit(value ? 'enter-full-screen' : 'leave-full-screen'); }
    minimize() { this.minimized = true; }
    close() { this.closed = true; }
    show() { this.visible = true; }
    focus() { this.focused = true; }
    removeMenu() {}
    async loadURL(url) { this.loaded = url; }
  }
  const app = new EventEmitter();
  Object.assign(app, { isPackaged: true, getPath: key => `/fixture/${key}`, getVersion: () => '0.7.1',
    setAppUserModelId() {}, requestSingleInstanceLock: () => true, whenReady: async () => {}, quit: () => { app.quits = (app.quits || 0) + 1; } });
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showMessageBox: async () => {} };
  const shell = { openExternal: async value => { opened.push(value); }, openPath: async value => { opened.push(value); return ''; } };
  const secure = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value), decryptString: value => value.toString() };
  const host = createElectronAdapter({ app, BrowserWindow: Window, dialog, shell, safeStorage: secure,
    ipcMain: { handle: (channel, handler) => { assert.ok(!handlers.has(channel)); handlers.set(channel, handler); } },
    net: { fetch: async (url, options) => ({ url, options }) } });
  const manager = { status: () => runtime, check: async () => runtime, pause: async () => true,
    install: async () => { engineReady = true; return runtime; }, importArchive: async file => ({ ...runtime, file }),
    connectDirectory: async directory => ({ ...runtime, directory }), setStorageDirectory: directory => ({ ...runtime, directory }),
    downloadSource: () => ({ label: '夸克', url: 'https://pan.quark.cn/s/fixture' }) };
  const services = { server: { origin: 'http://127.0.0.1:27860', agentOrigin: 'http://127.0.0.1:27861', importGallery: () => ({ added: 0, total: 0 }) },
    root: '/fixture/user', tokenPath: '/fixture/control.json', clientPolicy: { clientDownloadUrl: 'https://example.com/download' },
    account, manager, runtimeRoot: () => null, startEngine: async () => ({ ready: engineReady }), getEngineReady: () => engineReady };
  return { host, services, app, dialog, shell, handlers, opened, sent, runtime, account, manager,
    get win() { return win; }, setSignedIn(value) { signedIn = value; },
    open: () => host.openWorkspace(services),
    invoke: (channel, ...args) => Promise.resolve().then(() => handlers.get(channel)({ sender: win.webContents, senderFrame: win.webContents.mainFrame }, ...args)) };
}

test('preload is a closed 22-operation and 2-event boundary matching the published manifest', async () => {
  const contract = require('../../contracts/shell-contract.json');
  let bridge;
  const renderer = new EventEmitter(); const calls = [];
  renderer.invoke = async (...args) => { calls.push(args); return 'returned'; };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.cjs'), 'utf8'), {
    require(name) { assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, 'vividDesktop'); bridge = value; } }, ipcRenderer: renderer }; }
  });
  assert.equal(contract.operations.length, 22); assert.equal(contract.events.length, 2);
  assert.deepEqual(Object.keys(bridge).sort(), [...contract.operations, ...contract.events].map(item => item.name).sort());
  assert.ok(Object.isFrozen(bridge));
  for (const operation of contract.operations) {
    await bridge[operation.name]('input'); assert.equal(calls.at(-1)[0], operation.channel);
  }
  for (const event of contract.events) {
    const payloads = []; const off = bridge[event.name](value => payloads.push(value));
    const payload = { value: 'public' }; renderer.emit(event.channel, { sender: 'private-native-object' }, payload);
    assert.deepEqual(payloads, [payload]); off(); off(); renderer.emit(event.channel, {}, { value: 'late' });
    assert.equal(payloads.length, 1); assert.equal(renderer.listenerCount(event.channel), 0);
  }
});

test('every native operation rejects foreign windows, child frames and foreign origins', async () => {
  const f = fixture(); await f.open(); f.setSignedIn(true);
  const contract = require('../../contracts/shell-contract.json');
  assert.deepEqual([...f.handlers.keys()].sort(), contract.operations.map(item => item.channel).sort());
  for (const handler of f.handlers.values()) {
    for (const event of [
      { sender: {}, senderFrame: f.win.webContents.mainFrame },
      { sender: f.win.webContents, senderFrame: { url: f.win.loaded } }
    ]) await assert.rejects(async () => handler(event), /不允许的调用来源/);
    const original = f.win.webContents.mainFrame.url;
    f.win.webContents.mainFrame.url = 'http://127.0.0.1:27860.evil/';
    await assert.rejects(async () => handler({ sender: f.win.webContents, senderFrame: f.win.webContents.mainFrame }), /不允许的调用来源/);
    f.win.webContents.mainFrame.url = original;
  }
});

test('all signed-in operations deny a signed-out account before native side effects', async () => {
  const f = fixture(); await f.open();
  const operations = require('../../contracts/shell-contract.json').operations.filter(item => item.access === 'signed-in');
  assert.equal(operations.length, 14);
  f.dialog.showOpenDialog = () => { throw new Error('dialog must not open'); };
  for (const operation of operations) await assert.rejects(f.invoke(operation.channel), /请先登录客户端/);
  assert.deepEqual(f.opened, []);
  assert.deepEqual(await f.invoke('account:status'), { status: 'signed_out' });
});

test('window controls preserve fullscreen restoration, payload and void results', async () => {
  const f = fixture(); await f.open();
  assert.deepEqual(f.win.options.webPreferences, { preload: path.resolve(__dirname, '../preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true });
  assert.equal(await f.invoke('window:action', 'toggle-maximize'), undefined);
  assert.deepEqual(await f.invoke('window:state'), { maximized: true, fullscreen: false });
  assert.deepEqual(f.sent.at(-1), ['window:state-changed', { maximized: true, fullscreen: false }]);
  f.win.setFullScreen(true); await f.invoke('window:action', 'toggle-maximize'); assert.equal(f.win.fullscreen, false);
  await assert.rejects(f.invoke('window:action', 'unrecognized'), /不支持/);
  assert.deepEqual(f.win.openHandler(), { action: 'deny' });
  let prevented = false; f.win.webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://example.com'); assert.ok(prevented);
});

test('native picker cancellation remains distinct from success and failure', async () => {
  const f = fixture(); await f.open(); f.setSignedIn(true);
  assert.deepEqual(await f.invoke('gallery:import'), { added: 0, cancelled: true });
  for (const channel of ['runtime:import-archive', 'runtime:connect-directory']) assert.deepEqual(await f.invoke(channel), { cancelled: true });
  assert.deepEqual(await f.invoke('runtime:choose-directory'), { cancelled: true, status: f.runtime });
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['/selected/file.zip'] });
  assert.deepEqual(await f.invoke('runtime:import-archive'), { ...f.runtime, file: '/selected/file.zip' });
  assert.deepEqual(await f.invoke('runtime:connect-directory'), { ...f.runtime, directory: '/selected/file.zip' });
});

test('runtime snapshots observe live readiness and preserve operation-specific results', async () => {
  const f = fixture(); await f.open(); f.setSignedIn(true);
  assert.equal((await f.invoke('runtime:status')).engineReady, false);
  assert.deepEqual(await f.invoke('runtime:install'), { runtime: f.runtime, engine: { ready: true, error: null } });
  assert.equal((await f.invoke('runtime:status')).engineReady, true);
  assert.equal(await f.invoke('runtime:pause'), true); assert.equal(await f.invoke('output:open'), '');
  assert.deepEqual(await f.invoke('agent:info'), { endpoint: 'http://127.0.0.1:27861/v1', tokenFile: '/fixture/control.json', version: '1.0' });
});

test('account failures remain sanitized and concurrent registration opens once', async () => {
  const f = fixture(); await f.open();
  f.account.login = async () => { throw new Error('private-provider-payload'); };
  const failure = await f.invoke('account:login', { username: 'fixture', password: 'one-use' });
  assert.equal(failure.status, 'unavailable'); assert.ok(!failure.message.includes('private-provider-payload'));
  let release; f.shell.openExternal = () => new Promise(resolve => { f.opened.push('signup'); release = resolve; });
  const first = f.invoke('account:register'), second = f.invoke('account:register');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.opened.length, 1); release();
  assert.deepEqual(await first, await second);
});

test('client controls expose native status, image bytes and only task payload events', async () => {
  const f = fixture(); const control = f.host.clientControl({ sha256: () => 'workflow-hash' });
  await assert.rejects(control.screenshot(), { status: 503 }); await f.open();
  assert.equal(control.status().window.available, true); assert.deepEqual(await control.screenshot(), Buffer.from('png'));
  const task = { id: 'task-fixture', status: 'completed', resultImages: ['/view?filename=result.png'] };
  control.showTask(task); assert.deepEqual(f.sent.at(-1), ['agent:show-task', task]);
});

test('native lifecycle runs cleanup once and uses isolated native storage/network ports', async () => {
  const f = fixture(); let setups = 0, cleanups = 0;
  await f.host.run(async () => { setups++; }, async () => { cleanups++; });
  assert.equal(setups, 1); assert.equal(f.host.isPackaged, true); assert.equal(f.host.version(), '0.7.1');
  assert.equal(f.host.userData(), '/fixture/userData'); assert.equal(f.host.secureStorage.isEncryptionAvailable(), true);
  assert.equal(f.host.secureStorage.decryptString(f.host.secureStorage.encryptString('ephemeral')), 'ephemeral');
  assert.deepEqual(await f.host.fetch('https://example.com', { method: 'GET' }), { url: 'https://example.com', options: { method: 'GET' } });
  const quit = f.app.listeners('before-quit')[0]; let prevented = 0;
  await quit({ preventDefault() { prevented++; } }); await quit({ preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(cleanups, 1); assert.equal(f.app.quits, 1);
});
