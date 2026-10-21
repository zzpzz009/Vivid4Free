const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const fixture = path.resolve(__dirname, '../../src/assets/images/rectangle-150.png')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vivid-desktop:startup-intro:v1', 'seen')
    window.vividDesktop = {
      accountStatus: async () => ({ status: 'signed_out' }),
      runtimeStatus: async () => ({ installed: true, state: 'ready', version: '0.3.0' }),
      onWindowState: () => () => {},
      windowState: async () => ({ maximized: false })
    }
  })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    const result = url.pathname.includes('capabilities')
      ? { runtime: { installed: true, state: 'ready' }, capabilities: { render: { ready: true } } }
      : { success: true, data: [], jobs: [], images: [], categories: [] }
    return route.fulfill({ json: result })
  })
  await page.route('**/img/**', route => route.fulfill({ json: { success: true, images: [{ name: '皮肤检查图', url: '/gallery/skin-fixture.png', width: 300, height: 200, aspectRatio: 1.5 }], pagination: { total: 1 } } }))
  await page.route('**/gallery/skin-fixture.png', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(fixture) }))
  await page.route('**/comfy/upload/image', route => route.fulfill({ json: { name: 'skin-fixture.png', subfolder: '', type: 'input' } }))
  await page.route('**/comfy/view**', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(fixture) }))
  await page.goto('/')
})

test('switches both ways without losing inputs and remembers the skin after reload', async ({ page }) => {
  const toggle = page.getByRole('button', { name: '切换海岛皮肤', exact: true })
  await expect(page.locator('html')).toHaveAttribute('data-vivid-skin', 'original')
  await expect(page.locator('.desktop-toolbar')).toHaveCSS('background-color', 'rgb(32, 30, 37)')
  await expect(page.locator('.skin-swatch')).toHaveCSS('background-image', /rgb\(33, 31, 38\).*rgb\(208, 188, 255\)/)
  await page.locator('#workspace-seed').fill('2345')
  await page.locator('#workspace-seed').blur()
  await page.locator('#workspace-inputs input[type=file]').first().setInputFiles(fixture)
  await expect(page.locator('#workspace-inputs img[alt="rectangle-150.png"]')).toBeVisible()
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-vivid-skin', 'animal-island')
  await expect(page.locator('.skin-swatch')).toHaveCSS('background-image', /rgb\(25, 200, 185\).*rgb\(247, 243, 223\)/)
  await expect(page.locator('.island-upload-card.animal-card')).toHaveCount(2)
  await expect(page.locator('#workspace-seed')).toHaveValue('2345')
  await expect(page.locator('#workspace-inputs img[alt="rectangle-150.png"]')).toBeVisible()
  await page.getByRole('switch', { name: '添加配景' }).click()
  await expect(page.getByRole('switch', { name: '添加配景' })).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(page.locator('#workspace-scene')).not.toBeChecked()
  await expect(page.locator('#workspace-seed')).toHaveValue('2345')
  await toggle.click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-vivid-skin', 'animal-island')
  await expect(page.locator('#workspace-seed')).toHaveValue('2345')
  await expect(page.getByRole('switch', { name: '添加配景' })).toHaveAttribute('aria-checked', 'false')
})

test('settings, native form validation and teleported image previews work in the second skin', async ({ page }) => {
  await page.locator('.account-entry').click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: /Animal Island · 海岛/ }).click()
  await expect(page.getByRole('button', { name: /Animal Island · 海岛/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '返回账号', exact: true }).click()
  await expect(page.getByRole('button', { name: '登录', exact: true })).toHaveAttribute('type', 'submit')
  expect(await page.locator('.account-form').evaluate(form => form.checkValidity())).toBe(false)
  await page.keyboard.press('Escape')
  await page.getByTestId('right-tab-gallery').click()
  await page.locator('[data-testid="gallery-card"]:visible').first().dblclick()
  const modal = page.getByTestId('image-preview-modal')
  await expect(modal).toBeVisible()
  expect(await modal.evaluate(el => el.parentElement === document.body)).toBe(true)
  await expect(modal.locator('.bg-schemes-surface')).toHaveCSS('background-color', 'rgb(247, 243, 223)')
  expect(await modal.locator('img').first().evaluate(el => getComputedStyle(el).filter)).toBe('none')
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
})

