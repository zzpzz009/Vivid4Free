const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function mountPanel(page) {
  await page.route('**/__runtime-consent-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="test-root"></div></body></html>' }));
  await page.goto('/__runtime-consent-test');
  await page.evaluate(async () => {
    // Use the same cache-versioned modules as the Vite-transformed component/store.
    const panelSource = await (await fetch('/src/components/RuntimeEnvironmentPanel.vue')).text();
    const storeSource = await (await fetch('/src/stores/useUIStore.js')).text();
    const { createApp, h, ref } = await import(panelSource.match(/from "([^"]*\/vue\.js[^"]*)"/)[1]);
    const { createPinia } = await import(storeSource.match(/from "([^"]*\/pinia\.js[^"]*)"/)[1]);
    const { default: Panel } = await import('/src/components/RuntimeEnvironmentPanel.vue');
    window.runtimeCalls = [];
    window.runtimeFailure = false;
    const status = { state: 'not_installed', installed: false, downloadConfigured: true, available: true,
      availableVersion: '0.3.2', availableCompatible: true, supportedRuntimeVersions: ['0.3.2'],
      downloadSources: [{ provider: 'quark', enabled: true }], storageDir: '' };
    window.vividDesktop = {
      runtimeStatus: async () => status,
      runtimeCheck: async () => status,
      runtimeOpenDownload: async (...args) => {
        window.runtimeCalls.push(['open', ...args]);
        return { opened: !window.runtimeFailure, message: window.runtimeFailure ? '网盘暂时无法打开' : '请手动下载后填写路径' };
      },
      chooseRuntimeDirectory: async () => { window.runtimeCalls.push(['choose']); status.storageDir = 'D:\\引擎'; return { status }; },
      runtimeImportArchive: async file => { window.runtimeCalls.push(['import', file]); return status; },
      runtimeInstall: async () => { throw new Error('Automatic download must not run'); }
    };
    const open = ref(true);
    window.reopenRuntimePanel = () => { open.value = true; };
    createApp({ setup: () => () => h(Panel, { open: open.value, onClose: () => { open.value = false; } }) }).use(createPinia()).mount('#test-root');
  });
  await expect(page.getByRole('button', { name: '打开夸克网盘' })).toBeEnabled();
}

test.beforeEach(async ({ page }) => mountPanel(page));

test('shows the exact NOTICE, requires fresh consent and supports cancel/close', async ({ page }) => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../NOTICE'), 'utf8').replace(/\r\n/g, '\n');
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await expect(page.getByRole('heading', { name: '第三方组件与模型声明' })).toBeVisible();
  expect((await page.getByLabel('第三方组件与模型声明全文').textContent()).replace(/\r\n/g, '\n')).toBe(source);
  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('button', { name: '同意并前往网盘' })).toBeDisabled();
  expect(await page.evaluate(() => window.runtimeCalls)).toEqual([]);
  await checkbox.check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '更新与安装' })).toBeVisible();
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await expect(checkbox).not.toBeChecked();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  expect(await page.evaluate(() => window.runtimeCalls)).toEqual([]);
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await checkbox.check();
  await page.getByRole('button', { name: '关闭更新与安装面板' }).click();
  await page.evaluate(() => window.reopenRuntimePanel());
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await expect(checkbox).not.toBeChecked();
});

test('opens only after consent and waits for an explicit ZIP path before installing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await page.getByRole('checkbox').check();
  await page.screenshot({ path: test.info().outputPath('notice-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '同意并前往网盘' }).click();
  await expect(page.getByLabel('已下载的引擎 ZIP 完整路径')).toBeFocused();
  expect(await page.evaluate(() => window.runtimeCalls)).toEqual([['open', 'quark', true]]);
  const install = page.getByRole('button', { name: '校验 ZIP 并安装' });
  await expect(install).toBeDisabled();
  const input = page.getByLabel('已下载的引擎 ZIP 完整路径');
  for (const value of ['relative.zip', 'D:\\Downloads\\file.zip.part', 'D:\\Downloads\\folder']) {
    await input.fill(value);
    await expect(install).toBeDisabled();
  }
  await input.fill('  "D:\\下载\\引擎.ZIP"  ');
  await expect(install).toBeEnabled();
  await install.click();
  await expect.poll(() => page.evaluate(() => window.runtimeCalls)).toEqual([
    ['open', 'quark', true], ['choose'], ['import', 'D:\\下载\\引擎.ZIP']
  ]);
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('failed navigation requires consent again and offline ZIP entry works independently', async ({ page }) => {
  await page.evaluate(() => { window.runtimeFailure = true; });
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '同意并前往网盘' }).click();
  await expect(page.getByRole('alert')).toHaveText('网盘暂时无法打开');
  await page.getByRole('button', { name: '打开夸克网盘' }).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByLabel('已下载的引擎 ZIP 完整路径').fill('\\\\server\\share\\引擎.zip');
  await page.getByRole('button', { name: '校验 ZIP 并安装' }).click();
  await expect.poll(() => page.evaluate(() => window.runtimeCalls)).toEqual([
    ['open', 'quark', true], ['choose'], ['import', '\\\\server\\share\\引擎.zip']
  ]);
});
