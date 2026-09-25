import './home.css';
import chapterProject from '../data/chapter-project.json';
import { validateV2 } from '../world/level';
import type { ProjectData } from '../world/types';
import { ProjectStore } from '../workshop/storage';
import { listedInGame } from '../workshop/project';

const app = document.querySelector<HTMLDivElement>('#app')!;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const playUrl = (id: string) => `./?mode=play&level=${encodeURIComponent(id)}`;
const ordered = (project: ProjectData) => project.chapters.flatMap(chapter => chapter.levels.filter(id=>listedInGame(project,id)).map(id => project.levels[id]).filter(Boolean));

app.innerHTML = `<main class="home"><header class="home-header"><div class="home-leading"><button id="level-toggle" aria-expanded="false" aria-controls="level-popover">☰ 选关</button><a class="home-brand" href="./" aria-label="水之天堂首页"><strong>水之天堂</strong></a></div></header><div id="level-popover" class="level-popover" hidden><div class="popover-heading"><strong>选择庭院</strong><span id="level-count"></span></div><div id="level-list"></div></div><section class="hero"><div class="hero-copy"><div class="overline"><span class="overline-line"></span> WATER PARADISE · 庭院谜题</div><h1>让水，<br><em>找到归途。</em></h1><p>移动石块与船，改变水流的方向。每座悬空庭院，都藏着一条通向唯一出口的路。</p><div class="hero-actions"><a class="primary" id="continue" href="./?mode=play">开始游戏 <span aria-hidden="true">↗</span></a></div><p class="hero-hint" id="current-level">正在读取庭院…</p></div></section><footer class="home-footer"><span>一个关于连通、蓄水与出口的小游戏</span><span>W A S D 移动 · 空格拉取 · Z 撤销</span></footer></main>`;

const toggle = document.querySelector<HTMLButtonElement>('#level-toggle')!;
const popover = document.querySelector<HTMLElement>('#level-popover')!;
const close = () => { popover.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
toggle.addEventListener('click', () => { popover.hidden = !popover.hidden; toggle.setAttribute('aria-expanded', String(!popover.hidden)); });
document.addEventListener('pointerdown', event => { if (!popover.hidden && !popover.contains(event.target as Node) && !toggle.contains(event.target as Node)) close(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

async function start() {
  let project = chapterProject as unknown as ProjectData;
  const store = new ProjectStore();
  let completed = new Set<string>();
  try { completed = await store.loadCompleted(); } catch { /* ignore */ }
  const levels = ordered(project);
  const playable = levels.filter(level => validateV2(level, true).length === 0);
  const current = playable[0];
  const primary = document.querySelector<HTMLAnchorElement>('#continue')!;
  if (current) primary.href = playUrl(current.id);
  document.querySelector<HTMLElement>('#current-level')!.textContent = current ? `共 ${playable.length} 座庭院 · 从「${current.name}」开始` : '没有可玩的庭院。';
  document.querySelector<HTMLElement>('#level-count')!.textContent = `${playable.length} 座庭院`;
  const chapters = project.chapters.map(chapter => ({chapter, ids: chapter.levels.filter(id => listedInGame(project, id) && validateV2(project.levels[id], true).length === 0)})).filter(item => item.ids.length);
  document.querySelector<HTMLElement>('#level-list')!.innerHTML = chapters.length ? chapters.map(({chapter, ids}, ci) => `<details class="chapter" ${ids.includes(current?.id ?? '') || !current && ci === 0 ? 'open' : ''}><summary>${escape(chapter.name)} <span>${ids.length}</span></summary><div class="chapter-levels">${ids.map((id, i) => { const level = project.levels[id]; return `<a href="${playUrl(id)}" class="level-link" ${id === current?.id ? 'aria-current="page"' : ''}><span>${String(i+1).padStart(2,'0')}</span><strong>${escape(level.name)}</strong><small>${completed.has(id)?'✓ 已通关':'开始'}</small></a>`; }).join('')}</div></details>`).join('') : '<p class="empty-levels">还没有正式关卡。</p>';
}
void start();
