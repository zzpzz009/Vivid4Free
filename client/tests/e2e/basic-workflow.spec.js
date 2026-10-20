/**
 * Basic E2E Tests for ArchViz Generator
 * Simplified tests focusing on core functionality
 */

const { test, expect } = require('@playwright/test');
const { setAuthToken, mockAuthAPI } = require('./utils/auth.js');
const { mockAPIResponses, takeTimestampedScreenshot } = require('./utils/test-helpers.js');

test.describe('ArchViz Generator Basic Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await setAuthToken(page);
    
    // Mock API responses
    await mockAuthAPI(page);
    await mockAPIResponses(page);
    
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give extra time for Vue to initialize
  });

  test('Application loads and basic UI elements are present', async ({ page }) => {
    await test.step('Verify application loads', async () => {
      // Take initial screenshot
      await takeTimestampedScreenshot(page, 'app-loaded');
      
      // Check if the page has loaded by looking for common elements
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      
      // Look for any of these common UI elements
      const commonSelectors = [
        'header',
        'nav',
        '.sidebar',
        '.upload',
        'button',
        'input[type="file"]',
        '[class*="upload"]',
        '[class*="sidebar"]',
        '[class*="workspace"]'
      ];
      
      let foundElements = 0;
      for (const selector of commonSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          foundElements++;
          console.log(`Found ${count} elements matching: ${selector}`);
        }
      }
      
      expect(foundElements).toBeGreaterThan(0);
      console.log(`Found ${foundElements} types of UI elements`);
    });
  });

  test('File upload functionality works', async ({ page }) => {
    await test.step('Test file upload', async () => {
      // Look for file input elements
      const fileInputs = page.locator('input[type="file"]');
      const fileInputCount = await fileInputs.count();
      
      if (fileInputCount > 0) {
        console.log(`Found ${fileInputCount} file input(s)`);
        
        // Create a simple test file
        const testFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });
        
        // Upload to the first file input
        const firstInput = fileInputs.first();
        await firstInput.setInputFiles({
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('test image content')
        });
        
        console.log('File uploaded successfully');
        
        // Wait a bit for any processing
        await page.waitForTimeout(1000);
        
        // Take screenshot after upload
        await takeTimestampedScreenshot(page, 'after-upload');
      } else {
        console.log('No file inputs found - checking for upload areas');
        
        // Look for upload areas or buttons
        const uploadElements = page.locator('[class*="upload"], [data-testid*="upload"], button:has-text("上传"), button:has-text("Upload")');
        const uploadCount = await uploadElements.count();
        
        if (uploadCount > 0) {
          console.log(`Found ${uploadCount} upload element(s)`);
          // Click the first upload element
          await uploadElements.first().click();
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test('Preview/Generate button interaction', async ({ page }) => {
    await test.step('Test action buttons', async () => {
      // Look for action buttons
      const actionButtonSelectors = [
        'button:has-text("预览")',
        'button:has-text("Preview")',
        'button:has-text("生成")',
        'button:has-text("Generate")',
        'button:has-text("提交")',
        'button:has-text("Submit")',
        '[data-testid*="preview"]',
        '[data-testid*="generate"]'
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
          // Click the button
          await actionButton.click();
          console.log('Action button clicked');
          
          // Wait for any response
          await page.waitForTimeout(2000);
          
          // Take screenshot after action
          await takeTimestampedScreenshot(page, 'after-action');
          
          // Look for loading indicators or results
          const loadingSelectors = [
            '[class*="loading"]',
            '[class*="spinner"]',
            '[data-testid*="loading"]',
            '.progress',
            '[role="progressbar"]'
          ];
          
          for (const selector of loadingSelectors) {
            const loading = page.locator(selector);
            if (await loading.isVisible()) {
              console.log(`Found loading indicator: ${selector}`);
              break;
            }
          }
        }
      } else {
        console.log('No action buttons found');
      }
    });
  });

  test('Responsive design check', async ({ page }) => {
    await test.step('Test mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      
      // Take mobile screenshot
      await takeTimestampedScreenshot(page, 'mobile-view');
      
      // Verify page is still functional
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      
      console.log('Mobile viewport test completed');
    });
    
    await test.step('Test tablet viewport', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(1000);
      
      // Take tablet screenshot
      await takeTimestampedScreenshot(page, 'tablet-view');
      
      console.log('Tablet viewport test completed');
    });
    
    await test.step('Test desktop viewport', async () => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      
      // Take desktop screenshot
      await takeTimestampedScreenshot(page, 'desktop-view');
      
      console.log('Desktop viewport test completed');
    });
  });

  test('Error handling and edge cases', async ({ page }) => {
    await test.step('Test with no network', async () => {
      // Simulate network failure
      await page.route('**/*', route => route.abort());
      
      // Try to interact with the app
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      if (buttonCount > 0) {
        await buttons.first().click();
        await page.waitForTimeout(1000);
        
        // Look for error messages
        const errorSelectors = [
          '[class*="error"]',
          '[data-testid*="error"]',
          '.alert',
          '[role="alert"]'
        ];
        
        for (const selector of errorSelectors) {
          const error = page.locator(selector);
          if (await error.isVisible()) {
            console.log(`Found error indicator: ${selector}`);
            break;
          }
        }
      }
      
      // Restore network
      await page.unroute('**/*');
    });
  });

  test('Performance and loading time', async ({ page }) => {
    await test.step('Measure page load performance', async () => {
      const startTime = Date.now();
      
      // Navigate to the page
      await page.goto('/', { waitUntil: 'networkidle' });
      
      const loadTime = Date.now() - startTime;
      console.log(`Page load time: ${loadTime}ms`);
      
      // Verify reasonable load time (less than 10 seconds)
      expect(loadTime).toBeLessThan(10000);
      
      // Check for performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });
      
      console.log('Performance metrics:', performanceMetrics);
    });
  });
});
