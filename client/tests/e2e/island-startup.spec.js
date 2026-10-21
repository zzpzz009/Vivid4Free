const { test, expect } = require('@playwright/test')

async function prepare(page, { skin = 'animal-island', seen = false, islandSeen = false } = {}) {
  await page.addInitScript(({ skin, seen, islandSeen }) => {
    localStorage.setItem('ui:rightPanel', JSON.stringify({ skin }))
    if (seen) localStorage.setItem('vivid-desktop:startup-intro:v1', 'seen')
    if (islandSeen) localStorage.setItem('vivid-desktop:startup-intro:animal-island:v1', 'seen')
    window.vividDesktop = {
      accountStatus: async () => ({ status: 'signed_out' }),
      runtimeStatus: async () => ({ installed: true, state: 'ready' }),
      onWindowState: () => () => {},
      windowState: async () => ({ maximized: false })
    }
  }, { skin, seen, islandSeen })
  await page.route('**/api/**', route => route.fulfill({ json: {
    success: true, data: [], jobs: [], images: [], categories: [],
    runtime: { installed: true, state: 'ready' }, capabilities: { render: { ready: true } }
  } }))
  await page.route('**/img/**', route => route.fulfill({ json: { success: true, images: [], pagination: { total: 0 } } }))
}

test('island intro finishes, restores interaction and keeps the existing once-only rule', async ({ page }) => {
  await prepare(page)
  await page.goto('/')
  const overlay = page.locator('[data-startup-intro]')
  await expect(overlay).toHaveAttribute('data-startup-skin', 'animal-island')
  await expect(overlay.locator('.island-emblem > svg')).toBeVisible()
  await expect(page.locator('#app')).toHaveAttribute('inert', '')
  await expect(overlay).toHaveCount(0, { timeout: 8000 })
  await expect(page.locator('#app')).not.toHaveAttribute('inert', '')
  expect(await page.evaluate(() => localStorage.getItem('vivid-desktop:startup-intro:animal-island:v1'))).toBe('seen')
  await expect(page.locator('.island-brand-mark')).toBeVisible()
  await page.reload()
  await expect(page.locator('.desktop-toolbar')).toBeVisible()
  await expect(overlay).toHaveCount(0)
})

for (const method of ['button', 'Escape']) {
  test(`island intro can be skipped using ${method}`, async ({ page }) => {
    await prepare(page)
    await page.goto('/')
    await expect(page.locator('#skip')).toBeFocused()
    if (method === 'button') await page.locator('#skip').click()
    else await page.keyboard.press('Escape')
    await expect(page.locator('[data-startup-intro]')).toHaveCount(0)
    await page.getByRole('button', { name: '切换海岛皮肤', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-vivid-skin', 'original')
  })
}

test('reduced motion shows a static logo and quickly restores the workbench', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await prepare(page)
  await page.goto('/')
  await expect(page.locator('.island-ribbon')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('[data-startup-intro]')).toHaveCount(0, { timeout: 3000 })
  await expect(page.locator('#app')).not.toHaveAttribute('aria-hidden', 'true')
})

test('compact intro stays inside the viewport with a reachable skip control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await prepare(page)
  await page.goto('/')
  const skip = page.locator('#skip')
  await expect(skip).toBeVisible()
  const bounds = await skip.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(720)
  // Tide artwork extends past the edge intentionally; the visible scene clips it.
  await expect(page.locator('#island-intro')).toHaveCSS('overflow-x', 'hidden')
  for (const selector of ['.island-emblem', '.island-wordmark']) {
    const content = await page.locator(selector).boundingBox()
    expect(content.x).toBeGreaterThanOrEqual(0)
    expect(content.x + content.width).toBeLessThanOrEqual(390)
  }
  await skip.click()
})

test('an unavailable island asset fails open without recording successful playback', async ({ page }) => {
  await prepare(page)
  await page.route(/\/(?:src\/components\/startup\/island\.html\?raw|assets\/island-[\w-]+\.js)/, route => route.abort())
  await page.goto('/')
  await expect(page.locator('[data-startup-intro]')).toHaveCount(0)
  await expect(page.locator('.desktop-toolbar')).toBeVisible()
  await expect(page.locator('#app')).not.toHaveAttribute('aria-hidden', 'true')
  expect(await page.evaluate(() => localStorage.getItem('vivid-desktop:startup-intro:animal-island:v1'))).toBeNull()
})

test('classic skin still receives the original animation', async ({ page }) => {
  await prepare(page, { skin: 'original' })
  await page.goto('/')
  await expect(page.locator('[data-startup-intro]')).toHaveAttribute('data-startup-skin', 'original')
  await expect(page.locator('.logo-art')).toBeVisible()
  await page.locator('#skip').click()
  await expect(page.locator('[data-startup-intro]')).toHaveCount(0)
})

test('watching the classic intro does not suppress the first island startup', async ({ page }) => {
  await prepare(page, { seen: true })
  await page.goto('/')
  await expect(page.locator('[data-startup-intro]')).toHaveAttribute('data-startup-skin', 'animal-island')
  await page.locator('#skip').click()
  await expect(page.locator('[data-startup-intro]')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('vivid-desktop:startup-intro:v1'))).toBe('seen')
  expect(await page.evaluate(() => localStorage.getItem('vivid-desktop:startup-intro:animal-island:v1'))).toBe('seen')
})

test('a seen island intro is skipped even when the classic intro has not played', async ({ page }) => {
  await prepare(page, { islandSeen: true })
  await page.goto('/')
  await expect(page.locator('.desktop-toolbar')).toBeVisible()
  await expect(page.locator('[data-startup-intro]')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('vivid-desktop:startup-intro:v1'))).toBeNull()
})
