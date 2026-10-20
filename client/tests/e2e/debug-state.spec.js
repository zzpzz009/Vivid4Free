/**
 * E2E Test for State Debugging
 * Tests the state management and button enabling logic
 */

const { test, expect } = require('@playwright/test');
const { setAuthToken } = require('./utils/auth.js');
const { takeTimestampedScreenshot } = require('./utils/test-helpers.js');
const path = require('path');

test.describe('State Debugging Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await setAuthToken(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(3000);
  });

  test('Debug image store state after upload', async ({ page }) => {
    await test.step('Switch to workspace tab', async () => {
      const workspaceTab = page.locator('[data-testid="workspace-tab-workspace"]');
      if (await workspaceTab.isVisible()) {
        await workspaceTab.click();
        console.log('✅ Switched to workspace tab');
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Upload images and check state', async () => {
      // Upload test image
      const fileInputs = page.locator('input[type="file"]');
      const fileInputCount = await fileInputs.count();
      console.log(`Found ${fileInputCount} file input(s)`);
      
      if (fileInputCount > 0) {
        const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
        
        // Upload to first input (main image)
        await fileInputs.first().setInputFiles(testImagePath);
        console.log('✅ Main image uploaded');
        await page.waitForTimeout(1000);
        
        // Upload to second input (reference image) if exists
        if (fileInputCount > 1) {
          await fileInputs.nth(1).setInputFiles(testImagePath);
          console.log('✅ Reference image uploaded');
          await page.waitForTimeout(1000);
        }
      }
      
      // Take screenshot after upload
      await takeTimestampedScreenshot(page, 'after-upload-debug');
    });

    await test.step('Check button states and debug store', async () => {
      // Check preview button state
      const previewButton = page.locator('[data-testid="preview-button"][data-mode="workspace"]');
      if (await previewButton.isVisible()) {
        const isEnabled = await previewButton.isEnabled();
        console.log(`Preview button enabled: ${isEnabled}`);
      }
      
      // Check generate button state
      const generateButton = page.locator('[data-testid="generate-button"][data-mode="workspace"]');
      if (await generateButton.isVisible()) {
        const isEnabled = await generateButton.isEnabled();
        console.log(`Generate button enabled: ${isEnabled}`);
      }
      
      // Debug store state by evaluating JavaScript
      const storeState = await page.evaluate(() => {
        // Access the Vue app instance and store
        const app = window.__VUE_APP__;
        if (app && app.config && app.config.globalProperties) {
          const store = app.config.globalProperties.$imageStore;
          if (store) {
            return {
              currentMode: store.currentMode,
              uploadedImageFile: !!store.uploadedImageFile,
              uploadedReferenceFile: !!store.uploadedReferenceFile,
              uploadedImages: store.uploadedImages?.length || 0,
              uploadedReferences: store.uploadedReferences?.length || 0,
              hasUploadedImage: store.hasUploadedImage(),
              hasUploadedReference: store.hasUploadedReference(),
              canPreview: store.canPreview(),
              canGenerate: store.canGenerate()
            };
          }
        }
        return { error: 'Store not accessible' };
      });
      
      console.log('📊 Store State:', JSON.stringify(storeState, null, 2));
    });

    await test.step('Check DOM for uploaded images', async () => {
      // Look for image previews
      const imagePreviewSelectors = [
        'img[src*="blob:"]',
        'img[src*="data:"]',
        '.image-preview img',
        '.uploaded-image img'
      ];
      
      for (const selector of imagePreviewSelectors) {
        const images = page.locator(selector);
        const count = await images.count();
        if (count > 0) {
          console.log(`Found ${count} image(s) with selector: ${selector}`);
        }
      }
    });

    await test.step('Try alternative store access methods', async () => {
      // Try different ways to access the store
      const alternativeStoreState = await page.evaluate(() => {
        try {
          // Method 1: Check if Pinia store is available globally
          if (window.pinia) {
            return { method: 'pinia', available: true };
          }
          
          // Method 2: Check Vue devtools
          if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            return { method: 'devtools', available: true };
          }
          
          // Method 3: Check for any Vue instances
          const vueInstances = document.querySelectorAll('[data-v-]');
          return { 
            method: 'vue-instances', 
            count: vueInstances.length,
            available: vueInstances.length > 0 
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('🔍 Alternative store access:', JSON.stringify(alternativeStoreState, null, 2));
    });
  });

  test('Test manual button click and state change', async ({ page }) => {
    await test.step('Upload images manually', async () => {
      // Switch to workspace
      const workspaceTab = page.locator('[data-testid="workspace-tab-workspace"]');
      if (await workspaceTab.isVisible()) {
        await workspaceTab.click();
        await page.waitForTimeout(1000);
      }
      
      // Upload images
      const fileInputs = page.locator('input[type="file"]');
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
      
      if (await fileInputs.count() > 0) {
        await fileInputs.first().setInputFiles(testImagePath);
        await page.waitForTimeout(1000);
        
        if (await fileInputs.count() > 1) {
          await fileInputs.nth(1).setInputFiles(testImagePath);
          await page.waitForTimeout(1000);
        }
      }
    });

    await test.step('Force button click even if disabled', async () => {
      const previewButton = page.locator('[data-testid="preview-button"][data-mode="workspace"]');
      
      if (await previewButton.isVisible()) {
        const isEnabled = await previewButton.isEnabled();
        console.log(`Preview button enabled before click: ${isEnabled}`);
        
        // Try to click even if disabled (for debugging)
        try {
          await previewButton.click({ force: true });
          console.log('✅ Forced preview button click');
          await page.waitForTimeout(2000);
        } catch (error) {
          console.log('❌ Preview button click failed:', error.message);
        }
        
        // Check state after click
        const isEnabledAfter = await previewButton.isEnabled();
        console.log(`Preview button enabled after click: ${isEnabledAfter}`);
      }
    });
  });
});
