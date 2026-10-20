const { test, expect } = require('@playwright/test');
const { setAuthToken } = require('./utils/auth.js');
const { takeTimestampedScreenshot, setupConsoleMonitoring } = require('./utils/test-helpers.js');

test.describe('Image Preview Modal DOM and layering', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
    await setAuthToken(page);

    const portrait = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900"><rect width="100%" height="100%" fill="#4F46E5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="48">PORTRAIT</text></svg>'
    )}`;

    await page.route('**/img/images**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          images: [
            { url: portrait, name: 'portrait-test', path: 'portrait-test' }
          ],
          pagination: { total: 1 }
        })
      });
    });

    await page.route('**/img/history**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          images: [{ url: portrait, name: 'history-portrait', path: 'history-portrait' }]
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('open gallery preview and capture DOM info', async ({ page }) => {
    await page.evaluate(async () => {
      const existing = document.querySelector('[data-testid="pv-harness-root"]');
      if (existing) existing.remove();

      const { createApp, h, ref } = await import('/@id/vue');
      const GalleryCard = (await import('/src/components/GalleryCard.vue')).default;
      const ImagePreviewModal = (await import('/src/components/ui/ImagePreviewModal.vue')).default;

      const portrait = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900"><rect width="100%" height="100%" fill="#4F46E5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="48">PORTRAIT</text></svg>'
      )}`;

      const root = document.createElement('div');
      root.setAttribute('data-testid', 'pv-harness-root');
      root.style.position = 'fixed';
      root.style.left = '12px';
      root.style.top = '12px';
      root.style.width = '260px';
      root.style.zIndex = '99999';
      document.body.appendChild(root);

      const visible = ref(false);
      const image = ref(null);
      const openPreview = (img) => {
        image.value = img;
        visible.value = true;
      };

      const app = createApp({
        setup() {
          const cardImage = { url: portrait, name: 'portrait-test', path: 'portrait-test' };
          return () =>
            h('div', { class: 'flex flex-col gap-2' }, [
              h(GalleryCard, {
                image: cardImage,
                variant: 'folded',
                clickable: true,
                showActions: false,
                onDblclick: () => openPreview(cardImage)
              }),
              h(ImagePreviewModal, {
                visible: visible.value,
                image: image.value,
                showActions: true,
                onClose: () => {
                  visible.value = false;
                  image.value = null;
                }
              })
            ]);
        }
      });

      app.mount(root);
    });

    const firstGalleryCard = page.locator('[data-testid="pv-harness-root"] [data-testid="gallery-card"]').first();
    await firstGalleryCard.waitFor({ state: 'visible', timeout: 8000 });
    await firstGalleryCard.dblclick();
    await page.waitForTimeout(300);
    const modalSelector = '[data-testid="image-preview-modal"]';
    await page.waitForSelector(modalSelector, { state: 'visible', timeout: 5000 });


    const domInfo = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="image-preview-modal"]');
      if (!modal) {
        return {
          found: false,
          message: 'Modal root not found by selector',
        };
      }

      const parent = modal.parentElement;
      const toolbar = modal.querySelector('[data-testid="image-preview-toolbar"], header, .preview-toolbar');
      const headerBar = document.querySelector('header, .top-bar, [data-testid="app-header"]');
      const previewImg = modal.querySelector('img');

      const modalStyle = window.getComputedStyle(modal);
      const toolbarRect = toolbar ? toolbar.getBoundingClientRect() : null;
      const headerRect = headerBar ? headerBar.getBoundingClientRect() : null;
      const imgRect = previewImg ? previewImg.getBoundingClientRect() : null;
      const viewport = { w: window.innerWidth, h: window.innerHeight };

      return {
        found: true,
        parentTag: parent ? parent.tagName : null,
        isBodyChild: !!parent && parent.tagName === 'BODY',
        modalZIndex: modalStyle.zIndex,
        toolbarRect,
        headerRect,
        imgRect,
        viewport,
      };
    });

    await takeTimestampedScreenshot(page, 'preview-modal-open');

    expect(domInfo.found).toBeTruthy();
    expect(domInfo.isBodyChild).toBeTruthy();
    expect(domInfo.imgRect).toBeTruthy();
    expect(domInfo.imgRect.bottom).toBeLessThanOrEqual(domInfo.viewport.h);
    expect(domInfo.imgRect.right).toBeLessThanOrEqual(domInfo.viewport.w);

    const img = page.locator('[data-testid="image-preview-modal"] img').first();
    const box = await img.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(150);

    const afterZoom = await img.evaluate((el) => el.style.transform || '');
    expect(afterZoom.includes('scale(')).toBeTruthy();

    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80);
    await page.mouse.up();
    await page.waitForTimeout(150);

    const afterPan = await img.evaluate((el) => el.style.transform || '');
    expect(afterPan).not.toEqual(afterZoom);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(200);

    const afterZoomOut = await img.evaluate((el) => el.style.transform || '');
    expect(afterZoomOut).toMatch(/scale\(1(\.0+)?\)/);
  });
});
