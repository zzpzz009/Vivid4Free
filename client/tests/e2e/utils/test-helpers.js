/**
 * Test helper utilities for E2E tests
 */

const { expect } = require('@playwright/test');
const path = require('path');
// __dirname is available in CommonJS

/**
 * Wait for element to be visible and stable
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} selector - Element selector
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForElement(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
  await page.waitForLoadState('networkidle');
}

/**
 * Upload test image file
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} inputSelector - File input selector
 * @param {string} fileName - Test image file name
 */
async function uploadTestImage(page, inputSelector, fileName = 'test-image.jpg') {
  const testImagePath = path.join(__dirname, '../fixtures', fileName);
  
  // Create test image if it doesn't exist
  await createTestImageIfNeeded(testImagePath);
  
  const fileInput = page.locator(inputSelector);
  await fileInput.setInputFiles(testImagePath);
}

/**
 * Create a test image file if it doesn't exist
 * @param {string} filePath - Path to create the test image
 */
async function createTestImageIfNeeded(filePath) {
  const fs = require('fs');
  let createCanvas = null;
  try {
    createCanvas = require('canvas').createCanvas;
  } catch (e) {
    // canvas not available
  }
  
  // Create fixtures directory if it doesn't exist
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create a simple test image if it doesn't exist
  if (!fs.existsSync(filePath)) {
    if (createCanvas) {
      // Use canvas to create a test image
      const canvas = createCanvas(800, 600);
      const ctx = canvas.getContext('2d');
      
      // Draw a simple test pattern
      ctx.fillStyle = '#4F46E5';
      ctx.fillRect(0, 0, 800, 600);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Test Image', 400, 300);
      
      // Save as JPEG
      const buffer = canvas.toBuffer('image/jpeg');
      fs.writeFileSync(filePath, buffer);
    } else {
      // Create a minimal JPEG file (1x1 pixel)
      const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
        0xFF, 0xD9
      ]);
      fs.writeFileSync(filePath, minimalJpeg);
    }
  }
}

/**
 * Mock API responses for testing
 * @param {import('@playwright/test').Page} page - Playwright page
 */
async function mockAPIResponses(page) {
  // Mock image generation API
  await page.route('**/api/generate', async (route) => {
    const method = route.request().method();
    
    if (method === 'POST') {
      // Mock job creation
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId: 'test-job-123',
          status: 'pending',
          message: 'Job created successfully'
        })
      });
    } else if (method === 'GET') {
      // Mock job status check
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId: 'test-job-123',
          status: 'completed',
          progress: 100,
          result: {
            outputImages: [
              'http://localhost:3004/test-output-1.jpg',
              'http://localhost:3004/test-output-2.jpg'
            ],
            metadata: {
              processingTime: 5.2,
              model: 'test-model',
              parameters: {}
            }
          }
        })
      });
    }
  });

  // Mock preview API
  await page.route('**/api/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        jobId: 'test-preview-123',
        status: 'completed',
        result: {
          previewImage: 'http://localhost:3004/test-preview.jpg',
          metadata: {
            processingTime: 2.1,
            parameters: {}
          }
        }
      })
    });
  });

  // Mock WebSocket connection
  await page.addInitScript(() => {
    // Mock WebSocket for real-time updates
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = WebSocket.CONNECTING;
        setTimeout(() => {
          this.readyState = WebSocket.OPEN;
          if (this.onopen) this.onopen();
          
          // Simulate progress updates
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  type: 'progress',
                  jobId: 'test-job-123',
                  progress: 25,
                  status: 'processing'
                })
              });
            }
          }, 1000);
          
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  type: 'progress',
                  jobId: 'test-job-123',
                  progress: 75,
                  status: 'processing'
                })
              });
            }
          }, 2000);
          
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  type: 'complete',
                  jobId: 'test-job-123',
                  progress: 100,
                  status: 'completed',
                  result: {
                    outputImages: [
                      'http://localhost:3004/test-output-1.jpg',
                      'http://localhost:3004/test-output-2.jpg'
                    ]
                  }
                })
              });
            }
          }, 3000);
        }, 100);
      }
      
      send(data) {
        console.log('MockWebSocket send:', data);
      }
      
      close() {
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) this.onclose();
      }
    }
    
    window.WebSocket = MockWebSocket;
  });
}

