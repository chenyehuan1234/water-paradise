import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const errorsByPage = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/showcase.html?qa');
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#error')).toBeHidden();
});

test.afterEach(async ({ page }) => { expect(errorsByPage.get(page)).toEqual([]); });

test('composition, three views, resize and measured performance', async ({ page, browser }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('docs/screenshots', { recursive: true });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-default-1920.png` });
  const samples = await page.evaluate(async () => {
    const qa = (window as any).__gardenQA;
    const values: any[] = [];
    for (let i = 0; i < 10; i++) { await new Promise(resolve => setTimeout(resolve, 1000)); values.push(qa.snapshot()); }
    return { samples: values, userAgent: navigator.userAgent, renderer: (() => {
      const gl = document.querySelector('canvas')!.getContext('webgl2')!;
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    })() };
  });
  await writeFile(`docs/${info.project.name}-performance.json`, JSON.stringify({ browser: browser.version(), viewport: page.viewportSize(), ...samples }, null, 2));
  await page.evaluate(() => (window as any).__gardenQA.setView(216, 33));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-rear-1920.png` });
  await page.evaluate(() => (window as any).__gardenQA.setView(36, 70));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-high-1920.png` });
  await page.getByRole('button', { name: '重置视角' }).click();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-default-1366.png` });
  for (const name of ['重置视角', '暂停动画', '显示网格']) {
    const button = page.getByRole('button', { name });
    await expect(button).toBeInViewport();
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-narrow-390.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('pointer orbit, elevation and zoom limits, reset, pause and grid', async ({ page }) => {
  const snapshot = () => page.evaluate(() => (window as any).__gardenQA.snapshot());
  const initial = await snapshot();
  await page.mouse.move(980, 450); await page.mouse.down(); await page.mouse.move(1370, 690, { steps: 16 }); await page.mouse.up();
  await page.waitForTimeout(650);
  const moved = await snapshot();
  expect(Math.abs(moved.azimuth - initial.azimuth)).toBeGreaterThan(20);
  expect(moved.elevation).toBeGreaterThanOrEqual(19.999);
  expect(moved.elevation).toBeLessThanOrEqual(70.001);
  await page.mouse.wheel(0, -8000); await page.waitForTimeout(400);
  expect((await snapshot()).zoom).toBeCloseTo(1.65, 2);
  await page.mouse.wheel(0, 12000); await page.waitForTimeout(400);
  expect((await snapshot()).zoom).toBeCloseTo(.72, 2);
  await page.getByRole('button', { name: '重置视角' }).click();
  await page.waitForTimeout(200);
  expect((await snapshot()).zoom).toBe(1);
  expect((await snapshot()).azimuth).toBeCloseTo(36, 3);
  expect((await snapshot()).elevation).toBeCloseTo(33, 3);
  await page.getByRole('button', { name: '暂停动画' }).click();
  const pausedAt = (await snapshot()).elapsed;
  await page.waitForTimeout(350);
  expect((await snapshot()).elapsed).toBe(pausedAt);
  await expect(page.getByRole('button', { name: '播放动画' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '播放动画' }).click();
  await page.waitForTimeout(350);
  expect((await snapshot()).elapsed).toBeGreaterThan(pausedAt);
  await page.getByRole('button', { name: '显示网格' }).click();
  expect((await snapshot()).gridVisible).toBe(true);
  await page.screenshot({ path: `docs/screenshots/grid-${test.info().project.name}.png` });
  await page.getByRole('button', { name: '隐藏网格' }).click();
  expect((await snapshot()).gridVisible).toBe(false);
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowLeft');
  expect((await snapshot()).elevation).toBeCloseTo(38, 2);
  await page.keyboard.press('r'); expect((await snapshot()).elevation).toBeCloseTo(33, 2);
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: '重置视角' })).toBeFocused();
});

test('reduced motion begins paused and explicit playback works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '播放动画' })).toHaveAttribute('aria-pressed', 'true');
  const time = await page.evaluate(() => (window as any).__gardenQA.snapshot().elapsed);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__gardenQA.snapshot().elapsed)).toBe(time);
  await page.getByRole('button', { name: '播放动画' }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__gardenQA.snapshot().elapsed)).toBeGreaterThan(time);
});

test('context loss gives a recoverable message', async ({ page }) => {
  await page.evaluate(() => (window as any).__gardenQA.loseContext());
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('图形连接已中断，请点击“重新打开”恢复庭院。')).toBeVisible();
  await page.getByRole('button', { name: '重新打开' }).click();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('unavailable WebGL shows a readable startup error', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: any[]) {
      if (type === 'webgl2') return null;
      return (getContext as any).call(this, type, ...args);
    };
  });
  const unsupported = await context.newPage();
  const unhandled: string[] = [];
  unsupported.on('pageerror', error => unhandled.push(error.message));
  await unsupported.goto(baseURL! + '/showcase.html');
  await expect(unsupported.getByRole('alert')).toBeVisible();
  await expect(unsupported.getByText('无法创建三维画面。请使用支持 WebGL 2 的 Chrome 或 Edge，并检查浏览器硬件加速设置。')).toBeVisible();
  await expect(unsupported.locator('#loading')).toBeHidden();
  await expect(unsupported.locator('.controls')).toBeHidden();
  await expect(unsupported.getByRole('button', { name: '重新打开' })).toBeInViewport();
  await unsupported.screenshot({ path: `docs/screenshots/${info.project.name}-unsupported.png` });
  expect(unhandled).toEqual([]);
  await context.close();
});
