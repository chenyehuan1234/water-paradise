import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createLevel } from '../src/core/level';
import { examples } from '../src/core/examples';

const errorsByPage = new WeakMap<Page, string[]>();
const snapshot = (page: Page) => page.evaluate(() => (window as any).__waterQA.snapshot());
const editCell = async (page: Page, x: number, z: number) => {
  await page.locator('#cell-x').fill(String(x)); await page.locator('#cell-z').fill(String(z)); await page.locator('#apply-cell').click();
};
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?qa'); await expect(page.locator('#board-viewport')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#scene-error')).toBeHidden();
});
test.afterEach(async ({ page }) => { expect(errorsByPage.get(page)).toEqual([]); });

test('seven-step puzzle, invalid move, pause-independent rules and history', async ({ page }) => {
  const initial = await snapshot(page); expect(initial.water.outlets).toHaveLength(2);
  await page.locator('#motion-toggle').click(); const pausedTime = (await snapshot(page)).stats.waterTime;
  await page.locator('canvas').focus(); await page.keyboard.press('s');
  const pushed = await snapshot(page); expect(pushed.state.boxes[0]).toMatchObject({ x: 5, z: 3 }); expect(pushed.water.outlets).toHaveLength(1);
  await page.waitForTimeout(400); expect((await snapshot(page)).stats.waterTime).toBe(pausedTime);
  await page.keyboard.press('z'); expect((await snapshot(page)).state).toEqual(initial.state);
  await page.keyboard.press('y'); expect((await snapshot(page)).state).toEqual(pushed.state);
  for (const key of ['a', 's', 'a', 'a', 'a', 'a']) await page.keyboard.press(key);
  expect((await snapshot(page)).state).toMatchObject({ turn: 7, status: 'won', player: { x: 0, z: 3 } });
  await expect(page.locator('#win-banner')).toBeVisible();
  await page.locator('#undo').click(); await expect(page.locator('#win-banner')).toBeHidden();
  await page.locator('#redo').click(); await expect(page.locator('#win-banner')).toBeVisible();
  await page.locator('#restart').click(); expect((await snapshot(page)).state).toEqual(initial.state);
  // A step onto a box on a different height is rejected without consuming a turn.
  await page.locator('[data-example="rising"]').click(); await page.locator('canvas').focus();
  await page.keyboard.press('d'); expect((await snapshot(page)).state.turn).toBe(0);
  await page.keyboard.press('Space'); expect((await snapshot(page)).state.turn).toBe(1);
});

