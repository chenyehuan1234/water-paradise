import './player.css';
import { GameSession } from '../world/game';
import { defaults, type Command, type Direction } from '../world/types';
import { WorldView } from '../world-view/view';
import { displayName, levelMap, markCompleted, nextLevel } from './data';

const params = new URLSearchParams(location.search);
const levelId = params.get('id') ?? '';
const level = levelMap[levelId];

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="play-page">
  <div class="play-shell">
    <header class="play-topbar">
      <button id="back" title="返回关卡大厅 Esc">← 大厅</button>
      <div class="play-title">
        <strong id="title">${level ? '' : '关卡未找到'}</strong>
        <small id="subtitle"></small>
      </div>
      <span class="turn-chip" id="turn">第 0 回合</span>
      <button id="undo" title="撤销 Z">↶</button>
      <button id="redo" title="重做 Y">↷</button>
      <button id="restart" title="重开 R">⟳ 重开</button>
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
    </section>
    <footer class="play-hintbar">
      <span><b>WASD / 方向键</b> 移动</span>
      <span><b>Shift + 方向</b> 原地转向</span>
      <span><b>X</b> 远程拉取</span>
      <span><b>空格</b> 等待</span>
      <span><b>Z / Y</b> 撤销 / 重做</span>
      <span><b>R</b> 重开</span>
      <span><b>中键拖动 / 滚轮</b> 旋转 / 缩放视角</span>
    </footer>
  </div>
</div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

if (!level) {
  $('loading').hidden = true;
  const error = $('error');
  error.hidden = false;
  error.innerHTML = '没有找到这一关。<a href="./index.html">返回关卡大厅</a>。';
} else {
  $('title').textContent = displayName(level);
  $('subtitle').textContent = `${level.width} × ${level.depth} 格 · 引导水流抵达唯一出口`;

  const canvas = $<HTMLCanvasElement>('world');
  const game = new GameSession(level);
  const settings = defaults();
  let view: WorldView | null = null;

  const moveKeys: Record<string, Direction> = {
    w: 'north', arrowup: 'north',
    d: 'east', arrowright: 'east',
    s: 'south', arrowdown: 'south',
    a: 'west', arrowleft: 'west',
  };
  const held = new Set<string>();
  let heldLast: string | null = null;
  let queuedKey: string | null = null;
  let pending: Command | null = null;
  const activeHeld = () => (heldLast && held.has(heldLast) ? heldLast : [...held].at(-1) ?? null);
  function clearMovement() {
    held.clear(); heldLast = null; queuedKey = null; pending = null;
  }

  function refresh() {
    $('turn').textContent = `第 ${game.state.turn} 回合`;
    $<HTMLButtonElement>('undo').disabled = !game.canUndo;
    $<HTMLButtonElement>('redo').disabled = !game.canRedo;
    if (game.state.status === 'won' && view && !view.busy) {
      markCompleted(level.id);
      const nxt = nextLevel(level.id);
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

  function act(command: Command, heldKey?: string) {
    if (!view) return;
    if (view.busy) {
      if (heldKey) queuedKey = heldKey;
      else pending = command;
      return;
    }
    const result = game.act(command);
    if (!result.accepted) return;
    view.show(game.level, game.state.objects, result.water, settings, game.state, result.events);
    refresh();
  }

  function moveByKey(k: string, turn = false) {
    if (!view) return;
    const direction = view.movementDirection(moveKeys[k]);
    act({ type: turn ? 'turn' : 'move', direction }, turn ? undefined : k);
  }

  try {
    view = new WorldView(canvas, (message) => {
      const error = $('error');
      error.hidden = false;
      error.textContent = `无法显示三维画面：${message}`;
    });
    view.onIdle = () => {
      refresh();
      const nextCmd = pending;
      pending = null;
      if (nextCmd) {
        act(nextCmd);
        return;
      }
      const key = queuedKey ?? activeHeld();
      queuedKey = null;
      if (key && held.has(key)) moveByKey(key);
    };
    view.show(game.level, game.state.objects, game.water, settings, game.state);
    $('loading').hidden = true;
    canvas.focus();
    refresh();
  } catch (err) {
    $('loading').hidden = true;
    const error = $('error');
    error.hidden = false;
    error.textContent = `无法启动：${err instanceof Error ? err.message : String(err)}`;
  }

  $('back').onclick = () => location.href = './index.html';
  $('restart').onclick = () => {
    view?.finish(false);
    game.restart();
    view?.show(game.level, game.state.objects, game.water, settings, game.state);
    refresh();
    canvas.focus();
  };
  $('undo').onclick = () => {
    const r = game.undo();
    if (r && view) {
      view.show(game.level, game.state.objects, r.water, settings, game.state, r.events);
      refresh();
    }
  };
  $('redo').onclick = () => {
    const r = game.redo();
    if (r && view) {
      view.show(game.level, game.state.objects, r.water, settings, game.state, r.events);
      refresh();
    }
  };

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input,select,textarea,dialog,a')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { location.href = './index.html'; return; }
    if (moveKeys[k]) {
      e.preventDefault();
      if (e.repeat) return;
      if (e.shiftKey) {
        moveByKey(k, true);
        return;
      }
      held.add(k);
      heldLast = k;
      if (view?.busy) queuedKey = k;
      else moveByKey(k);
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
    if (!moveKeys[k]) return;
    held.delete(k);
    if (heldLast === k) heldLast = activeHeld();
    if (queuedKey === k) queuedKey = null;
  });
  window.addEventListener('blur', clearMovement);
}
