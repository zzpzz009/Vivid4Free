/**
 * E2E Test for Button Identification
 * Tests that buttons can be correctly identified with data-testid attributes
 */

const { test, expect } = require('@playwright/test');
const { setAuthToken } = require('./utils/auth.js');
const { takeTimestampedScreenshot } = require('./utils/test-helpers.js');

test.describe('Button Identification Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await setAuthToken(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(3000);
  });

  test('Identify buttons in workspace mode', async ({ page }) => {
    await test.step('Switch to workspace tab', async () => {
      const workspaceTab = page.locator('[data-testid="workspace-tab-workspace"]');
      if (await workspaceTab.isVisible()) {
        await workspaceTab.click();
        console.log('✅ Switched to workspace tab');
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Check for preview button', async () => {
      // Check for preview button with data-testid
      const previewButtonWithTestId = page.locator('[data-testid="preview-button"]');
      const previewButtonWithMode = page.locator('[data-testid="preview-button"][data-mode="workspace"]');
      const previewButtonText = page.locator('button:has-text("预览")');
      
      console.log(`Preview button with data-testid count: ${await previewButtonWithTestId.count()}`);
      console.log(`Preview button with mode count: ${await previewButtonWithMode.count()}`);
      console.log(`Preview button with text count: ${await previewButtonText.count()}`);
      
      if (await previewButtonWithTestId.count() > 0) {
        const mode = await previewButtonWithTestId.getAttribute('data-mode');
        console.log(`✅ Found preview button with data-testid, mode: ${mode}`);
      }
      
      // Take screenshot
      await takeTimestampedScreenshot(page, 'workspace-buttons');
    });

    await test.step('Check for generate button', async () => {
      // Check for generate button with data-testid
      const generateButtonWithTestId = page.locator('[data-testid="generate-button"]');
      const generateButtonWithMode = page.locator('[data-testid="generate-button"][data-mode="workspace"]');
      const generateButtonText = page.locator('button:has-text("生成")');
      
      console.log(`Generate button with data-testid count: ${await generateButtonWithTestId.count()}`);
      console.log(`Generate button with mode count: ${await generateButtonWithMode.count()}`);
      console.log(`Generate button with text count: ${await generateButtonText.count()}`);
      
      if (await generateButtonWithTestId.count() > 0) {
        const mode = await generateButtonWithTestId.getAttribute('data-mode');
        console.log(`✅ Found generate button with data-testid, mode: ${mode}`);
      }
    });
  });

  test('Identify buttons in batch preview mode', async ({ page }) => {
    await test.step('Switch to batch preview tab', async () => {
      const batchPreviewTab = page.locator('[data-testid="workspace-tab-batch-preview"]');
      if (await batchPreviewTab.isVisible()) {
        await batchPreviewTab.click();
        console.log('✅ Switched to batch preview tab');
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Check for preview button in batch mode', async () => {
      // Check for preview button with data-testid
      const previewButtonWithTestId = page.locator('[data-testid="preview-button"]');
      const previewButtonWithMode = page.locator('[data-testid="preview-button"][data-mode="batch-preview"]');
      const previewButtonText = page.locator('button:has-text("预览")');
      
      console.log(`Batch preview button with data-testid count: ${await previewButtonWithTestId.count()}`);
      console.log(`Batch preview button with mode count: ${await previewButtonWithMode.count()}`);
      console.log(`Batch preview button with text count: ${await previewButtonText.count()}`);
      
      if (await previewButtonWithTestId.count() > 0) {
        const mode = await previewButtonWithTestId.getAttribute('data-mode');
        console.log(`✅ Found batch preview button with data-testid, mode: ${mode}`);
      }
      
      // Take screenshot
      await takeTimestampedScreenshot(page, 'batch-preview-buttons');
    });

    await test.step('Check for generate button in batch mode', async () => {
      // Check for generate button with data-testid
      const generateButtonWithTestId = page.locator('[data-testid="generate-button"]');
      const generateButtonWithMode = page.locator('[data-testid="generate-button"][data-mode="batch-preview"]');
      const generateButtonText = page.locator('button:has-text("生成")');
      
      console.log(`Batch generate button with data-testid count: ${await generateButtonWithTestId.count()}`);
      console.log(`Batch generate button with mode count: ${await generateButtonWithMode.count()}`);
      console.log(`Batch generate button with text count: ${await generateButtonText.count()}`);
      
      if (await generateButtonWithTestId.count() > 0) {
        const mode = await generateButtonWithTestId.getAttribute('data-mode');
        console.log(`✅ Found batch generate button with data-testid, mode: ${mode}`);
      }
    });
  });

  test('Identify buttons in local repaint mode', async ({ page }) => {
    await test.step('Switch to local repaint tab', async () => {
      const localRepaintTab = page.locator('[data-testid="workspace-tab-local-repaint"]');
      if (await localRepaintTab.isVisible()) {
        await localRepaintTab.click();
        console.log('✅ Switched to local repaint tab');
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Check for generate button in local repaint mode', async () => {
      // In local repaint mode, there should be no preview button, only generate
      const previewButtonWithTestId = page.locator('[data-testid="preview-button"]');
      const generateButtonSimple = page.locator('[data-testid="generate-button-simple"]');
      const generateButtonWithMode = page.locator('[data-testid="generate-button-simple"][data-mode="local-repaint"]');
      
      console.log(`Local repaint preview button count: ${await previewButtonWithTestId.count()}`);
      console.log(`Local repaint generate button simple count: ${await generateButtonSimple.count()}`);
      console.log(`Local repaint generate button with mode count: ${await generateButtonWithMode.count()}`);
      
      if (await generateButtonSimple.count() > 0) {
        const mode = await generateButtonSimple.getAttribute('data-mode');
        console.log(`✅ Found local repaint generate button with data-testid, mode: ${mode}`);
      }
      
      // Take screenshot
      await takeTimestampedScreenshot(page, 'local-repaint-buttons');
    });
  });

  test('Debug DOM structure', async ({ page }) => {
    await test.step('Inspect DOM for button elements', async () => {
      // Get all buttons
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Total buttons found: ${buttonCount}`);
      
      // Get all elements with data-testid
      const elementsWithTestId = page.locator('[data-testid]');
      const testIdCount = await elementsWithTestId.count();
      console.log(`Total elements with data-testid: ${testIdCount}`);
      
      // List all data-testid values
      for (let i = 0; i < Math.min(testIdCount, 10); i++) {
        const element = elementsWithTestId.nth(i);
        const testId = await element.getAttribute('data-testid');
        const tagName = await element.evaluate(el => el.tagName);
        console.log(`Element ${i}: ${tagName} with data-testid="${testId}"`);
      }
      
      // Take screenshot for debugging
      await takeTimestampedScreenshot(page, 'dom-debug');
    });
  });
});
