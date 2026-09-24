import './game.css';
import { examples } from './core/examples';
import { GameController } from './core/game';
import { createLevel, parseLevel, serializeLevel, validatePlayable } from './core/level';
import { cloneLevel, groundAt, sameCell } from './core/types';
import type { Cell, Direction, LevelDataV1, WaterSolution } from './core/types';
import { solveWater } from './core/water';
import { EditorSession, loadDraft, saveDraft } from './editor/session';
import type { EditorTool } from './editor/session';
import { BoardView } from './game-view/view';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id);
const button = (id: string) => el<HTMLButtonElement>(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const saved = loadDraft();
const editor = new EditorSession(saved.level ?? createLevel());
let game = new GameController(examples[0].level);
let mode: 'play' | 'edit' = 'play';
let origin: 'example' | 'editor' = 'example';
let exampleId = examples[0].id;
let editorWater: WaterSolution = solveWater(editor.level);
let solveMs = 0;
let renderedSize = '';
let view: BoardView | null = null;
let toastTimer = 0;
let saveError = saved.error;
const listeners = new AbortController();
const on = (target: EventTarget, name: string, handler: EventListener) => target.addEventListener(name, handler, { signal: listeners.signal });
function toast(message: string) {
  clearTimeout(toastTimer); el('toast').textContent = message; el('toast').hidden = false;
  toastTimer = window.setTimeout(() => { el('toast').hidden = true; }, 6000);
}
function persist() {
  saveError = saveDraft(editor.level);
  el('save-status').textContent = saveError ? '保存失败 · 请导出' : '已自动保存';
  el('save-status').dataset.error = String(!!saveError);
  if (saveError) toast(saveError);
}
function fail(message: string) { el('board-loading').hidden = true; el('scene-error').hidden = false; el('scene-error-message').textContent = message; }
function inspect(cell = editor.selected) {
  if (!cell) { for (const id of ['cell-ground', 'cell-kind', 'cell-level', 'cell-depth', 'cell-outlets']) el(id).textContent = '—'; return; }
  const h = groundAt(editor.level, cell), water = editorWater.cells[cell.z]?.[cell.x];
  if (document.activeElement !== input('cell-x')) input('cell-x').value = String(cell.x);
  if (document.activeElement !== input('cell-z')) input('cell-z').value = String(cell.z);
  el('cell-ground').textContent = h === null ? '虚空' : String(h);
  el('cell-kind').textContent = !water ? '—' : { dry: '干燥', sheet: '平流层', deep: '深水' }[water.kind];
  el('cell-level').textContent = water && water.kind !== 'dry' ? String(water.level) : '—';
  el('cell-depth').textContent = water && water.kind !== 'dry' ? `${water.depth} 格` : '—';
  const names = { north: '北', east: '东', south: '南', west: '西' };
  el('cell-outlets').textContent = editorWater.outlets.filter(edge => sameCell(cell, edge)).map(edge => names[edge.direction]).join('、') || '无';
}
function updateUI() {
  const editing = mode === 'edit';
  el('workspace').dataset.mode = mode;
  el('play-panel').hidden = editing; el('editor-panel').hidden = !editing; el('inspector').hidden = !editing;
  button('mode-play').setAttribute('aria-pressed', String(!editing)); button('mode-edit').setAttribute('aria-pressed', String(editing));
  el('move-controls').hidden = editing; button('restart').hidden = editing;
  button('undo').disabled = editing ? !editor.canUndo : !game.canUndo;
  button('redo').disabled = editing ? !editor.canRedo : !game.canRedo;
  el('stage-title').textContent = editing ? editor.level.name : game.level.name;
  const example = examples.find(item => item.id === exampleId)!;
  el('stage-kicker').textContent = editing ? '关卡编辑 / 即时水流预览' : origin === 'editor' ? '编辑稿试玩 / 独立副本' : example.subtitle;
  el('turn-count').textContent = editing ? '—' : String(game.state.turn);
  el('outlet-count').textContent = String((editing ? editorWater : game.water).outlets.length);
  el('input-hint').innerHTML = editing ? '左键绘制 · 右键环绕 · 滚轮缩放<br />Ctrl+Z 撤销 · 一次拖动为一次操作' : 'WASD / 方向键移动 · 空格等待<br />拖动环绕 · 滚轮缩放';
  el('win-banner').hidden = editing || game.state.status !== 'won';
  el('scenario-description').textContent = origin === 'editor' ? '这里是编辑稿的独立副本。退出试玩后，继续编辑最初的布局。' : example.description;
  button('return-editor').hidden = origin !== 'editor'; button('edit-current').hidden = origin === 'editor';
  document.querySelectorAll<HTMLButtonElement>('[data-example]').forEach(node => node.setAttribute('aria-pressed', String(origin === 'example' && node.dataset.example === exampleId)));
  if (document.activeElement !== input('level-name')) input('level-name').value = editor.level.name;
  el('map-size').textContent = `${editor.level.width} × ${editor.level.depth}`;
  input('cell-x').max = String(editor.level.width - 1); input('cell-z').max = String(editor.level.depth - 1);
  const errors = validatePlayable(editor.level), list = el('validation-list'); list.replaceChildren(); list.className = errors.length ? '' : 'valid';
  for (const error of errors.length ? errors : ['结构检查通过，可以试玩。', '谜题是否可解，留给你的探索。']) { const item = document.createElement('li'); item.textContent = error; list.appendChild(item); }
  inspect();
}
function sync(options = { fit: false, animate: true }) {
  if (mode === 'edit') { const start = performance.now(); editorWater = solveWater(editor.level); solveMs = performance.now() - start; }
  const level = mode === 'edit' ? editor.level : game.level;
  const size = `${level.width},${level.depth}`;
  view?.setEditor(mode === 'edit');
  view?.setState(level, mode === 'edit' ? level.boxes : game.state.boxes, mode === 'edit' ? level.spawn : game.state.player, mode === 'edit' ? editorWater : game.water, { fit: options.fit || size !== renderedSize, animate: options.animate && !reduced.matches });
  renderedSize = size;
  view?.board.setHover(mode === 'edit' ? editor.selected : null);
  updateUI();
}
function finishStroke() { if (editor.commitStroke()) { persist(); updateUI(); } }
function enterEditor() { mode = 'edit'; sync({ fit: true, animate: false }); }
function playDraft() {
  finishStroke(); const errors = validatePlayable(editor.level);
  if (errors.length) { toast('还不能试玩：\n' + errors.join('\n')); return; }
  game = new GameController(editor.level); origin = 'editor'; mode = 'play'; sync({ fit: true, animate: false });
}
function history(redo = false) {
  const changed = mode === 'edit' ? redo ? editor.redo() : editor.undo() : redo ? game.redo() : game.undo();
  if (!changed) return;
  if (mode === 'edit') persist(); sync({ fit: false, animate: true });
}
function act(direction?: Direction) {
  if (mode !== 'play') return;
  const start = performance.now(), result = game.act(direction ? { type: 'move', direction } : { type: 'wait' }); solveMs = performance.now() - start;
  if (result.accepted) sync();
  if (result.message) toast(result.message);
}
function restart() { if (mode === 'play') { game.restart(); sync({ fit: false, animate: false }); } }
function debug() { view?.setDebug({ grid: input('show-grid').checked, depths: input('show-depths').checked, outlets: input('show-outlets').checked }); }
function setPause(paused: boolean) { if (view) view.paused = paused; button('motion-toggle').setAttribute('aria-pressed', String(paused)); button('motion-toggle').textContent = paused ? '播放动画' : '暂停动画'; }
function chooseTool(tool: EditorTool) {
  finishStroke(); editor.tool = tool;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.tool === tool)));
}
function paint(cell: Cell) { editor.selected = cell; view?.board.setHover(cell); if (editor.paint(cell)) sync({ fit: false, animate: false }); else inspect(); }

