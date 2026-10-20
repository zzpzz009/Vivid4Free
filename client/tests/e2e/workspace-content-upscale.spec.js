const { test, expect } = require('@playwright/test');
const path = require('path');

const workspaceState = ({ mockScenario = 'success', mockCancelAfterMs = 900 } = {}) => ({
  activeRightTab: 'common',
  activeWorkspaceTab: 'workspace',
  isRightPanelExpanded: false,
  useGenerationMock: true,
  mockScenario,
  mockFailAtPercent: 70,
  mockFailRate: 0,
  mockCancelAfterMs
});

async function primeWorkspace(page, options = {}) {
  const persistedState = workspaceState(options);
  await page.addInitScript((state) => {
    localStorage.setItem('ui:rightPanel', JSON.stringify(state));
    localStorage.setItem('username', 'dev');
    localStorage.setItem('loginUser', String(Date.now()));
    localStorage.setItem('logindata', JSON.stringify({ data: { token: 'e2e-token' } }));
  }, persistedState);

  await page.route('**/upload/image', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'workspace-floorplan.png' })
    });
  });

  await page.route('**/infoaccountadmin/vivid/track/log', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, msg: 'ok' })
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="unified-sidebar"]')).toBeVisible();
}

async function uploadFloorplan(page) {
  const fixturePath = path.join(__dirname, 'fixtures', 'test-main-image.jpg');
  await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
  await expect(page.locator('button[title="清空基础图"]')).toBeVisible();
}

async function switchToUpscale(page) {
  await page.locator('[data-testid="primary-action-dropdown"]').click();
  await page.getByRole('menuitem', { name: '放大', exact: true }).click();
  await expect(page.locator('[data-testid="primary-action-button"][data-mode="workspace"]')).toContainText('放大');
}

test.describe('WorkspaceContent 放大链路', () => {
  test('放大任务可进入运行态并允许取消', async ({ page }) => {
    await primeWorkspace(page, { mockScenario: 'success' });
    await uploadFloorplan(page);
    await switchToUpscale(page);

    const primaryButton = page.locator('[data-testid="primary-action-button"][data-mode="workspace"]');
    const cancelButton = page.locator('[data-testid="cancel-button"][data-mode="workspace"]');

    await primaryButton.click();

    await expect(primaryButton).toContainText('放大中...');
    await expect(cancelButton).toBeEnabled();
    await expect(page.locator('.toast-outer').filter({ hasText: '模拟生成已开始（将于30-60秒内提示成功）' })).toBeVisible();

    await cancelButton.click();

    await expect(page.locator('.toast-outer').filter({ hasText: '取消成功' })).toBeVisible();
    await expect(primaryButton).toContainText('放大');
    await expect(primaryButton).toBeEnabled();
    await expect(cancelButton).toBeDisabled();
  });
});
