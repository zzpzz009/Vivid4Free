const fs = require('node:fs');
const path = require('node:path');

// The native boundary owns Electron objects. Services and the UI consume only
// the shell contract or the small storage/network ports returned below.
function createElectronAdapter(electron = require('electron')) {
  const { app, BrowserWindow, dialog, ipcMain, shell, safeStorage, net } = electron;
  let window, closing = false;
  const runtimeSnapshot = ({ manager, getEngineReady, clientPolicy }) => ({
    ...manager.status(), engineReady: getEngineReady(), clientUpdateConfigured: Boolean(clientPolicy.clientDownloadUrl)
  });
  const outputDirectory = ({ runtimeRoot, root }) => path.join(runtimeRoot() || root, 'output');
  return {
    get isPackaged() { return app.isPackaged; },
    userData: () => app.getPath('userData'),
    executablePath: () => app.getPath('exe'),
    version: () => app.getVersion(),
    fetch: (url, options) => net.fetch(url, options),
    secureStorage: {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: value => safeStorage.encryptString(value),
      decryptString: value => safeStorage.decryptString(value)
    },
    clientControl: (workflows, services = {}) => ({
      status: () => ({ version: app.getVersion(), window: { available: Boolean(window && !window.isDestroyed()),
        visible: Boolean(window && !window.isDestroyed() && window.isVisible()),
        maximized: Boolean(window && !window.isDestroyed() && window.isMaximized()),
        fullscreen: Boolean(window && !window.isDestroyed() && window.isFullScreen()),
        bounds: window && !window.isDestroyed() ? window.getBounds() : null },
        workflowSha256: workflows.sha256('render'), operations: ['status', 'screenshot', 'show-task', 'shutdown',
          'runtime-status', 'runtime-check', 'runtime-connect', 'account-refresh', 'output-info', 'open-output', 'gallery-import'] }),
      runtimeStatus: () => runtimeSnapshot(services),
      checkRuntime: () => services.manager.check(),
      connectRuntimeDirectory: directory => services.manager.connectDirectory(directory),
      refreshAccount: async () => {
        const { status } = await services.account.refresh();
        return { status, signedIn: status === 'signed_in' };
      },
      outputInfo: () => {
        const directory = outputDirectory(services);
        return { path: directory, exists: fs.existsSync(directory) };
      },
      openOutput: async () => {
        const directory = outputDirectory(services);
        const exists = fs.existsSync(directory);
        const error = await shell.openPath(directory);
        return { path: directory, exists, opened: error === '', error: error || null };
      },
      screenshot: async () => {
        if (!window || window.isDestroyed()) throw Object.assign(new Error('客户端窗口不可用'), { status: 503 });
        return (await window.webContents.capturePage()).toPNG();
      },
      showTask: task => {
        if (!window || window.isDestroyed()) throw Object.assign(new Error('客户端窗口不可用'), { status: 503 });
        window.webContents.send('agent:show-task', task); window.show();
      },
      shutdown: () => app.quit()
    }),
    async openWorkspace({ server, account, manager, clientPolicy, runtimeRoot, root, tokenPath, startEngine, getEngineReady }) {
      window = new BrowserWindow({ width: 1500, height: 960, minWidth: 640, minHeight: 720, title: 'VividAI 本地渲染', frame: false, thickFrame: true, autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets', 'app-icon.ico'),
        backgroundColor: '#0F0D13', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      const sender = event => {
        const frame = event.senderFrame;
        if (event.sender !== window.webContents || frame !== window.webContents.mainFrame || !frame.url.startsWith(`${server.origin}/`)) throw new Error('不允许的调用来源');
      };
      const signedInSender = event => {
        sender(event);
        if (account.status().status !== 'signed_in') throw new Error('请先登录客户端');
      };
      window.removeMenu();
      const windowState = () => ({ maximized: window.isMaximized(), fullscreen: window.isFullScreen() });
      const publishWindowState = () => { if (!window.isDestroyed()) window.webContents.send('window:state-changed', windowState()); };
      for (const name of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) window.on(name, publishWindowState);
      ipcMain.handle('window:state', event => { sender(event); return windowState(); });
      ipcMain.handle('window:action', (event, action) => {
        sender(event);
        if (action === 'minimize') window.minimize();
        else if (action === 'toggle-maximize') {
          if (window.isFullScreen()) window.setFullScreen(false);
          else if (window.isMaximized()) window.unmaximize();
          else window.maximize();
        } else if (action === 'close') window.close();
        else throw new Error('不支持的窗口操作');
      });
      const accountAction = operation => async (event, input) => {
        sender(event);
        try { return await operation(input); }
        catch { return { ...account.status(), status: 'unavailable', message: '账号操作暂时无法完成，请检查网络或本机用户目录权限' }; }
      };
      ipcMain.handle('account:status', accountAction(() => account.status()));
      ipcMain.handle('account:login', accountAction(input => account.login(input)));
      ipcMain.handle('account:refresh', accountAction(() => account.refresh()));
      ipcMain.handle('account:logout', accountAction(() => account.logout()));
      ipcMain.handle('app:enter', event => {
        signedInSender(event);
        if (runtimeRoot()) void startEngine({ background: true }).catch(() => {});
        return { entered: true };
      });
      ipcMain.handle('account:reset-password', async event => {
        sender(event);
        try { await shell.openExternal(await account.passwordResetUrl()); return { opened: true }; }
        catch { return { opened: false, message: '找回密码入口暂时无法打开，请稍后重试或联系管理员' }; }
      });
      let registrationOpening = null;
      ipcMain.handle('account:register', async event => {
        sender(event);
        if (registrationOpening) return registrationOpening;
        registrationOpening = (async () => {
          try { await shell.openExternal(await account.registrationUrl()); return { opened: true, message: '注册页面已打开，请在浏览器完成注册后返回客户端登录' }; }
          catch { return { opened: false, message: '注册入口暂时无法打开，请稍后重试或联系管理员' }; }
        })();
        try { return await registrationOpening; } finally { registrationOpening = null; }
      });
      ipcMain.handle('gallery:import', async event => {
        signedInSender(event);
        const result = await dialog.showOpenDialog(window, { title: '导入本地图库文件夹', properties: ['openDirectory'] });
        if (result.canceled) return { added: 0, cancelled: true };
        return server.importGalleryDirectory(result.filePaths[0]);
      });
      ipcMain.handle('agent:info', event => { signedInSender(event); return { endpoint: `${server.agentOrigin}/v1`, tokenFile: tokenPath, version: '1.0' }; });
      ipcMain.handle('output:open', event => { signedInSender(event); return shell.openPath(outputDirectory({ runtimeRoot, root })); });
      ipcMain.handle('runtime:status', event => { signedInSender(event); return runtimeSnapshot({ manager, getEngineReady, clientPolicy }); });
      ipcMain.handle('client:open-update', async event => {
        signedInSender(event);
        try {
          const downloadUrl = manager.status().clientRelease?.downloadUrl || clientPolicy.clientDownloadUrl;
          if (!downloadUrl) throw new Error('客户端更新入口尚未配置');
          const url = new URL(downloadUrl);
          if (url.protocol !== 'https:' || url.username || url.password) throw new Error('客户端更新入口必须使用 HTTPS');
          await shell.openExternal(url.href);
          return { opened: true, message: '客户端更新页面已打开，安装新版客户端后请按兼容提示更新 引擎 ZIP' };
        } catch (error) { return { opened: false, message: error.message || '客户端更新入口暂时无法打开' }; }
      });
      ipcMain.handle('runtime:check', async event => { signedInSender(event); return manager.check(); });
      ipcMain.handle('runtime:open-download', async (event, provider) => {
        signedInSender(event);
        try {
          const source = manager.downloadSource(provider);
          await shell.openExternal(source.url);
          return { opened: true, message: `已打开${source.label}，请用官方客户端下载 ZIP，完成后返回客户端导入` };
        } catch (error) { return { opened: false, message: error.message || '网盘链接暂时无法打开，请重试' }; }
      });
      ipcMain.handle('runtime:install', async event => {
        signedInSender(event);
        const runtime = await manager.install();
        return { runtime, engine: { ready: getEngineReady(), error: runtime.error || null } };
      });
      ipcMain.handle('runtime:pause', event => { signedInSender(event); return manager.pause(); });
      ipcMain.handle('runtime:import-archive', async event => {
        signedInSender(event);
        const result = await dialog.showOpenDialog(window, { title: '导入通过网盘下载的官方 引擎 ZIP（无需解压）', properties: ['openFile'], filters: [{ name: '引擎 运行包', extensions: ['zip'] }] });
        if (result.canceled) return { cancelled: true };
        return manager.importArchive(result.filePaths[0]);
      });
      ipcMain.handle('runtime:connect-directory', async event => {
        signedInSender(event);
        const result = await dialog.showOpenDialog(window, { title: '选择含 runtime.json 的官方 引擎 版本目录', properties: ['openDirectory'] });
        if (result.canceled) return { cancelled: true };
        return manager.connectDirectory(result.filePaths[0]);
      });
      ipcMain.handle('runtime:choose-directory', async event => {
        signedInSender(event);
        for (;;) {
          const result = await dialog.showOpenDialog(window, { title: '选择引擎运行包存储目录', properties: ['openDirectory', 'createDirectory'] });
          if (result.canceled) return { cancelled: true, status: manager.status() };
          try { return { cancelled: false, status: manager.setStorageDirectory(result.filePaths[0]) }; }
          catch (error) { await dialog.showMessageBox(window, { type: 'warning', title: '请选择独立存储位置', message: error.message }); }
        }
      });
      ipcMain.handle('runtime:start-engine', async event => { signedInSender(event); return startEngine(); });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${server.origin}/`)) event.preventDefault(); });
      await window.loadURL(server.origin);
    },
    run(setup, cleanup) {
      if (process.platform === 'win32') app.setAppUserModelId('cn.vividai.desktop');
      if (process.env.VIVID_RUNTIME_ALLOW_LOCAL_TEST === '1' && process.env.VIVID_TEST_USER_DATA) {
        const testUserData = path.resolve(process.env.VIVID_TEST_USER_DATA);
        fs.mkdirSync(testUserData, { recursive: true });
        app.setPath('userData', testUserData);
      }
      if (!app.requestSingleInstanceLock()) { app.quit(); return; }
      app.on('second-instance', () => { window?.show(); window?.focus(); });
      app.on('window-all-closed', () => app.quit());
      app.on('before-quit', async event => {
        if (closing) return;
        event.preventDefault(); closing = true;
        try { await cleanup(); } catch {}
        app.quit();
      });
      return app.whenReady().then(setup).catch(async error => {
        await dialog.showMessageBox({ type: 'error', title: '客户端启动失败', message: error.message });
        app.quit();
      });
    }
  };
}

module.exports = { createElectronAdapter };
