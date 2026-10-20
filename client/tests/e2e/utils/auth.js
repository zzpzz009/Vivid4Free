/**
 * Authentication utilities for E2E tests
 */

const jwt = require('jsonwebtoken');

// Test JWT secret (for testing only)
const TEST_JWT_SECRET = 'test-secret-key-for-e2e-testing-only';

/**
 * Generate a test JWT token
 * @param {Object} payload - Token payload
 * @param {Object} options - JWT options
 * @returns {string} JWT token
 */
function generateTestToken(payload = {}, options = {}) {
  const defaultPayload = {
    userId: 'test-user-123',
    username: 'test-admin',
    role: 'admin',
    permissions: ['read', 'write', 'admin'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    ...payload
  };

  const defaultOptions = {
    algorithm: 'HS256',
    ...options
  };

  return jwt.sign(defaultPayload, TEST_JWT_SECRET, defaultOptions);
}

/**
 * Generate an expired test token
 * @returns {string} Expired JWT token
 */
function generateExpiredToken() {
  return generateTestToken({
    exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
  });
}

/**
 * Generate an invalid test token
 * @returns {string} Invalid JWT token
 */
function generateInvalidToken() {
  return 'invalid.jwt.token';
}

/**
 * Set authentication token in browser storage
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} token - JWT token
 */
async function setAuthToken(page, token = null) {
  const authToken = token || generateTestToken();
  
  await page.addInitScript((token) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_info', JSON.stringify({
      userId: 'test-user-123',
      username: 'test-admin',
      role: 'admin'
    }));
  }, authToken);
  
  return authToken;
}

/**
 * Clear authentication from browser storage
 * @param {import('@playwright/test').Page} page - Playwright page
 */
async function clearAuth(page) {
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    sessionStorage.clear();
  });
}

/**
 * Check if user is authenticated
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {boolean} Authentication status
 */
async function isAuthenticated(page) {
  return await page.evaluate(() => {
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    return !!(token && userInfo);
  });
}

/**
 * Mock authentication API responses
 * @param {import('@playwright/test').Page} page - Playwright page
 */
async function mockAuthAPI(page) {
  // Mock login endpoint
  await page.route('**/api/auth/login', async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();
    
    if (postData.username === 'admin' && postData.password === 'password') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: generateTestToken(),
          user: {
            userId: 'test-user-123',
            username: 'admin',
            role: 'admin'
          }
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Invalid credentials'
        })
      });
    }
  });

  // Mock token validation endpoint
  await page.route('**/api/auth/validate', async (route) => {
    const authHeader = route.request().headers()['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          valid: true,
          user: {
            userId: 'test-user-123',
            username: 'admin',
            role: 'admin'
          }
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          valid: false,
          message: 'Invalid token'
        })
      });
    }
  });

  // Mock logout endpoint
  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      })
    });
  });
}

module.exports = {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
  setAuthToken,
  clearAuth,
  isAuthenticated,
  mockAuthAPI
};
