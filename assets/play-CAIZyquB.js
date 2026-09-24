import"./modulepreload-polyfill-P2Xu9kJm.js";import{a as e,i as t,n,o as r,r as i,s as a,t as o}from"./data-CDYldwCq.js";import{i as s,t as c,v as l}from"./view-BTZVchdz.js";var u=document.querySelector(`#app`);u.innerHTML=`
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
</div>`;var d=e=>document.getElementById(e),f=e=>e.replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),p=new URLSearchParams(location.search).get(`id`)??a[0]?.id??``,m=d(`world`),h=l(),g=null,_=null,v=``,y=null,b=!1,x=null,S={w:`north`,arrowup:`north`,d:`east`,arrowright:`east`,s:`south`,arrowdown:`south`,a:`west`,arrowleft:`west`};function C(){if(g){if(d(`turn`).textContent=`第 ${g.state.turn} 回合`,d(`undo`).disabled=!g.canUndo,d(`redo`).disabled=!g.canRedo,g.state.status===`won`&&_&&!_.busy){e(v),D();let t=r(v),n=d(`next`);t?(n.href=`./play.html?id=${encodeURIComponent(t.id)}`,n.hidden=!1):n.hidden=!0,d(`win`).hidden=!1}else d(`win`).hidden=!0}}function w(e){if(!g||!_)return;if(_.busy){x=e;return}let t=g.act(e);t.accepted&&(_.show(g.level,g.state.objects,t.water,h,g.state,t.events),C())}function T(e,t=!1){if(!_)return;let n=_.movementDirection(e);w({type:t?`turn`:`move`,direction:n})}function E(e){let n=t[e];if(!n){d(`loading`).hidden=!0;let e=d(`error`);e.hidden=!1,e.innerHTML=`没有找到这一关。<a href="./index.html">返回关卡大厅</a>。`;return}v=e,d(`title`).textContent=i(n),d(`subtitle`).textContent=`${n.width} × ${n.depth} 格 · 引导水流抵达唯一出口`,g=new s(n),y=null,x=null,_&&(_.finish(!1),_.show(g.level,g.state.objects,g.water,h,g.state)),history.replaceState(null,``,`./play.html?id=${encodeURIComponent(e)}`),D(),C(),m.focus()}function D(){let e=n(),t=r(v);d(`drawer-body`).innerHTML=o.map(n=>`
    <div class="drawer-chapter">
      <h4>${f(n.name)}</h4>
      ${n.levels.map((r,a)=>{let o=e.has(r.id),s=r.id===v,c=t?.id===r.id,l=n.name.includes(`正式`)&&/^\d+$/.test(r.name.trim())?r.name.trim():String(a+1).padStart(2,`0`);return`
        <button class="drawer-level ${o?`is-done`:``}" data-level="${f(r.id)}" aria-current="${s}">
          <span class="dl-seq">${f(l)}</span>
          <span class="dl-name">${f(i(r))}</span>
          ${o?`<span class="dl-check">✓</span>`:``}
          ${c&&!s?`<span class="dl-next">下一关</span>`:``}
        </button>`}).join(``)}
    </div>`).join(``)}function O(){d(`drawer`).classList.add(`open`),d(`drawer-overlay`).classList.add(`open`)}function k(){d(`drawer`).classList.remove(`open`),d(`drawer-overlay`).classList.remove(`open`)}try{_=new c(m,e=>{let t=d(`error`);t.hidden=!1,t.textContent=`无法显示三维画面：${e}`}),_.controls.enablePan=!0,_.onIdle=()=>{C();let e=x;if(x=null,e){w(e);return}y&&!_?.busy&&T(y)},d(`loading`).hidden=!0}catch(e){d(`loading`).hidden=!0;let t=d(`error`);t.hidden=!1,t.textContent=`无法启动：${e instanceof Error?e.message:String(e)}`}E(p),d(`back`).onclick=()=>location.href=`./index.html`,d(`levels-btn`).onclick=O,d(`drawer-close`).onclick=k,d(`drawer-overlay`).onclick=k,d(`drawer-body`).addEventListener(`click`,e=>{let t=e.target.closest(`[data-level]`);if(!t)return;let n=t.dataset.level;k(),n!==v&&E(n)}),d(`restart`).onclick=()=>{g&&_&&(_.finish(!1),g.restart(),y=null,_.show(g.level,g.state.objects,g.water,h,g.state),C(),m.focus())},d(`undo`).onclick=()=>{if(!g||!_)return;let e=g.undo();e&&(_.show(g.level,g.state.objects,e.water,h,g.state,e.events),C())},d(`redo`).onclick=()=>{if(!g||!_)return;let e=g.redo();e&&(_.show(g.level,g.state.objects,e.water,h,g.state,e.events),C())},window.addEventListener(`keydown`,e=>{if(e.target.closest(`input,select,textarea,dialog,a`))return;let t=e.key.toLowerCase();if(t===`escape`){if(d(`drawer`).classList.contains(`open`)){k();return}location.href=`./index.html`;return}if(S[t]){if(e.preventDefault(),e.repeat)return;if(e.shiftKey){T(S[t],!0);return}y=S[t],_?.busy||T(y);return}t===`x`?(e.preventDefault(),w({type:`pull`})):t===` `?(e.preventDefault(),w({type:`wait`})):t===`z`?d(`undo`).click():t===`y`?d(`redo`).click():t===`r`&&d(`restart`).click()}),window.addEventListener(`keyup`,e=>{let t=e.key.toLowerCase();S[t]&&y===S[t]&&(y=null)}),window.addEventListener(`blur`,()=>{y=null,x=null}),document.querySelectorAll(`.dpad-btn[data-dir]`).forEach(e=>{let t=e.dataset.dir,n=n=>{n.preventDefault(),e.setPointerCapture(n.pointerId),e.classList.add(`pressed`),b?(T(t,!0),b=!1,d(`turn-mode`).classList.remove(`active`),d(`turn-mode`).textContent=`转向`):(y=t,_?.busy||T(t))},r=n=>{n.preventDefault(),e.classList.remove(`pressed`),!b&&y===t&&(y=null)};e.addEventListener(`pointerdown`,n),e.addEventListener(`pointerup`,r),e.addEventListener(`pointercancel`,r),e.addEventListener(`pointerleave`,r)}),d(`turn-mode`).addEventListener(`click`,()=>{b=!b;let e=d(`turn-mode`);e.classList.toggle(`active`,b),e.textContent=b?`转向中`:`转向`}),d(`btn-pull`).addEventListener(`click`,()=>w({type:`pull`})),d(`btn-wait`).addEventListener(`click`,()=>w({type:`wait`}));