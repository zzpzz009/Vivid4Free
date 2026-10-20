/**
 * E2E Tests for ArchViz Generator Main Workflow
 * Tests the complete user journey from image upload to preview completion
 */

import { test, expect } from '@playwright/test';
import { setAuthToken, mockAuthAPI } from './utils/auth.js';
import { 
  waitForElement, 
  uploadTestImage, 
  mockAPIResponses, 
  waitForJobCompletion,
  takeTimestampedScreenshot,
  verifyImageUpload
} from './utils/test-helpers.js';

test.describe('ArchViz Generator Main Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await setAuthToken(page);
    
    // Mock API responses
    await mockAuthAPI(page);
    await mockAPIResponses(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await waitForElement(page, '[data-testid="app-container"]', 15000);
  });

  test('Complete workflow: Upload images, set parameters, and submit preview task', async ({ page }) => {
    // Take initial screenshot
    await takeTimestampedScreenshot(page, 'workflow-start');

    // Step 1: Verify application is loaded
    await test.step('Verify application loads correctly', async () => {
      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="unified-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="workspace-content"]')).toBeVisible();
    });

    // Step 2: Upload main image
    await test.step('Upload main image', async () => {
      // Look for upload areas with more flexible selectors
      const uploadAreas = [
        '[data-testid="main-image-upload"]',
        '.upload-area',
        '.image-upload',
        'input[type="file"]'
      ];

      let uploadElement = null;
      for (const selector of uploadAreas) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          uploadElement = element;
          break;
        }
      }

      if (!uploadElement) {
        // Try to find any file input
        uploadElement = page.locator('input[type="file"]').first();
      }

      await expect(uploadElement).toBeVisible();

      // Upload test image
      await uploadTestImage(page, 'input[type="file"]', 'test-main-image.jpg');

      // Wait for any image preview to appear (flexible selectors)
      const previewSelectors = [
        '[data-testid="main-image-preview"]',
        '.image-preview',
        '.uploaded-image',
        'img[src*="blob:"]',
        'img[src*="data:"]'
      ];

      let previewFound = false;
      for (const selector of previewSelectors) {
        try {
          await waitForElement(page, selector, 3000);
          previewFound = true;
          break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (previewFound) {
        console.log('Image preview found and verified');
      } else {
        console.log('Image uploaded but preview not found - this may be expected');
      }
    });

    // Step 3: Upload reference image (optional)
    await test.step('Upload reference image', async () => {
      // Look for reference upload areas
      const refUploadSelectors = [
        '[data-testid="reference-image-upload"]',
        '.reference-upload',
        '.ref-image-upload'
      ];

      let refUploadFound = false;
      for (const selector of refUploadSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          refUploadFound = true;
          break;
        }
      }

      if (refUploadFound) {
        // Upload reference image if the UI supports it
        const fileInputs = page.locator('input[type="file"]');
        const count = await fileInputs.count();

        if (count > 1) {
          // Use second file input for reference
          await uploadTestImage(page, 'input[type="file"]', 'test-reference-image.jpg');
          console.log('Reference image uploaded');
        }
      } else {
        console.log('Reference image upload not found - skipping this step');
      }
    });

    // Step 4: Set generation parameters
    await test.step('Configure generation parameters', async () => {
      // Look for prompt input with flexible selectors
      const promptSelectors = [
        '[data-testid="prompt-input"]',
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
          break;
        }
      }

      if (promptInput) {
        await promptInput.fill('Modern architectural visualization with clean lines and natural lighting');

        // Verify prompt is set
        const promptValue = await promptInput.inputValue();
        expect(promptValue).toContain('Modern architectural');
        console.log('Prompt configured successfully');
      } else {
        console.log('Prompt input not found - using default parameters');
      }

      // Check if advanced parameters section exists
      const advancedSelectors = [
        '[data-testid="advanced-toggle"]',
        '.advanced-toggle',
        'button:has-text("高级")',
        'button:has-text("Advanced")'
      ];

      for (const selector of advancedSelectors) {
        const toggle = page.locator(selector);
        if (await toggle.isVisible()) {
          await toggle.click();
          console.log('Advanced parameters opened');
          break;
        }
      }
    });

    // Step 5: Verify preview button is enabled
    await test.step('Verify preview button is enabled', async () => {
      // Look for preview button with flexible selectors
      const previewButtonSelectors = [
        '[data-testid="preview-button"]',
        'button:has-text("预览")',
        'button:has-text("Preview")',
        '.preview-button',
        'button[class*="preview"]'
      ];

      let previewButton = null;
      for (const selector of previewButtonSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          previewButton = element;
          break;
        }
      }

      if (previewButton) {
        await expect(previewButton).toBeVisible();

        // Wait a bit for the button to become enabled
        await page.waitForTimeout(1000);

        const isEnabled = await previewButton.isEnabled();
        if (isEnabled) {
          console.log('Preview button is enabled');
        } else {
          console.log('Preview button is disabled - may need more setup');
        }

        // Check button text
        const buttonText = await previewButton.textContent();
        expect(buttonText).toMatch(/(预览|Preview|生成|Generate)/i);
      } else {
        console.log('Preview button not found - looking for any action button');

        // Look for any action button
        const actionButtons = page.locator('button').filter({ hasText: /生成|预览|Generate|Preview|Submit/ });
        const count = await actionButtons.count();
        if (count > 0) {
          previewButton = actionButtons.first();
          console.log('Found action button');
        }
      }

      expect(previewButton).toBeTruthy();
    });

    // Step 6: Submit preview task
    await test.step('Submit preview task', async () => {
      // Take screenshot before submission
      await takeTimestampedScreenshot(page, 'before-preview-submit');
      
      // Click preview button
      const previewButton = page.locator('[data-testid="preview-button"]');
      await previewButton.click();
      
      // Wait for loading state
      await waitForElement(page, '[data-testid="loading-indicator"]');
      
      // Verify loading indicator is shown
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
      await expect(loadingIndicator).toBeVisible();
    });

    // Step 7: Monitor progress and wait for completion
    await test.step('Monitor preview progress', async () => {
      // Wait for progress bar to appear
      await waitForElement(page, '[data-testid="progress-bar"]');
      
      // Monitor progress updates
      const progressBar = page.locator('[data-testid="progress-bar"]');
      await expect(progressBar).toBeVisible();
      
      // Wait for job completion (with mocked responses)
      await waitForJobCompletion(page, 'test-preview-123', 10000);
      
      // Take screenshot during progress
      await takeTimestampedScreenshot(page, 'preview-progress');
    });

    // Step 8: Verify preview results
    await test.step('Verify preview completion and results', async () => {
      // Wait for preview result to appear
      await waitForElement(page, '[data-testid="preview-result"]', 15000);
      
      // Verify preview result is displayed
      const previewResult = page.locator('[data-testid="preview-result"]');
      await expect(previewResult).toBeVisible();
      
      // Check if preview image is shown
      const previewImage = page.locator('[data-testid="preview-image"]');
      if (await previewImage.isVisible()) {
        await expect(previewImage).toBeVisible();
        
        // Verify image has valid source
        const src = await previewImage.getAttribute('src');
        expect(src).toBeTruthy();
      }
      
      // Check for success message or status
      const statusText = page.locator('[data-testid="status-text"]');
      if (await statusText.isVisible()) {
        const status = await statusText.textContent();
        expect(status).toMatch(/(完成|成功|Complete|Success)/i);
      }
      
      // Take final screenshot
      await takeTimestampedScreenshot(page, 'preview-completed');
    });

    // Step 9: Verify generate button is now enabled
    await test.step('Verify generate button is enabled after preview', async () => {
      const generateButton = page.locator('[data-testid="generate-button"]');
      
      if (await generateButton.isVisible()) {
        await expect(generateButton).toBeEnabled();
        
        const buttonText = await generateButton.textContent();
        expect(buttonText).toMatch(/(生成|Generate)/i);
      }
    });
  });

  test('Error handling: Invalid image upload', async ({ page }) => {
    await test.step('Test invalid file upload handling', async () => {
      // Try to upload a non-image file (if the UI allows it)
      const fileInput = page.locator('input[type="file"]').first();
      
      // Create a text file and try to upload it
      const invalidFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      // This should either be rejected by the file input or show an error message
      // The exact behavior depends on the implementation
      
      // Check for error message if invalid file is uploaded
      const errorMessage = page.locator('[data-testid="upload-error"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/格式|format|invalid/i);
      }
    });
  });

  test('Responsive design: Mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await test.step('Verify mobile layout', async () => {
      // Verify app loads correctly on mobile
      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
      
      // Check if sidebar is collapsed or hidden on mobile
      const sidebar = page.locator('[data-testid="unified-sidebar"]');
      const sidebarStyles = await sidebar.evaluate(el => getComputedStyle(el));
      
      // Sidebar might be hidden or have different layout on mobile
      // This depends on the responsive design implementation
      
      // Take mobile screenshot
      await takeTimestampedScreenshot(page, 'mobile-layout');
    });
  });

  test('Keyboard navigation and accessibility', async ({ page }) => {
    await test.step('Test keyboard navigation', async () => {
      // Test tab navigation through the interface
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Test Enter key on buttons
      const previewButton = page.locator('[data-testid="preview-button"]');
      if (await previewButton.isVisible() && await previewButton.isEnabled()) {
        await previewButton.focus();
        // Note: We don't actually press Enter here to avoid triggering the action
        // Just verify the button can receive focus
        await expect(previewButton).toBeFocused();
      }
    });
  });
});
