import './player.css';
import { chapters, completedLevels, displayName, orderedLevels } from './data';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const done = completedLevels();
const total = orderedLevels.length;
const doneCount = orderedLevels.filter((l) => done.has(l.id)).length;
const percent = total ? Math.round((doneCount / total) * 100) : 0;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="hall-page">
  <nav class="hall-nav">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">≈</span>
      <div><h1>水之天堂</h1><small>WATER PARADISE</small></div>
    </div>
    <div class="nav-actions">
      <a class="btn" href="./workshop.html">庭院工坊 · 编辑器</a>
    </div>
  </nav>

  <header class="hero">
    <div class="kicker">WATER · GARDEN · PUZZLE</div>
    <h2>引一泓水，找到归途</h2>
    <p>堆叠方块搭起多层空中庭院，引导天空水源穿过石桥、铁架与浮船。推动木箱、隔水拉取、借落水的力量开路——当全图只剩一条出水边，并亲自抵达它，庭院便告完成。</p>
    <div class="progress-line">
      <span>通关进度 <b>${doneCount}</b> / ${total}</span>
      <span class="progress-bar"><i style="width:${percent}%"></i></span>
      <span>${percent}%</span>
    </div>
  </header>

  <main class="chapters-wrap">
    ${chapters
      .map((c, ci) => {
        const chapterDone = c.levels.filter((l) => done.has(l.id)).length;
        return `
        <section class="chapter-block">
          <div class="chapter-head">
            <h3>${escape(c.name)}</h3>
            <span class="chapter-meta">${chapterDone} / ${c.levels.length} 已完成</span>
          </div>
          <div class="level-grid">
            ${c.levels
              .map((l, i) => {
                const isDone = done.has(l.id);
                const desc =
                  l.description?.trim() || `${l.width} × ${l.depth} 格 · ${l.objects.length} 件庭院物件`;
                const seq =
                  ci === chapters.length - 1 && /^\d+$/.test(l.name.trim())
                    ? l.name.trim()
                    : String(i + 1).padStart(2, '0');
                return `
                <a class="level-card ${isDone ? 'is-done' : ''}" href="./play.html?id=${encodeURIComponent(l.id)}">
                  <div class="card-top">
                    <span class="seq">${escape(seq)}</span>
                    <h4>${escape(displayName(l))}</h4>
                  </div>
                  <p class="card-desc">${escape(desc)}</p>
                  <div class="card-foot">
                    <span>${l.width} × ${l.depth} 格</span>
                    <span class="done-badge">✓ 已通关</span>
                  </div>
                </a>`;
              })
              .join('')}
          </div>
        </section>`;
      })
      .join('')}
  </main>

  <footer class="hall-footer">
    水之天堂 · Three.js + TypeScript 打造，材质与模型均在本地生成，不依赖外部资源。<br>
    建议使用支持 WebGL 2 的桌面浏览器（Chrome / Edge），从本页面进入关卡。
  </footer>
</div>`;
