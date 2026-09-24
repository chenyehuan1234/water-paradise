import './style.css';
import { GardenDisplay } from './scene/display';
import { gardenConfig } from './scene/config';
import { bindInterface } from './ui';

const loading = document.querySelector<HTMLElement>('#loading')!;
const error = document.querySelector<HTMLElement>('#error')!;
const controls = document.querySelector<HTMLElement>('.controls')!;
const showFailure = (message: string) => {
  loading.hidden = true; error.hidden = false; controls.hidden = true;
  document.querySelector<HTMLElement>('#error-message')!.textContent = message;
};
document.querySelector('#reload')!.addEventListener('click', () => location.reload());
let display: GardenDisplay | undefined;
let unbind: (() => void) | undefined;
try {
  display = new GardenDisplay(document.querySelector('#scene')!, gardenConfig, showFailure);
  unbind = bindInterface(display);
  requestAnimationFrame(() => { loading.hidden = true; });
  // Explicit QA opt-in. The normal experience exposes no debug UI or game API.
  if (new URLSearchParams(location.search).has('qa')) {
    Object.assign(window, { __gardenQA: {
      snapshot: () => display!.snapshot(),
      setView: (azimuth: number, elevation: number) => display!.view.setView(azimuth, elevation),
      loseContext: () => display!.renderer.forceContextLoss(),
    } });
  }
} catch (cause) {
  console.error('Garden initialization failed:', cause);
  showFailure('无法创建三维画面。请使用支持 WebGL 2 的 Chrome 或 Edge，并检查浏览器硬件加速设置。');
}

function dispose() { unbind?.(); display?.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);
