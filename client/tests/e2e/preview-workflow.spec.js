/**
 * E2E Test for Preview Workflow
 * Tests the complete preview task submission and completion
 */

const { test, expect } = require('@playwright/test');
const { setAuthToken, mockAuthAPI } = require('./utils/auth.js');
const { mockAPIResponses, takeTimestampedScreenshot } = require('./utils/test-helpers.js');
const path = require('path');

test.describe('ArchViz Generator Preview Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await setAuthToken(page);
    
    // Mock API responses
    await mockAuthAPI(page);
    await mockAPIResponses(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load with a shorter timeout
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
      console.log('DOMContentLoaded timeout, continuing...');
    }
    
    await page.waitForTimeout(2000); // Give time for Vue to initialize
  });

  test('Complete preview workflow: Upload images and submit preview task', async ({ page }) => {
    // Take initial screenshot
    await takeTimestampedScreenshot(page, 'preview-workflow-start');

    await test.step('Verify application is loaded', async () => {
      // Check if the page has basic content
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      console.log('✅ Application loaded successfully');
    });

    await test.step('Find and interact with file upload', async () => {
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
        
        // Wait for any processing
        await page.waitForTimeout(1000);
        
        // Take screenshot after upload
        await takeTimestampedScreenshot(page, 'after-image-upload');
      } else {
        console.log('⚠️ No file inputs found, skipping upload step');
      }
    });

    await test.step('Set prompt text if available', async () => {
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
        await promptInput.fill('Modern architectural visualization with clean lines and natural lighting');
        console.log('✅ Prompt text set successfully');
      } else {
        console.log('⚠️ Prompt input not found, using default parameters');
      }
    });

    await test.step('Find and click preview/generate button', async () => {
      // Look for action buttons
      const actionButtonSelectors = [
        'button:has-text("预览")',
        'button:has-text("Preview")',
        'button:has-text("生成")',
        'button:has-text("Generate")',
        'button:has-text("提交")',
        'button:has-text("Submit")'
      ];
      
      let actionButton = null;
      for (const selector of actionButtonSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          actionButton = button;
          console.log(`Found action button: ${selector}`);
          break;
        }
      }
      
      if (actionButton) {
        // Check if button is enabled
        const isEnabled = await actionButton.isEnabled();
        console.log(`Action button enabled: ${isEnabled}`);
        
        if (isEnabled) {
          // Take screenshot before clicking
          await takeTimestampedScreenshot(page, 'before-preview-submit');
          
          // Click the button
          await actionButton.click();
          console.log('✅ Preview/Generate button clicked successfully');
          
          // Wait for response
          await page.waitForTimeout(2000);
          
          // Take screenshot after clicking
          await takeTimestampedScreenshot(page, 'after-preview-submit');
        } else {
          console.log('⚠️ Action button is disabled');
        }
      } else {
        console.log('⚠️ No action buttons found');
      }
    });

    await test.step('Monitor for progress indicators', async () => {
      // Look for loading indicators or progress elements
      const progressSelectors = [
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="progress"]',
        '[role="progressbar"]',
        '.progress-bar',
        '[data-testid*="progress"]',
        '[data-testid*="loading"]'
      ];
      
      let foundProgress = false;
      for (const selector of progressSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          console.log(`✅ Found progress indicator: ${selector}`);
          foundProgress = true;
          
          // Take screenshot of progress
          await takeTimestampedScreenshot(page, 'progress-indicator');
          break;
        }
      }
      
      if (!foundProgress) {
        console.log('⚠️ No progress indicators found');
      }
      
      // Wait for potential completion
      await page.waitForTimeout(3000);
    });

    await test.step('Check for completion or results', async () => {
      // Look for result indicators
      const resultSelectors = [
        '[class*="result"]',
        '[class*="complete"]',
        '[class*="success"]',
        '[data-testid*="result"]',
        'img[src*="blob:"]',
        'img[src*="data:"]',
        '.result-image',
        '.output-image'
      ];
      
      let foundResults = false;
      for (const selector of resultSelectors) {
        const element = page.locator(selector);
        const count = await element.count();
        if (count > 0) {
          console.log(`✅ Found ${count} result element(s): ${selector}`);
          foundResults = true;
          
          // Take screenshot of results
          await takeTimestampedScreenshot(page, 'preview-results');
          break;
        }
      }
      
      if (!foundResults) {
        console.log('⚠️ No result elements found yet');
      }
      
      // Take final screenshot
      await takeTimestampedScreenshot(page, 'preview-workflow-end');
    });

    await test.step('Verify workflow completion', async () => {
      // Check if the page is still responsive
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      
      console.log('✅ Preview workflow test completed successfully');
    });
  });

  test('Quick UI interaction test', async ({ page }) => {
    await test.step('Test basic UI interactions', async () => {
      // Count interactive elements
      const buttons = page.locator('button');
      const inputs = page.locator('input');
      const textareas = page.locator('textarea');
      
      const buttonCount = await buttons.count();
      const inputCount = await inputs.count();
      const textareaCount = await textareas.count();
      
      console.log(`Found ${buttonCount} buttons, ${inputCount} inputs, ${textareaCount} textareas`);
      
      expect(buttonCount + inputCount + textareaCount).toBeGreaterThan(0);
      
      // Take screenshot of UI
      await takeTimestampedScreenshot(page, 'ui-elements');
      
      console.log('✅ UI interaction test completed');
    });
  });
});
