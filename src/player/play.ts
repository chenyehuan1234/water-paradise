import './player.css';
import { GameSession } from '../world/game';
import { defaults, type Command, type Direction } from '../world/types';
import { WorldView } from '../world-view/view';
import { chapters, completedLevels, displayName, levelMap, markCompleted, nextLevel, orderedLevels } from './data';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="play-page">
  <div class="play-shell">
    <header class="play-topbar">
      <button id="back" title="返回关卡大厅">←<span class="btn-label">大厅</span></button>
      <button id="levels-btn" title="选择关卡">☰<span class="btn-label">关卡</span></button>
      <div class="play-title">
        <strong id="title">加载中…</strong>
        <small id="subtitle"></small>
      </div>
      <span class="turn-chip" id="turn">第 0 回合</span>
      <button id="undo" title="撤销">↶</button>
      <button id="redo" title="重做">↷</button>
      <button id="restart" title="重开">⟳</button>
    </header>
    <section class="play-stage">
      <canvas id="world" tabindex="0" aria-label="游戏画面"></canvas>
      <div class="play-loading" id="loading">正在唤醒庭院…</div>
      <div class="play-error" id="error" hidden></div>
      <div class="play-win" id="win" hidden>
        <h3>水，找到了归途</h3>
        <p>唯一出口已抵达 · 庭院完成</p>
        <div class="win-actions">
          <a class="btn" href="./index.html">返回大厅</a>
          <a class="btn primary" id="next" hidden>下一关 →</a>
        </div>
      </div>
      <div class="touch-controls" id="touch-controls">
        <div class="dpad">
          <button class="dpad-btn up" data-dir="north" aria-label="向北">↑</button>
          <button class="dpad-btn left" data-dir="west" aria-label="向西">←</button>
          <button class="dpad-btn center" id="turn-mode" aria-label="转向模式">转向</button>
          <button class="dpad-btn right" data-dir="east" aria-label="向东">→</button>
          <button class="dpad-btn down" data-dir="south" aria-label="向南">↓</button>
        </div>
        <div class="action-cluster">
          <div class="action-row">
            <button class="action-btn" id="btn-pull" aria-label="远程拉取">拉取</button>
            <button class="action-btn" id="btn-wait" aria-label="等待">等待</button>
          </div>
        </div>
      </div>
    </section>
    <footer class="play-hintbar">
      <span><b>WASD / 方向键</b> 移动</span>
      <span><b>Shift + 方向</b> 原地转向</span>
      <span><b>X</b> 拉取</span>
      <span><b>空格</b> 等待</span>
      <span><b>Z / Y</b> 撤销 / 重做</span>
      <span><b>R</b> 重开</span>
      <span><b>单指拖动 / 双指</b> 旋转 / 缩放平移视角</span>
    </footer>
  </div>
  <div class="drawer-overlay" id="drawer-overlay"></div>
  <aside class="level-drawer" id="drawer" aria-label="关卡列表">
    <div class="drawer-head">
      <h3>选择关卡</h3>
      <button id="drawer-close">✕</button>
    </div>
    <div class="drawer-body" id="drawer-body"></div>
    <div class="drawer-foot">
      <a class="btn" href="./index.html">← 返回关卡大厅</a>
    </div>
  </aside>
</div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const params = new URLSearchParams(location.search);
const initialId = params.get('id') ?? orderedLevels[0]?.id ?? '';

const canvas = $<HTMLCanvasElement>('world');
const settings = defaults();
let game: GameSession | null = null;
let view: WorldView | null = null;
let currentId = '';
let heldDir: Direction | null = null;
let turnMode = false;
let pending: Command | null = null;

const keyToDir: Record<string, Direction> = {
  w: 'north', arrowup: 'north',
  d: 'east', arrowright: 'east',
  s: 'south', arrowdown: 'south',
  a: 'west', arrowleft: 'west',
};

function refresh() {
  if (!game) return;
  $('turn').textContent = `第 ${game.state.turn} 回合`;
  $<HTMLButtonElement>('undo').disabled = !game.canUndo;
  $<HTMLButtonElement>('redo').disabled = !game.canRedo;
  if (game.state.status === 'won' && view && !view.busy) {
    markCompleted(currentId);
    renderDrawer();
    const nxt = nextLevel(currentId);
    const nextLink = $<HTMLAnchorElement>('next');
    if (nxt) {
      nextLink.href = `./play.html?id=${encodeURIComponent(nxt.id)}`;
      nextLink.hidden = false;
    } else {
      nextLink.hidden = true;
    }
    $('win').hidden = false;
  } else {
    $('win').hidden = true;
  }
}

function act(command: Command) {
  if (!game || !view) return;
  if (view.busy) { pending = command; return; }
  const result = game.act(command);
  if (!result.accepted) return;
  view.show(game.level, game.state.objects, result.water, settings, game.state, result.events);
  refresh();
}

function doMove(direction: Direction, turn = false) {
  if (!view) return;
  const worldDir = view.movementDirection(direction);
  act({ type: turn ? 'turn' : 'move', direction: worldDir });
}

function loadLevel(id: string) {
  const level = levelMap[id];
  if (!level) {
    $('loading').hidden = true;
    const error = $('error');
    error.hidden = false;
    error.innerHTML = '没有找到这一关。<a href="./index.html">返回关卡大厅</a>。';
    return;
  }
  currentId = id;
  $('title').textContent = displayName(level);
  $('subtitle').textContent = `${level.width} × ${level.depth} 格 · 引导水流抵达唯一出口`;
  game = new GameSession(level);
  heldDir = null;
  pending = null;
  if (view) {
    view.finish(false);
    view.show(game.level, game.state.objects, game.water, settings, game.state);
  }
  history.replaceState(null, '', `./play.html?id=${encodeURIComponent(id)}`);
  renderDrawer();
  refresh();
  canvas.focus();
}

