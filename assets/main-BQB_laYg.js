import"./modulepreload-polyfill-P2Xu9kJm.js";import{n as e,r as t,s as n,t as r}from"./data-CDYldwCq.js";var i=e=>e.replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),a=e(),o=n.length,s=n.filter(e=>a.has(e.id)).length,c=o?Math.round(s/o*100):0,l=document.querySelector(`#app`);l.innerHTML=`
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
      <span>通关进度 <b>${s}</b> / ${o}</span>
      <span class="progress-bar"><i style="width:${c}%"></i></span>
      <span>${c}%</span>
    </div>
  </header>

  <main class="chapters-wrap">
    ${r.map((e,n)=>{let o=e.levels.filter(e=>a.has(e.id)).length;return`
        <section class="chapter-block">
          <div class="chapter-head">
            <h3>${i(e.name)}</h3>
            <span class="chapter-meta">${o} / ${e.levels.length} 已完成</span>
          </div>
          <div class="level-grid">
            ${e.levels.map((e,o)=>{let s=a.has(e.id),c=e.description?.trim()||`${e.width} × ${e.depth} 格 · ${e.objects.length} 件庭院物件`,l=n===r.length-1&&/^\d+$/.test(e.name.trim())?e.name.trim():String(o+1).padStart(2,`0`);return`
                <a class="level-card ${s?`is-done`:``}" href="./play.html?id=${encodeURIComponent(e.id)}">
                  <div class="card-top">
                    <span class="seq">${i(l)}</span>
                    <h4>${i(t(e))}</h4>
                  </div>
                  <p class="card-desc">${i(c)}</p>
                  <div class="card-foot">
                    <span>${e.width} × ${e.depth} 格</span>
                    <span class="done-badge">✓ 已通关</span>
                  </div>
                </a>`}).join(``)}
          </div>
        </section>`}).join(``)}
  </main>

  <footer class="hall-footer">
    水之天堂 · Three.js + TypeScript 打造，材质与模型均在本地生成，不依赖外部资源。<br>
    建议使用支持 WebGL 2 的桌面浏览器（Chrome / Edge），从本页面进入关卡。
  </footer>
</div>`;