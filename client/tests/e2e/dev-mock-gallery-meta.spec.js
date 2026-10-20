const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')

function ensureFixtureInTempGallery() {
  const rootDir = process.cwd()
  const dstDir = path.resolve(rootDir, 'temp', 'gallery', 'common')
  fs.mkdirSync(dstDir, { recursive: true })
  const jpgSrc = path.resolve(rootDir, 'tests', 'e2e', 'fixtures', 'test-image.jpg')
  fs.copyFileSync(jpgSrc, path.join(dstDir, 'test-image.jpg'))
  const pngSrc = path.resolve(rootDir, 'src', 'assets', 'images', 'rectangle-100.png')
  fs.copyFileSync(pngSrc, path.join(dstDir, 'rectangle-100.png'))
}

function buildAppUrl(testInfo, targetPath = '/') {
  const baseUrl = testInfo.project.use.baseURL || 'http://localhost:3000'
  return new URL(targetPath, baseUrl).toString()
}

test.beforeAll(() => {
  ensureFixtureInTempGallery()
})

test('dev mock: /img/images provides pagination + apiVersion', async ({ request }, testInfo) => {
  const response = await request.get(buildAppUrl(testInfo, '/img/images?page=1&limit=2&orderBy=name&orderDirection=ASC&v=1'))
  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.apiVersion).toBe(1)
  expect(json.success).toBeTruthy()
  expect(Array.isArray(json.images)).toBeTruthy()
  expect(json.pagination).toBeTruthy()
  expect(json.pagination.page).toBe(1)
  expect(json.pagination.limit).toBe(2)
  expect(typeof json.pagination.total).toBe('number')
})

test('dev mock: /img/meta returns width/height/aspectRatio', async ({ request }, testInfo) => {
  const response = await request.post(buildAppUrl(testInfo, '/img/meta?v=1'), {
    data: [{ url: '/gallery/common/rectangle-100.png' }]
  })
  expect(response.ok()).toBeTruthy()
  const json = await response.json()
  expect(json.apiVersion).toBe(1)
  expect(json.success).toBeTruthy()
  expect(Array.isArray(json.metas)).toBeTruthy()
  const first = json.metas[0]
  expect(first.url).toContain('/gallery/common/rectangle-100.png')
  expect(first.status).toBe('ok')
  expect(typeof first.width).toBe('number')
  expect(typeof first.height).toBe('number')
  expect(typeof first.aspectRatio).toBe('number')
})

test('probeImageMeta computes dominantColor and lqip in browser', async ({ page }, testInfo) => {
  await page.goto(buildAppUrl(testInfo), { waitUntil: 'domcontentloaded' })
  const meta = await page.evaluate(async () => {
    const { probeImageMeta } = await import('/src/utils/imageMeta.js')
    return probeImageMeta('/gallery/common/rectangle-100.png', { computeDominantColor: true, computeLqip: true, timeoutMs: 8000 })
  })
  expect(meta).toBeTruthy()
  expect(typeof meta.aspectRatio).toBe('number')
  expect(typeof meta.dominantColor).toBe('string')
  expect(meta.dominantColor.startsWith('rgb(')).toBeTruthy()
  expect(typeof meta.lqip).toBe('string')
  expect(meta.lqip.startsWith('data:image/jpeg')).toBeTruthy()
})