for (const [index, example] of examples.entries()) {
  const item = document.createElement('button'); item.className = 'example-card'; item.dataset.example = example.id;
  const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 1).padStart(2, '0');
  const copy = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small'); title.textContent = example.title; subtitle.textContent = example.subtitle.split('/')[1].trim(); copy.append(title, subtitle); item.append(number, copy);
  on(item, 'click', () => { game = new GameController(example.level); exampleId = example.id; origin = 'example'; mode = 'play'; sync({ fit: true, animate: false }); }); el('example-list').appendChild(item);
  const option = document.createElement('option'); option.value = example.id; option.textContent = example.title; el('editor-example').appendChild(option);
}
on(button('mode-edit'), 'click', enterEditor);
on(button('mode-play'), 'click', () => { if (mode === 'edit') playDraft(); });
on(button('play-draft'), 'click', playDraft);
on(button('return-editor'), 'click', enterEditor);
on(button('edit-current'), 'click', () => { editor.replace(game.level); persist(); enterEditor(); });
on(el('editor-example'), 'change', () => { const select = el<HTMLSelectElement>('editor-example'), example = examples.find(item => item.id === select.value); if (example) { editor.replace(example.level); persist(); sync({ fit: true, animate: false }); } select.value = ''; });
on(input('level-name'), 'change', () => { editor.rename(input('level-name').value); persist(); updateUI(); });
on(input('brush-height'), 'change', () => { const value = input('brush-height').valueAsNumber; editor.brushHeight = Number.isFinite(value) ? Math.max(0, Math.min(12, Math.round(value))) : 0; input('brush-height').value = String(editor.brushHeight); });
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(node => on(node, 'click', () => chooseTool(node.dataset.tool as EditorTool)));
on(button('apply-cell'), 'click', () => { const cell = { x: input('cell-x').valueAsNumber, z: input('cell-z').valueAsNumber }; if (!Number.isInteger(cell.x) || !Number.isInteger(cell.z) || cell.x < 0 || cell.z < 0 || cell.x >= editor.level.width || cell.z >= editor.level.depth) { toast('坐标需要位于地图范围内。'); return; } editor.beginStroke(); paint(cell); finishStroke(); });
on(button('undo'), 'click', () => history()); on(button('redo'), 'click', () => history(true));
on(button('restart'), 'click', restart); on(button('win-restart'), 'click', restart);
document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(node => on(node, 'click', () => act(node.dataset.move as Direction)));
on(button('wait-turn'), 'click', () => act());
on(button('reset-camera'), 'click', () => view?.resetView()); on(button('top-view'), 'click', () => view?.camera.setView(0, 70));
on(button('motion-toggle'), 'click', () => setPause(!view?.paused));
for (const id of ['show-grid', 'show-depths', 'show-outlets']) on(input(id), 'change', debug);
on(button('reload-game'), 'click', () => location.reload());
on(window, 'pagehide', finishStroke);
on(reduced, 'change', () => setPause(reduced.matches));
on(document, 'keydown', event => {
  const key = event as KeyboardEvent, target = key.target as HTMLElement;
  if (target.matches('input,select,textarea') || target.isContentEditable || el<HTMLDialogElement>('new-level-dialog').open) return;
  const k = key.key.toLowerCase();
  if (k === 'z' && (mode === 'play' || key.ctrlKey || key.metaKey)) { key.preventDefault(); history(key.shiftKey); }
  else if (k === 'y' && (mode === 'play' || key.ctrlKey || key.metaKey)) { key.preventDefault(); history(true); }
  else if (mode === 'play' && !key.ctrlKey && !key.metaKey && !key.altKey) {
    const directions: Record<string, Direction> = { w: 'north', arrowup: 'north', a: 'west', arrowleft: 'west', s: 'south', arrowdown: 'south', d: 'east', arrowright: 'east' };
    if (directions[k]) { key.preventDefault(); act(directions[k]); }
    else if (k === ' ' && !target.matches('button,a')) { key.preventDefault(); act(); }
    else if (k === 'r') { key.preventDefault(); restart(); }
  }
});
on(button('export-level'), 'click', () => {
  finishStroke(); const blob = new Blob([serializeLevel(editor.level)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${editor.level.name.replace(/[<>:"/\\|?*]/g, '_')}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); toast('关卡已导出，可随时重新导入。');
});
on(button('import-level'), 'click', () => input('import-file').click());
on(input('import-file'), 'change', async () => {
  const file = input('import-file').files?.[0]; if (!file) return;
  try { if (file.size > 1_000_000) throw new Error('文件不能超过 1 MB。'); const level = parseLevel(await file.text()); editor.replace(level); persist(); enterEditor(); toast('关卡已导入。'); }
  catch (error) { toast(`导入失败，原编辑稿保持不变。\n${error instanceof Error ? error.message : '文件无法读取。'}`); }
  finally { input('import-file').value = ''; }
});
const dialog = el<HTMLDialogElement>('new-level-dialog');
on(button('new-level'), 'click', () => dialog.showModal()); on(button('cancel-new'), 'click', () => dialog.close());
on(el('new-level-form'), 'submit', event => {
  event.preventDefault(); const width = input('new-width').valueAsNumber, depth = input('new-depth').valueAsNumber;
  if (![width, depth].every(n => Number.isInteger(n) && n >= 4 && n <= 32)) return;
  const level = createLevel(width, depth); level.name = input('new-name').value.trim() || '未命名的水庭院'; editor.replace(level); persist(); dialog.close(); enterEditor();
});

try {
  view = new BoardView(el('board-viewport'), fail); setPause(reduced.matches); debug(); sync({ fit: true, animate: false });
  const canvas = view.renderer.domElement;
  on(canvas, 'pointerdown', event => { const e = event as PointerEvent; if (mode !== 'edit' || e.button !== 0) return; const cell = view!.pick(e.clientX, e.clientY); if (!cell) return; canvas.setPointerCapture(e.pointerId); editor.beginStroke(); paint(cell); });
  on(canvas, 'pointermove', event => { if (mode !== 'edit') return; const e = event as PointerEvent, cell = view!.pick(e.clientX, e.clientY); if (!cell) { view!.board.setHover(null); return; } editor.selected = cell; view!.board.setHover(cell); if (editor.inStroke && (e.buttons & 1)) paint(cell); else inspect(cell); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) on(canvas, event, () => finishStroke());
  on(canvas, 'pointerleave', () => { if (!editor.inStroke) view?.board.setHover(null); });
  requestAnimationFrame(() => { if (el('scene-error').hidden) el('board-loading').hidden = true; });
} catch (error) { fail(`请使用支持 WebGL 2 的浏览器，并开启硬件加速。${error instanceof Error ? ' ' + error.message : ''}`); updateUI(); }
if (saved.error) { el('save-status').textContent = '草稿读取失败'; el('save-status').dataset.error = 'true'; toast(saved.error); }
else if (saved.level) el('save-status').textContent = '已恢复本地草稿';

if (new URLSearchParams(location.search).has('qa')) {
  const qa = {
    snapshot: () => ({ mode, origin, level: cloneLevel(mode === 'edit' ? editor.level : game.level), draft: cloneLevel(editor.level), state: structuredClone(game.state), water: structuredClone(mode === 'edit' ? editorWater : game.water), camera: view ? { azimuth: view.camera.controls.getAzimuthalAngle() * 180 / Math.PI, elevation: 90 - view.camera.controls.getPolarAngle() * 180 / Math.PI, zoom: view.camera.camera.zoom } : null, paused: view?.paused, stats: view?.stats(), solveMs }),
    projectCell: (cell: Cell) => view?.project(cell),
    setView: (azimuth: number, elevation: number) => view?.camera.setView(azimuth, elevation),
    loadDraft: (level: LevelDataV1) => { editor.replace(parseLevel(JSON.stringify(level))); enterEditor(); },
    benchmark: (runs = 100) => { const samples: number[] = []; for (let i = 0; i < runs; i++) { const start = performance.now(); solveWater(editor.level); samples.push(performance.now() - start); } return { runs, mean: samples.reduce((a, b) => a + b, 0) / runs, max: Math.max(...samples) }; },
    loseContext: () => view?.renderer.forceContextLoss(),
  };
  Object.assign(window, { __waterQA: qa });
}
if (import.meta.hot) import.meta.hot.dispose(() => { finishStroke(); listeners.abort(); clearTimeout(toastTimer); view?.dispose(); });