test('mechanism examples and three water views', async ({ page }, info) => {
  await mkdir('docs/screenshots/phase2', { recursive: true });
  await page.waitForTimeout(500); await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-play-1920.png` });
  await page.locator('[data-example="rising"]').click(); expect((await snapshot(page)).water.cells[2][2].kind).toBe('sheet');
  await page.locator('[data-move="south"]').click(); expect((await snapshot(page)).water.cells[2][2]).toMatchObject({ kind: 'deep', depth: 1 });
  await page.locator('#show-depths').check(); await page.waitForTimeout(450);
  await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-rising-depth.png` });
  await page.locator('[data-example="isolation"]').click(); expect((await snapshot(page)).water.cells[3][6].kind).toBe('sheet');
  await page.locator('[data-move="south"]').click(); expect((await snapshot(page)).water.cells[3][6].kind).toBe('dry');
  await page.locator('#undo').click(); expect((await snapshot(page)).water.cells[3][6].kind).toBe('sheet');
  await page.locator('#show-depths').uncheck(); await page.locator('[data-example="cascade"]').click();
  const water = (await snapshot(page)).water; expect(new Set(water.outlets.map((edge: any) => edge.from)).size).toBeGreaterThan(1);
  expect(water.falls.length).toBeGreaterThan(0); expect(water.outlets.every((edge: any) => edge.from - edge.to === 4)).toBe(true);
  for (const [name, azimuth, elevation] of [['default', 36, 33], ['rear', 216, 33], ['high', 36, 70]] as const) {
    await page.evaluate(([a, e]) => (window as any).__waterQA.setView(a, e), [azimuth, elevation]); await page.waitForTimeout(350);
    await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-cascade-${name}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 }); await page.locator('#reset-camera').click();
  await page.waitForTimeout(300); await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-play-1366.png` });
  for (const id of ['undo', 'redo', 'restart', 'top-view', 'reset-camera', 'motion-toggle', 'mode-edit']) await expect(page.locator('#' + id)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('editor brushes, one-stroke history, camera input isolation and draft copy', async ({ page }, info) => {
  await page.locator('#edit-current').click(); await page.locator('#top-view').click();
  await page.locator('[data-tool="raise"]').click();
  const before = await snapshot(page);
  const points = await page.evaluate(() => [0, 1, 2].map(x => (window as any).__waterQA.projectCell({ x, z: 6 })));
  await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 4 });
  await page.mouse.up();
  const painted = await snapshot(page);
  expect(painted.draft.terrain[6].slice(0, 3)).toEqual([2, 2, 2]);
  expect(painted.camera.azimuth).toBeCloseTo(before.camera.azimuth, 4);
  await page.locator('#undo').click(); expect((await snapshot(page)).draft).toEqual(before.draft);
  await page.locator('#redo').click(); expect((await snapshot(page)).draft).toEqual(painted.draft);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box!.x + box!.width * .55, box!.y + box!.height * .45); await page.mouse.down({ button: 'right' }); await page.mouse.move(box!.x + box!.width * .7, box!.y + box!.height * .6, { steps: 12 }); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(500); const rotated = await snapshot(page);
  expect(rotated.draft).toEqual(painted.draft); expect(Math.abs(rotated.camera.azimuth - painted.camera.azimuth)).toBeGreaterThan(5);
  await page.locator('#play-draft').click(); await page.locator('[data-move="south"]').click();
  expect((await snapshot(page)).state.turn).toBe(1);
  await page.locator('#return-editor').click(); expect((await snapshot(page)).draft).toEqual(painted.draft);
  await page.locator('#show-grid').check(); await page.locator('#show-depths').check(); await page.locator('#top-view').click();
  await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-editor-1920.png` });
  await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-editor-1366.png` });
  for (const id of ['apply-cell', 'play-draft', 'export-level', 'undo', 'reset-camera']) await expect(page.locator('#' + id)).toBeInViewport();
  await page.reload(); await page.locator('#mode-edit').click(); expect((await snapshot(page)).draft).toEqual(painted.draft);
});

test('new draft, validation, keyboard editing and JSON round trip', async ({ page }) => {
  await page.locator('#mode-edit').click(); await page.locator('#new-level').click();
  await expect(page.locator('#new-width')).toHaveValue('12'); await page.locator('#new-name').fill('导出往返测试'); await page.getByRole('button', { name: '创建庭院' }).click();
  await page.locator('#play-draft').click(); await expect(page.locator('#workspace')).toHaveAttribute('data-mode', 'edit'); await expect(page.locator('#validation-list')).toContainText('水源');
  await page.locator('[data-tool="source"]').click(); await editCell(page, 3, 3);
  await page.locator('[data-tool="spawn"]').click(); await editCell(page, 2, 3);
  await expect(page.locator('#validation-list')).toContainText('结构检查通过');
  await page.locator('[data-tool="box"]').click(); await editCell(page, 6, 6);
  await page.locator('[data-tool="plant"]').click(); await editCell(page, 5, 5);
  await page.locator('[data-tool="height"]').click(); await page.locator('#brush-height').fill('12'); await page.locator('#brush-height').press('Tab'); await editCell(page, 5, 5);
  expect((await snapshot(page)).draft.terrain[5][5]).toBe(12);
  const original = (await snapshot(page)).draft;
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
  await expect(page.locator('#toast')).toContainText('导入失败'); expect((await snapshot(page)).draft).toEqual(original);
  const downloading = page.waitForEvent('download'); await page.locator('#export-level').click(); const download = await downloading;
  const text = await readFile((await download.path())!, 'utf8'); expect(JSON.parse(text)).toEqual(original);
  await page.locator('[data-tool="void"]').click(); await editCell(page, 3, 3); expect((await snapshot(page)).draft.source).toBeNull();
  await page.locator('#import-file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  expect((await snapshot(page)).draft).toEqual(original);
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowDown'); expect((await snapshot(page)).draft).toEqual(original); // game input isolated
  await page.keyboard.press('Control+z'); expect((await snapshot(page)).draft.source).toBeNull();
  await page.keyboard.press('Control+y'); expect((await snapshot(page)).draft).toEqual(original);
});

test('reduced motion, orbit limits, zoom and context recovery', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload();
  await expect(page.locator('#board-viewport')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#motion-toggle')).toHaveText('播放动画');
  const paused = await snapshot(page); await page.waitForTimeout(200); expect((await snapshot(page)).stats.waterTime).toBe(paused.stats.waterTime);
  await page.evaluate(() => (window as any).__waterQA.setView(400, 100)); expect((await snapshot(page)).camera.elevation).toBeCloseTo(70);
  await page.evaluate(() => (window as any).__waterQA.setView(-216, 0)); expect((await snapshot(page)).camera.elevation).toBeCloseTo(20);
  const box = await page.locator('canvas').boundingBox(); await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -12000); await page.waitForTimeout(300); expect((await snapshot(page)).camera.zoom).toBeCloseTo(2.4);
  await page.mouse.wheel(0, 24000); await page.waitForTimeout(300); expect((await snapshot(page)).camera.zoom).toBeCloseTo(.55);
  await page.locator('#reset-camera').click(); expect((await snapshot(page)).camera).toMatchObject({ zoom: 1 }); expect((await snapshot(page)).camera.azimuth).toBeCloseTo(36);
  await page.evaluate(() => (window as any).__waterQA.loseContext()); await expect(page.locator('#scene-error')).toBeVisible();
  await page.locator('#reload-game').click(); await expect(page.locator('#board-viewport')).toHaveAttribute('data-ready', 'true'); await expect(page.locator('#scene-error')).toBeHidden();
});

test('storage failure keeps editing and export available', async ({ page }) => {
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; });
  await page.locator('#edit-current').click(); await expect(page.locator('#save-status')).toContainText('保存失败');
  await page.locator('[data-tool="raise"]').click(); await editCell(page, 0, 0);
  expect((await snapshot(page)).draft.terrain[0][0]).toBe(2); await expect(page.locator('#export-level')).toBeEnabled();
  const downloading = page.waitForEvent('download'); await page.locator('#export-level').click(); expect((await downloading).suggestedFilename()).toContain('.json');
});

test('blocked storage and unavailable WebGL fail gracefully', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }); });
  const restricted = await context.newPage(), errors: string[] = [];
  restricted.on('pageerror', error => errors.push(error.message));
  await restricted.goto(baseURL! + '/?qa'); await expect(restricted.locator('#board-viewport')).toHaveAttribute('data-ready', 'true');
  await restricted.locator('#mode-edit').click(); await expect(restricted.locator('#save-status')).toContainText('草稿读取失败');
  await restricted.locator('#editor-example').selectOption('homecoming'); await expect(restricted.locator('#save-status')).toContainText('保存失败');
  await expect(restricted.locator('#export-level')).toBeEnabled();
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: any[]) { return type === 'webgl2' ? null : (getContext as any).call(this, type, ...args); };
  });
  await restricted.reload(); await expect(restricted.locator('#scene-error')).toBeVisible();
  await expect(restricted.locator('#scene-error-message')).toContainText('WebGL 2');
  await expect(restricted.locator('#board-loading')).toBeHidden();
  expect(errors).toEqual([]); await context.close();
});

test('32 by 32 benchmark and rendering samples', async ({ page, browser }, info) => {
  const level = createLevel(32, 32); level.name = '32 × 32 验收庭院'; level.source = { x: 16, z: 16 }; level.spawn = { x: 12, z: 12 };
  for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) level.terrain[z][x] = Math.floor((31 - z) / 5);
  // Include all supported height bands and an internal void without disconnecting the terrain.
  for (let x = 0; x < 13; x++) level.terrain[0][x] = x;
  level.terrain[20][20] = null;
  await page.evaluate(level => (window as any).__waterQA.loadDraft(level), level);
  await page.locator('#show-depths').check(); await page.locator('#show-grid').check(); await page.waitForTimeout(800);
  const result = await page.evaluate(async () => {
    const qa = (window as any).__waterQA, samples = [];
    const benchmark = qa.benchmark(100);
    for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 500)); samples.push(qa.snapshot().stats); }
    const gl = document.querySelector('canvas')!.getContext('webgl2')!, extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { benchmark, samples, userAgent: navigator.userAgent, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
  });
  await writeFile(`docs/phase2-${info.project.name}-performance.json`, JSON.stringify({ browser: browser.version(), viewport: page.viewportSize(), ...result }, null, 2));
  await page.screenshot({ path: `docs/screenshots/phase2/${info.project.name}-maximum-map.png` });
  expect(result.benchmark.mean).toBeLessThan(50);
  await page.locator('#play-draft').click(); expect((await snapshot(page)).mode).toBe('play');
});

test('imported examples exactly match the shared schema', async ({ page }) => {
  await page.locator('#mode-edit').click();
  for (const example of examples) {
    await page.locator('#import-file').setInputFiles({ name: `${example.id}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(example.level)) });
    expect((await snapshot(page)).draft).toEqual(example.level);
    await expect(page.locator('#validation-list')).toContainText('结构检查通过');
  }
});
