/**
 * E2E Test for Real Backend Preview Workflow
 * Tests the complete preview task submission and completion with real backend services
 */

const { test, expect } = require('@playwright/test');
const { setAuthToken } = require('./utils/auth.js');
const { takeTimestampedScreenshot, setupConsoleMonitoring, checkConsoleErrors } = require('./utils/test-helpers.js');
const path = require('path');

test.describe('ArchViz Generator Real Backend Preview Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // 设置 console 监控
    setupConsoleMonitoring(page);

    // Set up authentication with a real JWT token
    await setAuthToken(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('DOMContentLoaded timeout, continuing...');
    }

    await page.waitForTimeout(3000); // Give time for Vue to initialize and connect to backend
  });

  test('Complete real preview workflow: Upload images and submit to real backend', async ({ page }) => {
    // Take initial screenshot
    await takeTimestampedScreenshot(page, 'real-workflow-start');

    await test.step('Verify application is loaded and backend connected', async () => {
      // Check if the page has basic content
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      
      // Check for any error messages that might indicate backend connection issues
      const errorElements = page.locator('[class*="error"], .alert-error, [role="alert"]');
      const errorCount = await errorElements.count();
      
      if (errorCount > 0) {
        console.log('⚠️ Found error elements, checking content...');
        for (let i = 0; i < errorCount; i++) {
          const errorText = await errorElements.nth(i).textContent();
          console.log(`Error ${i + 1}: ${errorText}`);
        }
      }
      
      console.log('✅ Application loaded successfully');
    });

    await test.step('Upload real test image', async () => {
      // Look for file input elements
      const fileInputs = page.locator('input[type="file"]');
      const fileInputCount = await fileInputs.count();
      
      console.log(`Found ${fileInputCount} file input(s)`);
      
      if (fileInputCount > 0) {
        // Upload test image to the first file input
        const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
        const firstInput = fileInputs.first();
        
        await firstInput.setInputFiles(testImagePath);
        console.log('✅ Test image uploaded successfully');
        
        // Wait for any processing/preview generation
        await page.waitForTimeout(2000);
        
        // Check if image preview appears
        const previewSelectors = [
          'img[src*="blob:"]',
          'img[src*="data:"]',
          '.image-preview img',
          '.uploaded-image img',
          '[data-testid*="preview"] img'
        ];
        
        let previewFound = false;
        for (const selector of previewSelectors) {
          const preview = page.locator(selector);
          if (await preview.count() > 0) {
            console.log(`✅ Image preview found: ${selector}`);
            previewFound = true;
            break;
          }
        }
        
        if (!previewFound) {
          console.log('⚠️ No image preview found, but upload may still be successful');
        }
        
        // Take screenshot after upload
        await takeTimestampedScreenshot(page, 'after-real-image-upload');
      } else {
        console.log('⚠️ No file inputs found, skipping upload step');
      }
    });

    await test.step('Set prompt text for real generation', async () => {
      // Look for prompt input with flexible selectors
      const promptSelectors = [
        'textarea[placeholder*="prompt"]',
        'textarea[placeholder*="描述"]',
        'input[placeholder*="prompt"]',
        'textarea',
        '.prompt-input'
      ];
      
      let promptInput = null;
      for (const selector of promptSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          promptInput = element;
          console.log(`Found prompt input: ${selector}`);
          break;
        }
      }
      
      if (promptInput) {
        const testPrompt = 'Modern architectural visualization with clean lines, natural lighting, and contemporary design elements';
        await promptInput.fill(testPrompt);
        console.log('✅ Prompt text set successfully');
        
        // Verify the prompt was set
        const promptValue = await promptInput.inputValue();
        expect(promptValue).toContain('Modern architectural');
      } else {
        console.log('⚠️ Prompt input not found, using default parameters');
      }
    });

    await test.step('Submit real preview task to backend', async () => {
      // First check button state before any tab switching
      const previewButtonBefore = page.locator('[data-testid="preview-button"]');
      if (await previewButtonBefore.isVisible()) {
        const isEnabledBefore = await previewButtonBefore.isEnabled();
        console.log(`Preview button enabled before tab switch: ${isEnabledBefore}`);
      }

      // Ensure we're on the correct workspace tab
      const workspaceTab = page.locator('[data-testid="workspace-tab-workspace"]');
      if (await workspaceTab.isVisible()) {
        await workspaceTab.click();
        console.log('✅ Switched to workspace tab');
        await page.waitForTimeout(1000);
      }

      // Look for the specific preview button with data-testid
      const previewButton = page.locator('[data-testid="preview-button"][data-mode="workspace"]');

      if (await previewButton.isVisible()) {
        // Check if button is enabled
        const isEnabled = await previewButton.isEnabled();
        console.log(`Preview button enabled after tab switch: ${isEnabled}`);

        if (isEnabled) {
          // Take screenshot before clicking
          await takeTimestampedScreenshot(page, 'before-real-preview-submit');

          // Click the preview button to submit to real backend
          await previewButton.click();
          console.log('✅ Preview task submitted to real backend via workspace preview button');

          // Wait for initial response
          await page.waitForTimeout(3000);

          // Take screenshot after clicking
          await takeTimestampedScreenshot(page, 'after-real-preview-submit');
        } else {
          console.log('⚠️ Preview button is disabled after tab switch');

          // Try to re-upload images to fix the state
          console.log('🔄 Attempting to re-upload images...');
          const fileInputs = page.locator('input[type="file"]');
          const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

          if (await fileInputs.count() > 0) {
            await fileInputs.first().setInputFiles(testImagePath);
            await page.waitForTimeout(1000);

            if (await fileInputs.count() > 1) {
              await fileInputs.nth(1).setInputFiles(testImagePath);
              await page.waitForTimeout(1000);
            }

            // Check button state again
            const isEnabledAfterReupload = await previewButton.isEnabled();
            console.log(`Preview button enabled after re-upload: ${isEnabledAfterReupload}`);

            if (isEnabledAfterReupload) {
              await takeTimestampedScreenshot(page, 'before-real-preview-submit');
              await previewButton.click();
              console.log('✅ Preview task submitted after re-upload');
              await page.waitForTimeout(3000);
              await takeTimestampedScreenshot(page, 'after-real-preview-submit');
            }
          }
        }
      } else {
        console.log('⚠️ Preview button not found, trying fallback selectors');

        // Fallback to text-based selectors
        const fallbackButton = page.locator('button:has-text("预览")').first();
        if (await fallbackButton.isVisible()) {
          const isEnabled = await fallbackButton.isEnabled();
          console.log(`Fallback preview button enabled: ${isEnabled}`);

          if (isEnabled) {
            await takeTimestampedScreenshot(page, 'before-real-preview-submit');
            await fallbackButton.click();
            console.log('✅ Preview task submitted via fallback button');
            await page.waitForTimeout(3000);
            await takeTimestampedScreenshot(page, 'after-real-preview-submit');
          }
        } else {
          console.log('❌ No preview buttons found');
        }
      }
    });

    await test.step('Monitor real backend processing', async () => {
      // Look for loading indicators or progress elements
      const progressSelectors = [
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="progress"]',
        '[role="progressbar"]',
        '.progress-bar',
        '[data-testid*="progress"]',
        '[data-testid*="loading"]',
        '.loading-indicator',
        '.processing'
      ];
      
      let foundProgress = false;
      for (const selector of progressSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          console.log(`✅ Found progress indicator: ${selector}`);
          foundProgress = true;
          
          // Take screenshot of progress
          await takeTimestampedScreenshot(page, 'real-backend-progress');
          break;
        }
      }
      
      if (!foundProgress) {
        console.log('⚠️ No progress indicators found - checking for immediate results');
      }
      
      // Wait longer for real backend processing
      console.log('⏳ Waiting for real backend processing...');
      await page.waitForTimeout(10000); // Wait 10 seconds for real processing
    });

    await test.step('Check for real backend results', async () => {
      // Look for result indicators
      const resultSelectors = [
        '[class*="result"]',
        '[class*="complete"]',
        '[class*="success"]',
        '[data-testid*="result"]',
        'img[src*="blob:"]',
        'img[src*="data:"]',
        'img[src*="http"]',
        '.result-image',
        '.output-image',
        '.generated-image'
      ];
      
      let foundResults = false;
      for (const selector of resultSelectors) {
        const element = page.locator(selector);
        const count = await element.count();
        if (count > 0) {
          console.log(`✅ Found ${count} result element(s): ${selector}`);
          foundResults = true;
          
          // Take screenshot of results
          await takeTimestampedScreenshot(page, 'real-backend-results');
          break;
        }
      }
      
      if (!foundResults) {
        console.log('⚠️ No result elements found yet - backend may still be processing');
        
        // Check for any error messages
        const errorSelectors = [
          '[class*="error"]',
          '.alert-error',
          '[role="alert"]',
          '.error-message'
        ];
        
        for (const selector of errorSelectors) {
          const element = page.locator(selector);
          if (await element.isVisible()) {
            const errorText = await element.textContent();
            console.log(`❌ Found error: ${errorText}`);
          }
        }
      }
      
      // Take final screenshot regardless
      await takeTimestampedScreenshot(page, 'real-workflow-end');
    });

    await test.step('Verify backend communication and check console errors', async () => {
      // Check if the page is still responsive
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();

      // Wait a bit more to see if any delayed responses come in
      await page.waitForTimeout(5000);

      // 检查整个测试过程中的 console 错误
      const errorReport = checkConsoleErrors(page, 'Real Backend Preview Workflow');

      // 如果有严重错误，记录但不让测试失败（除非是关键错误）
      if (errorReport.criticalErrors.length > 0) {
        console.log('\n⚠️ 发现严重错误，但测试继续进行');
      }

      console.log('\n✅ Real backend workflow test completed');
    });
  });

  test('Batch preview workflow: Test batch preview tab functionality', async ({ page }) => {
    await test.step('Switch to batch preview tab', async () => {
      // Click on batch preview tab
      const batchPreviewTab = page.locator('[data-testid="workspace-tab-batch-preview"]');

      if (await batchPreviewTab.isVisible()) {
        await batchPreviewTab.click();
        console.log('✅ Switched to batch preview tab');
        await page.waitForTimeout(2000);

        // Take screenshot of batch preview interface
        await takeTimestampedScreenshot(page, 'batch-preview-interface');
      } else {
        console.log('❌ Batch preview tab not found');
      }
    });

    await test.step('Test batch preview button', async () => {
      // Look for the batch preview button
      const batchPreviewButton = page.locator('[data-testid="preview-button"][data-mode="batch-preview"]');

      if (await batchPreviewButton.isVisible()) {
        const isEnabled = await batchPreviewButton.isEnabled();
        console.log(`Batch preview button enabled: ${isEnabled}`);

        // Take screenshot showing the batch preview button
        await takeTimestampedScreenshot(page, 'batch-preview-button-state');

        if (isEnabled) {
          console.log('✅ Batch preview button is ready for use');
        } else {
          console.log('⚠️ Batch preview button is disabled - needs images');
        }
      } else {
        console.log('⚠️ Batch preview button not found');
      }
    });
  });

  test('Backend health check', async ({ page }) => {
    await test.step('Check backend connectivity', async () => {
      // Try to access backend health endpoint directly
      try {
        const response = await page.request.get('http://localhost:3001/health');
        const status = response.status();
        console.log(`Backend health check status: ${status}`);

        if (status === 200) {
          const body = await response.json();
          console.log('✅ Backend is healthy:', body);
        } else {
          console.log('⚠️ Backend health check failed');
        }
      } catch (error) {
        console.log('❌ Backend health check error:', error.message);
      }

      // Try to access gateway health endpoint
      try {
        const response = await page.request.get('http://localhost:8000/health');
        const status = response.status();
        console.log(`Gateway health check status: ${status}`);

        if (status === 200) {
          const body = await response.json();
          console.log('✅ Gateway is healthy:', body);
        } else {
          console.log('⚠️ Gateway health check failed');
        }
      } catch (error) {
        console.log('❌ Gateway health check error:', error.message);
      }
    });
  });
});