/**
 * Wait for job completion with progress tracking
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} jobId - Job ID to track
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForJobCompletion(page, jobId, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Check for completion indicators
    const isCompleted = await page.evaluate(() => {
      // Look for completion indicators in the UI
      const progressBar = document.querySelector('[data-testid="progress-bar"]');
      const statusText = document.querySelector('[data-testid="status-text"]');
      const resultImages = document.querySelectorAll('[data-testid="result-image"]');
      
      return (
        (progressBar && progressBar.getAttribute('aria-valuenow') === '100') ||
        (statusText && statusText.textContent.includes('完成')) ||
        resultImages.length > 0
      );
    });
    
    if (isCompleted) {
      return true;
    }
    
    await page.waitForTimeout(500);
  }
  
  throw new Error(`Job ${jobId} did not complete within ${timeout}ms`);
}

/**
 * Take screenshot with timestamp
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} name - Screenshot name
 */
async function takeTimestampedScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

/**
 * Verify image upload and preview
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} uploadSelector - Upload button selector
 * @param {string} previewSelector - Preview image selector
 */
async function verifyImageUpload(page, uploadSelector, previewSelector) {
  // Upload image
  await uploadTestImage(page, uploadSelector);
  
  // Wait for preview to appear
  await waitForElement(page, previewSelector);
  
  // Verify preview image is loaded
  const previewImage = page.locator(previewSelector);
  await expect(previewImage).toBeVisible();
  
  // Verify image has valid src
  const src = await previewImage.getAttribute('src');
  expect(src).toBeTruthy();
  expect(src).toMatch(/^(data:|blob:|http)/);
}

/**
 * 设置页面 console 监控
 * @param {import('@playwright/test').Page} page - Playwright page
 */
function setupConsoleMonitoring(page) {
  const consoleMessages = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    consoleMessages.push({ type, text, timestamp: new Date().toISOString() });

    if (type === 'error') {
      consoleErrors.push({ text, timestamp: new Date().toISOString() });
      console.log(`🔴 Console Error: ${text}`);
    } else if (type === 'warning') {
      consoleWarnings.push({ text, timestamp: new Date().toISOString() });
      console.log(`🟡 Console Warning: ${text}`);
    } else if (type === 'log' || type === 'info') {
      console.log(`ℹ️  Console ${type}: ${text}`);
    }
  });

  // 设置页面错误监控
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  });

  // 设置请求失败监控
  page.on('requestfailed', request => {
    console.log(`🌐 Request Failed: ${request.method()} ${request.url()}`);
    console.log(`Failure: ${request.failure()?.errorText || 'Unknown error'}`);
  });

  // 将监控数据附加到页面对象
  page.consoleMessages = consoleMessages;
  page.consoleErrors = consoleErrors;
  page.consoleWarnings = consoleWarnings;

  return { consoleMessages, consoleErrors, consoleWarnings };
}

/**
 * 检查并报告 console 错误
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} testName - Test name for reporting
 */
function checkConsoleErrors(page, testName = 'Test') {
  console.log(`\n📊 ${testName} Console 监控报告:`);
  console.log(`总消息数: ${page.consoleMessages?.length || 0}`);
  console.log(`错误数: ${page.consoleErrors?.length || 0}`);
  console.log(`警告数: ${page.consoleWarnings?.length || 0}`);

  if (page.consoleErrors && page.consoleErrors.length > 0) {
    console.log('\n🔴 Console 错误详情:');
    page.consoleErrors.forEach((error, index) => {
      console.log(`  ${index + 1}. [${error.timestamp}] ${error.text}`);
    });

    // 检查严重错误
    const criticalErrors = page.consoleErrors.filter(error =>
      error.text.includes('Failed to fetch') ||
      error.text.includes('Network Error') ||
      error.text.includes('WebSocket') ||
      error.text.includes('TypeError') ||
      error.text.includes('ReferenceError') ||
      error.text.includes('SyntaxError')
    );

    if (criticalErrors.length > 0) {
      console.log(`\n⚠️ 发现 ${criticalErrors.length} 个严重错误:`);
      criticalErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.text}`);
      });
      return { hasErrors: true, criticalErrors, totalErrors: page.consoleErrors.length };
    }

    return { hasErrors: true, criticalErrors: [], totalErrors: page.consoleErrors.length };
  } else {
    console.log('\n✅ 没有发现 console 错误');
    return { hasErrors: false, criticalErrors: [], totalErrors: 0 };
  }
}

module.exports = {
  waitForElement,
  uploadTestImage,
  mockAPIResponses,
  waitForJobCompletion,
  takeTimestampedScreenshot,
  verifyImageUpload,
  setupConsoleMonitoring,
  checkConsoleErrors
};