function renderDrawer() {
  const done = completedLevels();
  const nxt = nextLevel(currentId);
  $('drawer-body').innerHTML = chapters.map((c) => `
    <div class="drawer-chapter">
      <h4>${escape(c.name)}</h4>
      ${c.levels.map((l, i) => {
        const isDone = done.has(l.id);
        const isCurrent = l.id === currentId;
        const isNext = nxt?.id === l.id;
        const seq = c.name.includes('正式') && /^\d+$/.test(l.name.trim()) ? l.name.trim() : String(i + 1).padStart(2, '0');
        return `
        <button class="drawer-level ${isDone ? 'is-done' : ''}" data-level="${escape(l.id)}" aria-current="${isCurrent}">
          <span class="dl-seq">${escape(seq)}</span>
          <span class="dl-name">${escape(displayName(l))}</span>
          ${isDone ? '<span class="dl-check">✓</span>' : ''}
          ${isNext && !isCurrent ? '<span class="dl-next">下一关</span>' : ''}
        </button>`;
      }).join('')}
    </div>`).join('');
}

function openDrawer() { $('drawer').classList.add('open'); $('drawer-overlay').classList.add('open'); }
function closeDrawer() { $('drawer').classList.remove('open'); $('drawer-overlay').classList.remove('open'); }

// —— 初始化视图 ——
try {
  view = new WorldView(canvas, (message) => {
    const error = $('error');
    error.hidden = false;
    error.textContent = `无法显示三维画面：${message}`;
  });
  // 移动端：启用双指平移；单指拖动旋转视角
  view.controls.enablePan = true;
  view.onIdle = () => {
    refresh();
    const cmd = pending;
    pending = null;
    if (cmd) { act(cmd); return; }
    if (heldDir && !view?.busy) doMove(heldDir);
  };
  $('loading').hidden = true;
} catch (err) {
  $('loading').hidden = true;
  const error = $('error');
  error.hidden = false;
  error.textContent = `无法启动：${err instanceof Error ? err.message : String(err)}`;
}

loadLevel(initialId);

// —— 顶部按钮 ——
$('back').onclick = () => location.href = './index.html';
$('levels-btn').onclick = openDrawer;
$('drawer-close').onclick = closeDrawer;
$('drawer-overlay').onclick = closeDrawer;
$('drawer-body').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
  if (!btn) return;
  const id = btn.dataset.level!;
  closeDrawer();
  if (id !== currentId) loadLevel(id);
});

$('restart').onclick = () => {
  if (!game || !view) return;
  view.finish(false);
  game.restart();
  heldDir = null;
  view.show(game.level, game.state.objects, game.water, settings, game.state);
  refresh();
  canvas.focus();
};
$('undo').onclick = () => {
  if (!game || !view) return;
  const r = game.undo();
  if (r) { view.show(game.level, game.state.objects, r.water, settings, game.state, r.events); refresh(); }
};
$('redo').onclick = () => {
  if (!game || !view) return;
  const r = game.redo();
  if (r) { view.show(game.level, game.state.objects, r.water, settings, game.state, r.events); refresh(); }
};

// —— 键盘 ——
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input,select,textarea,dialog,a')) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if ($('drawer').classList.contains('open')) { closeDrawer(); return; }
    location.href = './index.html'; return;
  }
  if (keyToDir[k]) {
    e.preventDefault();
    if (e.repeat) return;
    if (e.shiftKey) { doMove(keyToDir[k], true); return; }
    heldDir = keyToDir[k];
    if (!view?.busy) doMove(heldDir);
    return;
  }
  if (k === 'x') { e.preventDefault(); act({ type: 'pull' }); }
  else if (k === ' ') { e.preventDefault(); act({ type: 'wait' }); }
  else if (k === 'z') $('undo').click();
  else if (k === 'y') $('redo').click();
  else if (k === 'r') $('restart').click();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (!keyToDir[k]) return;
  if (heldDir === keyToDir[k]) heldDir = null;
});
window.addEventListener('blur', () => { heldDir = null; pending = null; });

// —— 虚拟方向键 ——
document.querySelectorAll<HTMLButtonElement>('.dpad-btn[data-dir]').forEach((btn) => {
  const dir = btn.dataset.dir as Direction;
  const press = (e: PointerEvent) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    btn.classList.add('pressed');
    if (turnMode) {
      doMove(dir, true);
      turnMode = false;
      $('turn-mode').classList.remove('active');
      $('turn-mode').textContent = '转向';
    } else {
      heldDir = dir;
      if (!view?.busy) doMove(dir);
    }
  };
  const release = (e: PointerEvent) => {
    e.preventDefault();
    btn.classList.remove('pressed');
    if (!turnMode && heldDir === dir) heldDir = null;
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
});

// —— 转向模式 ——
$('turn-mode').addEventListener('click', () => {
  turnMode = !turnMode;
  const btn = $('turn-mode');
  btn.classList.toggle('active', turnMode);
  btn.textContent = turnMode ? '转向中' : '转向';
});

// —— 动作按钮 ——
$('btn-pull').addEventListener('click', () => act({ type: 'pull' }));
$('btn-wait').addEventListener('click', () => act({ type: 'wait' }));