test('compact layout, keyboard navigation and reduced motion stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const toggle = page.getByRole('button', { name: '切换海岛皮肤', exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-vivid-skin', 'animal-island')
  await expect(page.locator('.island-boat')).toHaveCSS('animation-name', 'none')
  await page.getByTestId('workspace-tab-workspace').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('workspace-tab-creative-workshop')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('此功能尚未开放。')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.island-seascape')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '切换输入面板' }).click()
  await expect(page.getByTestId('unified-sidebar')).toBeHidden()
})

test('preserves the original large layout and keeps both action modes in a continuous pill', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 960 })
  const selectors = ['.desktop-toolbar', '.workspace-header', '#workspace-inputs', '.workspace-canvas', '#desktop-resources']
  const before = await Promise.all(selectors.map(selector => page.locator(selector).boundingBox()))
  await page.getByRole('button', { name: '切换海岛皮肤', exact: true }).click()
  const after = await Promise.all(selectors.map(selector => page.locator(selector).boundingBox()))
  selectors.forEach((selector, index) => {
    for (const dimension of ['x', 'y', 'width', 'height']) expect(Math.abs(before[index][dimension] - after[index][dimension]), `${selector} ${dimension}`).toBeLessThanOrEqual(1)
  })
  for (const mode of ['放大', '预览']) {
    await page.getByTestId('primary-action-dropdown').click()
    await page.getByRole('menuitem', { name: mode, exact: true }).click()
    await expect(page.getByTestId('primary-action-button')).toContainText(mode)
    const primary = await page.getByTestId('primary-action-button').boundingBox()
    const dropdown = await page.getByTestId('primary-action-dropdown').boundingBox()
    expect(Math.abs(primary.x + primary.width - dropdown.x)).toBeLessThanOrEqual(1)
    await expect(page.getByTestId('primary-action-button')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.getByTestId('primary-action-dropdown')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.getByTestId('primary-action-button')).toHaveCSS('box-shadow', 'none')
    await expect(page.getByTestId('primary-action-dropdown')).toHaveCSS('box-shadow', 'none')
  }
})

test('uses the library font on legacy text classes and readable neutral comparison labels', async ({ page }) => {
  await page.getByRole('button', { name: '切换海岛皮肤', exact: true }).click()
  for (const selector of ['.nav-tab-text-active', '.nav-tab-text-inactive', '.button-text-primary', '.button-text-secondary', '#workspace-seed']) {
    await expect(page.locator(selector).first()).toHaveCSS('font-family', /Nunito.*Noto Sans SC/)
  }
  await expect(page.locator('.nav-tab-text-active')).toHaveCSS('letter-spacing', '0.24px')
  await expect(page.locator('.button-text-primary')).toHaveCSS('letter-spacing', '0.28px')
  await page.getByTestId('right-tab-gallery').click()
  await page.locator('[data-testid="gallery-card"]:visible').first().click()
  // The fixture supplies a remembered result so the actual comparison component renders.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('ui:rightPanel'))
    localStorage.setItem('ui:rightPanel', JSON.stringify({ ...state, selectedResultJobId: 'skin-result', selectedResultUrl: '/gallery/skin-fixture.png', selectedResultInputUrl: '/gallery/skin-fixture.png' }))
  })
  await page.reload()
  await expect(page.locator('.comparison-label')).toHaveCount(2)
  for (const label of await page.locator('.comparison-label').all()) {
    await expect(label).toHaveCSS('color', 'rgb(121, 79, 39)')
    await expect(label).toHaveCSS('background-color', 'rgb(248, 248, 240)')
    await expect(label).toHaveCSS('font-family', /Nunito.*Noto Sans SC/)
  }
  // The bundled font faces must load, rather than only declaring their names.
  expect(await page.evaluate(async () => {
    await document.fonts.load('500 14px Nunito', 'VividDesktop')
    await document.fonts.load('500 14px "Noto Sans SC"', '工作区结果图')
    return document.fonts.check('500 14px Nunito') && document.fonts.check('500 14px "Noto Sans SC"')
  })).toBe(true)
})
