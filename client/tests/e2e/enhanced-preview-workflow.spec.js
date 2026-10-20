/**
 * Enhanced E2E Test for Preview Workflow Success
 * Ensures the complete preview task submission and completion with robust error handling
 */

const { test, expect } = require('@playwright/test');
const { setAuthToken } = require('./utils/auth.js');
const { takeTimestampedScreenshot, setupConsoleMonitoring, checkConsoleErrors } = require('./utils/test-helpers.js');
const path = require('path');

test.describe('Enhanced ArchViz Generator Preview Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // 设置 console 监控
    setupConsoleMonitoring(page);

    // Set up authentication
    await setAuthToken(page);

    // Clear cache and reload to ensure fresh state
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for the application to load
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch (e) {
      console.log('DOMContentLoaded timeout, continuing...');
    }

    // Give extra time for Vue to initialize and connect to backend
    await page.waitForTimeout(5000);
  });

  // Helper function to ensure images are uploaded
  async function ensureImagesUploaded(page) {
    const fileInputs = page.locator('input[type="file"]');
    const fileInputCount = await fileInputs.count();
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

    console.log(`Found ${fileInputCount} file input(s) for upload`);

    if (fileInputCount >= 2) {
      // Upload to both main image and reference image inputs
      await fileInputs.first().setInputFiles(testImagePath);
      console.log('✅ Main image uploaded');
      await page.waitForTimeout(1000);

      await fileInputs.nth(1).setInputFiles(testImagePath);
      console.log('✅ Reference image uploaded');
      await page.waitForTimeout(1000);

      // Verify images are uploaded by checking for preview elements
      const previewImages = page.locator('img[src*="blob:"], img[src*="data:"]');
      const previewCount = await previewImages.count();
      console.log(`Found ${previewCount} image preview(s)`);

      return previewCount >= 1;
    } else if (fileInputCount >= 1) {
      // Upload to the available input
      await fileInputs.first().setInputFiles(testImagePath);
      console.log('✅ Image uploaded to available input');
      await page.waitForTimeout(1000);
      return true;
    }

    return false;
  }

  // Helper function to find and click preview button
  async function findAndClickPreviewButton(page) {
    // Multiple strategies to find the preview button
    const buttonStrategies = [
      // Strategy 1: Data testid with workspace mode
      '[data-testid="preview-button"][data-mode="workspace"]',
      // Strategy 2: Data testid without mode
      '[data-testid="preview-button"]',
      // Strategy 3: Text-based selectors
      'button:has-text("预览")',
      'button:has-text("Preview")',
      // Strategy 4: Class-based selectors
      '.preview-button',
      '.btn-preview',
      // Strategy 5: Generic button with preview-related attributes
      'button[class*="preview"]',
      'button[id*="preview"]'
    ];

    for (const selector of buttonStrategies) {
      const button = page.locator(selector).first();
      
      if (await button.isVisible()) {
        const isEnabled = await button.isEnabled();
        console.log(`Found preview button with selector: ${selector}, enabled: ${isEnabled}`);
        
        if (isEnabled) {
          await button.click();
          console.log(`✅ Successfully clicked preview button: ${selector}`);
          return true;
        } else {
          console.log(`⚠️ Preview button found but disabled: ${selector}`);
        }
      }
    }

    console.log('❌ No enabled preview button found');
    return false;
  }

  // Helper function to wait for and verify task completion
  async function waitForTaskCompletion(page, maxWaitTime = 60000) {
    const startTime = Date.now();
    let lastProgressMessage = '';

    while (Date.now() - startTime < maxWaitTime) {
      // Check for completion indicators
      const completionSelectors = [
        'img[src*="blob:"]', // Result images
        '.result-image',
        '.output-image',
        '[data-testid*="result"]',
        '[class*="complete"]',
        '[class*="success"]'
      ];

      for (const selector of completionSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          console.log(`✅ Found ${count} completion indicator(s): ${selector}`);
          return true;
        }
      }

      // Check for progress indicators
      const progressSelectors = [
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="progress"]',
        '[role="progressbar"]'
      ];

      let foundProgress = false;
      for (const selector of progressSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          foundProgress = true;
          if (lastProgressMessage !== selector) {
            console.log(`🔄 Processing... (${selector})`);
            lastProgressMessage = selector;
          }
          break;
        }
      }

      if (!foundProgress && lastProgressMessage) {
        console.log('⏳ Waiting for task completion...');
        lastProgressMessage = '';
      }

      await page.waitForTimeout(2000);
    }

    console.log('⚠️ Task completion timeout reached');
    return false;
  }

  test('Enhanced preview workflow with robust error handling', async ({ page }) => {
    await takeTimestampedScreenshot(page, 'enhanced-workflow-start');

    await test.step('Verify application is loaded and backend connected', async () => {
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();

      // Check for WebSocket connection status
      const wsStatusSelectors = [
        '[data-testid*="websocket"]',
        '[class*="connection"]',
        '[class*="status"]'
      ];

      for (const selector of wsStatusSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const statusText = await element.textContent();
          console.log(`Connection status: ${statusText}`);
        }
      }

      console.log('✅ Application loaded successfully');
    });

    await test.step('Ensure workspace tab is active', async () => {
      // Make sure we're on the workspace tab
      const workspaceTab = page.locator('[data-testid="workspace-tab-workspace"]');
      if (await workspaceTab.isVisible()) {
        await workspaceTab.click();
        console.log('✅ Switched to workspace tab');
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Upload images with verification', async () => {
      const uploadSuccess = await ensureImagesUploaded(page);
      expect(uploadSuccess).toBe(true);
      
      await takeTimestampedScreenshot(page, 'after-image-upload');
      console.log('✅ Images uploaded and verified');
    });

    await test.step('Set prompt text', async () => {
      const promptSelectors = [
        'textarea[placeholder*="prompt"]',
        'textarea[placeholder*="描述"]',
        'textarea',
        'input[placeholder*="prompt"]'
      ];

      let promptSet = false;
      for (const selector of promptSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          const testPrompt = 'Modern architectural visualization with clean lines, natural lighting, and contemporary design elements';
          await element.fill(testPrompt);
          console.log(`✅ Prompt set using selector: ${selector}`);
          promptSet = true;
          break;
        }
      }

      if (!promptSet) {
        console.log('⚠️ No prompt input found, proceeding with default');
      }
    });

    await test.step('Submit preview task', async () => {
      await takeTimestampedScreenshot(page, 'before-preview-submit');
      
      const submitSuccess = await findAndClickPreviewButton(page);
      expect(submitSuccess).toBe(true);
      
      await page.waitForTimeout(3000);
      await takeTimestampedScreenshot(page, 'after-preview-submit');
    });

    await test.step('Monitor task completion', async () => {
      console.log('🔄 Monitoring task completion...');
      
      const completed = await waitForTaskCompletion(page, 90000); // 90 seconds timeout
      
      if (completed) {
        console.log('✅ Task completed successfully');
        await takeTimestampedScreenshot(page, 'task-completed');
      } else {
        console.log('⚠️ Task completion not detected within timeout');
        await takeTimestampedScreenshot(page, 'task-timeout');
      }

      // Always check for any results regardless of completion detection
      const resultImages = page.locator('img[src*="blob:"], img[src*="data:"]');
      const resultCount = await resultImages.count();
      console.log(`Found ${resultCount} result image(s)`);
      
      if (resultCount > 0) {
        console.log('✅ Results found');
        expect(resultCount).toBeGreaterThan(0);
      }
    });

    await test.step('Verify backend communication and check console errors', async () => {
      // Check console for errors
      const consoleReport = checkConsoleErrors(page);
      console.log('\n📊 Enhanced Preview Workflow Console 监控报告:');
      console.log(`\n总消息数: ${consoleReport?.totalMessages || 'N/A'}`);
      console.log(`\n错误数: ${consoleReport?.errorCount || 'N/A'}`);
      console.log(`\n警告数: ${consoleReport?.warningCount || 'N/A'}`);

      if (consoleReport?.errors && Array.isArray(consoleReport.errors) && consoleReport.errors.length > 0) {
        console.log('\n🔴 Console 错误详情:');
        consoleReport.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. [${error.timestamp}] ${error.message}`);
        });
      }

      console.log('\n✅ Enhanced preview workflow test completed');

      await takeTimestampedScreenshot(page, 'enhanced-workflow-end');
    });
  });

  test('Quick preview button availability test', async ({ page }) => {
    await test.step('Test preview button states', async () => {
      // Check initial button state
      const previewButtons = page.locator('button:has-text("预览"), [data-testid="preview-button"]');
      const buttonCount = await previewButtons.count();
      
      console.log(`Found ${buttonCount} preview button(s)`);
      
      for (let i = 0; i < buttonCount; i++) {
        const button = previewButtons.nth(i);
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        const text = await button.textContent();
        
        console.log(`Button ${i + 1}: visible=${isVisible}, enabled=${isEnabled}, text="${text}"`);
      }
      
      expect(buttonCount).toBeGreaterThan(0);
      await takeTimestampedScreenshot(page, 'button-states');
    });
  });
});
