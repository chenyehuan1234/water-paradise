import type { GardenDisplay } from './scene/display';

export function bindInterface(display: GardenDisplay) {
  const listeners = new AbortController();
  const motion = document.querySelector<HTMLButtonElement>('#toggle-motion')!;
  const grid = document.querySelector<HTMLButtonElement>('#toggle-grid')!;
  const reset = document.querySelector<HTMLButtonElement>('#reset-view')!;
  const announcement = document.querySelector<HTMLElement>('#announcement')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const refresh = () => {
    const state = display.snapshot();
    motion.setAttribute('aria-pressed', String(state.paused));
    motion.querySelector('span')!.textContent = state.paused ? '播放动画' : '暂停动画';
    grid.setAttribute('aria-pressed', String(state.gridVisible));
    grid.querySelector('span')!.textContent = state.gridVisible ? '隐藏网格' : '显示网格';
  };
  const changeMotion = () => { display.setPaused(!display.snapshot().paused); refresh(); announcement.textContent = display.snapshot().paused ? '水面动画已暂停' : '水面动画已播放'; };
  const changeGrid = () => { display.setGridVisible(!display.snapshot().gridVisible); refresh(); };
  const resetView = () => { display.resetView(); announcement.textContent = '已恢复初始视角'; };
  display.setPaused(reducedMotion.matches); refresh();
  reducedMotion.addEventListener('change', event => { display.setPaused(event.matches); refresh(); }, { signal: listeners.signal });
  motion.addEventListener('click', changeMotion, { signal: listeners.signal });
  grid.addEventListener('click', changeGrid, { signal: listeners.signal });
  reset.addEventListener('click', resetView, { signal: listeners.signal });
  document.addEventListener('keydown', event => {
    if (event.target instanceof HTMLElement && (event.target.closest('button, input, textarea, select, [contenteditable]'))) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'r') resetView();
    else if (key === 'g') changeGrid();
    else if (key === ' ') { event.preventDefault(); if (!event.repeat) changeMotion(); }
    else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '-', '='].includes(key)) {
      event.preventDefault();
      const state = display.snapshot();
      if (key.startsWith('arrow')) display.view.setView(state.azimuth + (key === 'arrowleft' ? -8 : key === 'arrowright' ? 8 : 0), state.elevation + (key === 'arrowup' ? 5 : key === 'arrowdown' ? -5 : 0));
      else { display.view.camera.zoom = Math.max(display.view.controls.minZoom, Math.min(display.view.controls.maxZoom, state.zoom * (key === '-' ? .9 : 1.1))); display.view.camera.updateProjectionMatrix(); }
    }
  }, { signal: listeners.signal });
  return () => listeners.abort();
}
