import './workshop.css';
import chapterProject from '../data/chapter-project.json';
import { catalog } from '../world/catalog';
import { facesVoid, GameSession, pullTarget, unsupported } from '../world/game';
import { newLevel, validateV2 } from '../world/level';
import { clone, defaults, DIRS } from '../world/types';
import type { Command, Direction, EditorSettings, GameState, LevelDataV2, ObjectKind, ProjectData, Vec3 } from '../world/types';
import { solveWater, waterAt } from '../world/water';
import { WorldView } from '../world-view/view';
import { fillThumbnails } from '../world-view/thumbnails';
import { placementNormal, resolvePlacement, StackingEditor } from './editor';
import type { Pick } from './editor';
import { addChapter, addLevel, duplicateLevel, importProject, listedInGame, listedLevelIds, moveLevel, recover, removeChapter, removeLevel } from './project';
import { ProjectStore } from './storage';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<main class="app">
  <header class="topbar"><button id="level-drawer-toggle" aria-controls="chapters" aria-expanded="false" hidden>☰ 选关</button><div class="brand"><div><h1>水之天堂</h1><small>庭院工坊 · 第三阶段</small></div></div><button id="mobile-rules" aria-label="查看游戏规则">规则</button>
  <nav class="toolbar" aria-label="编辑与试玩"><button id="home" class="quiet">← 首页</button><span id="save-state" class="save-state" role="status">正在读取</span><button id="undo" title="撤销 Ctrl / ⌘ + Z">↶ 撤销</button><button id="redo" title="重做 Ctrl / ⌘ + Shift + Z">↷ 重做</button><button id="save">保存</button><button id="import">导入</button><button id="export">导出本关</button><button id="export-project" class="hide-small">整套导出</button><button id="play" class="primary">▷ 试玩庭院</button></nav></header>
  <div class="workspace"><aside class="sidebar left" aria-label="章节关卡栏"><div class="side-heading"><div><span class="eyebrow">COLLECTION</span><h2>我的庭院</h2></div><div class="side-heading-actions"><button id="rules-open" aria-label="查看游戏规则">规则</button><button id="new-chapter" aria-label="新建章节">＋</button></div></div><div id="chapters" class="scroll chapter-list"></div>
  <div class="level-actions"><button id="rename-level">重命名</button><button id="duplicate-level">复制关卡</button><button id="level-up">↑ 向上</button><button id="level-down">↓ 向下</button><button id="delete-level" class="danger">删除关卡</button><button id="resize-level">地图尺寸</button><label class="move-row">移到章节<select id="move-chapter" aria-label="移到章节"></select></label></div><div class="side-footer"><span id="level-count"></span><button id="trash" class="quiet">回收站</button></div></aside><button id="level-drawer-backdrop" class="drawer-backdrop" aria-label="关闭选关" hidden></button>
  <section class="stage" aria-label="三维庭院工作区"><canvas id="world" tabindex="0" aria-label="三维编辑画布"></canvas><div class="scene-heading"><div class="scene-title"><span id="mode-label" class="eyebrow">BUILD YOUR WATER GARDEN</span><h2 id="level-title" class="copy-display"></h2><p id="description" class="copy-display"></p><label class="copy-editor"><span class="sr-only">关卡标题</span><input id="level-title-input" maxlength="120" aria-label="关卡标题"></label><label class="copy-editor"><span class="sr-only">关卡说明</span><textarea id="description-input" maxlength="3000" rows="3" aria-label="关卡说明"></textarea></label></div><nav class="camera-controls" aria-label="相机"><button id="camera-reset">重置视角</button><button data-view="top">顶视</button><button data-view="north">北面</button><button data-view="east">东面</button><button data-view="south">南面</button><button data-view="west">西面</button><button id="focus">聚焦</button></nav></div>
  <div class="canvas-tools"><button id="toggle-left" aria-label="收起或展开关卡栏">☰ 关卡</button><button id="toggle-right" aria-label="收起或展开物件库">▦ 物件</button><label class="motion-select">动作<select id="animation-mode" aria-label="动作动画"><option value="full">完整</option><option value="simple">简化</option><option value="system">跟随系统</option></select></label><button id="pause">暂停水面</button><button id="restart" hidden>重开</button><span class="tool-status" id="tool-status"></span></div><div class="stats-chip"><div id="water-stats"></div><div id="render-stats">准备画面</div></div><div id="cinematic-cue" class="cinematic-cue" role="status" aria-live="polite" hidden><span id="cue-kicker"></span><strong id="cue-title"></strong><button id="cue-select" hidden>打开选关</button></div><div class="error-banner" id="render-error" role="alert" hidden></div><div class="loading" id="loading">正在唤醒庭院…</div></section>
  <aside class="sidebar right" aria-label="物件库与属性"><div class="side-heading"><div><span class="eyebrow">BUILDING KIT</span><h2>物件与建造</h2></div><span id="direction-badge" class="muted">北 ↑</span></div><div class="scroll"><div class="tool-properties"><label class="field">放置层<input id="layer" type="number" min="0" max="31" value="0"></label><label class="field" id="balance-height-field" hidden>天平支柱高度<input id="balance-height" type="number" min="1" max="31" value="2"></label><label class="field">笔刷<select id="brush"><option value="1">1 × 1</option><option value="3">3 × 3</option><option value="5">5 × 5</option></select></label><label class="check"><input id="rectangle" type="checkbox">矩形铺设</label><div class="glass-directions" id="glass-directions" aria-label="玻璃吸附方向"><button data-glass="auto">自动吸边</button><button data-glass="north">北</button><button data-glass="east">东</button><button data-glass="south">南</button><button data-glass="west">西</button></div><button id="rotate" title="快捷键 R">旋转 90°</button></div>
  <div class="mechanism" id="mechanism"></div><div class="palette" id="palette"></div><div class="view-options"><label class="field">剖视：显示到层<input id="slice" type="number" min="0" max="32" value="32"></label><div class="checks"><label class="check"><input id="grid" type="checkbox" checked>网格</label><label class="check"><input id="depth" type="checkbox">水深</label><label class="check"><input id="outlets" type="checkbox" checked>出口边</label></div><small>剖视只隐藏上层物件，不改变水路与碰撞。</small></div><div class="inspector"><h3>位置检查</h3><p id="inspect">将鼠标移到庭院上，查看占位与水深。</p><p id="support-warning" class="muted"></p></div></div></aside></div>
  <div class="mobile-pad" aria-label="触屏游戏操作"><div class="mobile-dpad" aria-label="移动"><button data-move="w" class="pad-up" aria-label="向画面前方移动">↑</button><button data-move="a" class="pad-left" aria-label="向画面左侧移动">←</button><button data-move="s" class="pad-down" aria-label="向画面后方移动">↓</button><button data-move="d" class="pad-right" aria-label="向画面右侧移动">→</button></div><div class="mobile-actions"><button id="mobile-pull" aria-label="拉取已挂链箱子">拉取</button><button id="mobile-undo" aria-label="撤销一步">撤销</button><button id="mobile-restart" aria-label="重开当前关卡">重开</button></div></div>
  <footer class="bottom-bar"><span id="help">左键建造 · 右键拖删 · 中键点按取样 / 拖动旋转 · 滚轮缩放</span><a href="./">← 首页</a><a href="./showcase.html">参观美术样板 ↗</a><span>R 旋转物件 · [ ] 笔刷大小 · F 聚焦</span></footer>
  <input id="file" type="file" accept=".json,application/json" hidden><div id="notice" class="notice" role="status" aria-live="polite"></div>
  <dialog id="name-dialog"><form id="name-form"><h2 id="dialog-title"></h2><label>名称<input id="name-input" required maxlength="120" autocomplete="off"></label><div class="dialog-actions"><button type="button" id="dialog-cancel">取消</button><button class="primary" type="submit">确定</button></div></form></dialog>
  <dialog id="size-dialog"><form id="size-form"><h2>庭院尺寸</h2><p class="muted">范围 4–32 格；缩小前请移走范围外的物件。</p><label>宽度 X<input id="map-width" type="number" min="4" max="32" required></label><label>深度 Z<input id="map-depth" type="number" min="4" max="32" required></label><div class="dialog-actions"><button type="button" id="size-cancel">取消</button><button class="primary">应用</button></div></form></dialog>
  <dialog id="trash-dialog"><h2>可恢复的庭院</h2><div id="trash-list" class="trash-list"></div><div class="dialog-actions"><button id="trash-close">关闭</button></div></dialog>
  <dialog id="rules-dialog" aria-labelledby="rules-title"><h2 id="rules-title">游戏规则</h2><div class="rules-copy"><p>让全图只剩一条实际出水边，再让主角站到那条边所属的格子与水层。</p><ul><li><strong>移动：</strong>WASD／方向键随镜头方向行走；可攀上一格，不能走进无底虚空。</li><li><strong>推拉：</strong>面对同高且无遮挡的箱子，按朝它的方向挂上锁链，再按空格拉取。木块只能推；船在深水中也能推动。</li><li><strong>水：</strong>无限水源每次操作后立即达到稳定水位。薄水为平流层，深水可托起船；隔断水路会立即变干。</li><li><strong>天平：</strong>仅两端可站立和放重物；两端托盘能承接水。较重一侧每次最多下降一档，板底被顶住就不能下降。</li></ul><p class="rules-hint">鼠标左键或中键拖动旋转，右键拖动调整视觉中心；手机单指旋转、双指平移与缩放。Z 撤销，Y 重做，R 重开。</p></div><div class="dialog-actions"><button id="rules-close" class="primary">知道了</button></div></dialog>
</main>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
// 立即阻止移动端长按触发复制/选择菜单
document.addEventListener('contextmenu',e=>{if(app.classList.contains('playing'))e.preventDefault();});
document.addEventListener('selectstart',e=>{if(app.classList.contains('playing'))e.preventDefault();});
document.addEventListener('gesturestart',e=>e.preventDefault());
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const nameOf=(tool:EditorSettings['tool'])=>tool==='spawn'?'主角出生点':tool==='source'?'天空水源':catalog[tool].name;
const directionName:Record<Direction,string>={north:'北 ↑',east:'东 →',south:'南 ↓',west:'西 ←'};
let noticeTimer=0;
function notice(text:string){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>$('notice').textContent='',2200);}
let project:ProjectData=chapterProject as unknown as ProjectData,editor:StackingEditor,game:GameSession|null=null,view:WorldView|null=null,hover:Pick|null=null,indexPlay=false;
const store=new ProjectStore(),sessions=new Map<string,StackingEditor>();let saving=0,saveTimer=0,pending:Command|null=null,renderPending=false;
let completed=new Set<string>();
let winFlow:'idle'|'pending'|'flight'|'done'='idle',cueTimer=0;
function showCue(kicker:string,title:string,select=false){clearTimeout(cueTimer);$('cue-kicker').textContent=kicker;$('cue-title').textContent=title;$('cue-select').hidden=!select;$('cinematic-cue').hidden=false;}
function hideCue(){clearTimeout(cueTimer);$('cinematic-cue').hidden=true;}
function cancelWinFlow(){winFlow='idle';app.classList.remove('flying');hideCue();view?.cancelFlight();clearMovement();}
const moveKeys:Record<string,Direction>={w:'north',arrowup:'north',d:'east',arrowright:'east',s:'south',arrowdown:'south',a:'west',arrowleft:'west'};
const held=new Set<string>();let heldLast:string|null=null,queuedKey:string|null=null,blockedHeld:string|null=null;
function clearMovement(){held.clear();heldLast=null;queuedKey=null;pending=null;blockedHeld=null;}
function activeHeld(){return heldLast&&held.has(heldLast)?heldLast:[...held].at(-1)??null;}
let timings={solveMs:0,sceneMs:0};
let water=solveWater(project.levels[project.active]);
// ===== 进度缓存 =====
const PROGRESS_KEY='water-paradise-progress-v1';
interface ProgressData{lastLevel:string|null;states:Record<string,GameState>}
function loadProgress():ProgressData{try{const raw=localStorage.getItem(PROGRESS_KEY);if(!raw)return{lastLevel:null,states:{}};const d=JSON.parse(raw);return{lastLevel:d.lastLevel??null,states:d.states??{}};}catch{return{lastLevel:null,states:{}};}}
function writeProgress(d:ProgressData){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(d));}catch{}}
function saveLevelProgress(levelId:string,state:GameState){const d=loadProgress();d.lastLevel=levelId;d.states[levelId]=clone(state);writeProgress(d);}
function clearLevelProgress(levelId:string){const d=loadProgress();delete d.states[levelId];writeProgress(d);}
function restoreLevelProgress(session:GameSession):boolean{const d=loadProgress();const saved=d.states[session.level.id];if(!saved||saved.status==='won')return false;session.state=clone(saved);water=solveWater(session.level,session.state.objects);return true;}
const nextPlayable=()=>{const ids=indexPlay?listedLevelIds(project):project.chapters.flatMap(c=>c.levels),index=ids.indexOf(project.active);return ids.slice(index+1).find(id=>project.levels[id]&&validateV2(project.levels[id],true).length===0)??null;};
function capture(){if(!editor||!project.chapters.some(c=>c.levels.includes(editor.level.id)))return;project.levels[editor.level.id]=clone(editor.level);project.settings[editor.level.id]=clone(editor.settings);}
async function save():Promise<boolean>{capture();const token=++saving;$('save-state').textContent='保存中…';try{await store.save(project);if(token===saving)$('save-state').textContent='已自动保存';return true;}catch(error){$('save-state').textContent='仅保存在本页';notice(`保存失败：${error instanceof Error?error.message:'浏览器存储不可用'}。内容仍在，可立即导出。`);return false;}}
function scheduleSave(){capture();$('save-state').textContent='待保存';clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>void save(),350);}
function draw(editorTransition=false){renderPending=false;if(!editor)return;const start=performance.now(),l=game?.level??editor.level,objects=game?.state.objects??editor.level.objects;water=game?.water??solveWater(l,objects);const solved=performance.now();view?.show(l,objects,water,editor.settings,game?.state,[],editorTransition);timings={solveMs:solved-start,sceneMs:performance.now()-solved};refreshStatus();}
function requestDraw(){if(!renderPending){renderPending=true;requestAnimationFrame(()=>draw());}}
function changed(){scheduleSave();requestDraw();}
function selectLevel(id:string){if(!project.levels[id])return;cancelWinFlow();finishStroke();capture();game=null;view?.finish(false);project.active=id;const d=loadProgress();d.lastLevel=id;writeProgress(d);editor=sessions.get(id)??new StackingEditor(project.levels[id],project.settings[id]??defaults());sessions.set(id,editor);renderNavigation();syncControls();draw();scheduleSave();}
function refreshStatus(){
  const l=game?.level??editor.level;$('level-title').textContent=l.name;$('description').textContent=l.description??'';$('description').hidden=!(l.description?.trim());$('mode-label').textContent=game?'PLAY · 寻找唯一出水点':'BUILD · 堆叠你的水庭院';
  if(document.activeElement!==$('level-title-input'))$<HTMLInputElement>('level-title-input').value=l.name;
  if(document.activeElement!==$('description-input'))$<HTMLTextAreaElement>('description-input').value=l.description??'';
  $('water-stats').textContent=`${game?`第 ${game.state.turn} 回合 · `:''}${water.outlets.length} 条出水边${water.outlets.some(e=>e.canFinish===false)?' · 灰色出口不可通关':''} · ${l.width} × ${l.depth}`;
  $('tool-status').textContent=game?`视角方向：W ${directionName[view?.movementDirection('north')??'north']} · A ${directionName[view?.movementDirection('west')??'west']} · S ${directionName[view?.movementDirection('south')??'south']} · D ${directionName[view?.movementDirection('east')??'east']} · ${game.state.pullTarget?'已挂链 · 空格拉取':'面对箱子挂链'}`:`${nameOf(editor.settings.tool)} · ${effectiveRectangle()?'矩形':`${editor.settings.brush} × ${editor.settings.brush}`} · 放置层 Y=${editor.settings.layer}`;
  $('support-warning').textContent=game?'':unsupported(l).length?'有无支撑的可移动物件；进入试玩时统一落稳。':'';
  $<HTMLButtonElement>('undo').disabled=game?!game.canUndo:!editor.canUndo;$<HTMLButtonElement>('redo').disabled=game?!game.canRedo:!editor.canRedo;
}
function syncControls(){
  app.classList.toggle('playing',!!game);app.classList.toggle('index-play',!!game&&indexPlay);$('play').textContent=game?indexPlay?'← 首页':'退出试玩 · Esc':'▷ 试玩庭院 · S';$('restart').hidden=!game;$('toggle-right').hidden=!!game;$('level-drawer-toggle').hidden=!game;$('pause').textContent=view?.paused?'播放水面':'暂停水面';
  $('help').textContent=game?'WASD / 方向键移动 · 朝箱子挂链后空格拉取 · Z 撤销 · Y 重做 · R 重开':'左键建造 · 右键拖删 · 中键点按取样 / 拖动旋转 · 滚轮缩放';
  for(const key of ['layer','brush','slice'] as const)$<HTMLInputElement>(key).value=String(editor.settings[key]);$<HTMLInputElement>('balance-height').value=String(editor.settings.balanceHeight??2);$('balance-height-field').hidden=editor.settings.tool!=='balance';$<HTMLInputElement>('brush').disabled=editor.settings.tool==='balance';$<HTMLInputElement>('rectangle').disabled=editor.settings.tool==='balance';for(const key of ['rectangle','grid','depth','outlets'] as const)$<HTMLInputElement>(key).checked=editor.settings[key];
  $<HTMLSelectElement>('animation-mode').value=editor.settings.animation??'full';
  $('glass-directions').hidden=!['glass','open-glass','stone-fence'].includes(editor.settings.tool);
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-glass]'))b.setAttribute('aria-pressed',String((editor.settings.glassMode??'auto')==='auto'?b.dataset.glass==='auto':b.dataset.glass===editor.settings.direction));
  $('direction-badge').textContent=(editor.settings.glassMode==='auto'&&['glass','open-glass','stone-fence'].includes(editor.settings.tool)?'自动吸边 · ':'')+directionName[editor.settings.direction];$('mechanism').textContent=editor.settings.tool==='source'?'唯一的无限水源，从天空落向这一列最上方的承接面。':editor.settings.tool==='spawn'?'设置主角的初始位置。编辑时保持原位，试玩时检查落脚点。':catalog[editor.settings.tool].description;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===editor.settings.tool));
  for(const id of ['rename-level','duplicate-level','level-up','level-down','delete-level','resize-level','move-chapter','new-chapter'])$(id).toggleAttribute('disabled',!!game);
}
function renderNavigation(){
  const playerListing=indexPlay||!!game&&matchMedia('(max-width:700px), (max-width:900px) and (max-height:500px)').matches;
  const chapters=playerListing?project.chapters.filter(c=>c.levels.some(id=>listedInGame(project,id)&&validateV2(project.levels[id],true).length===0)):project.chapters;
  $('chapters').innerHTML=chapters.map(c=>{const ids=playerListing?c.levels.filter(id=>listedInGame(project,id)&&validateV2(project.levels[id],true).length===0):c.levels;return `<section class="chapter"><div class="chapter-title"><button class="chapter-toggle" data-chapter="${escape(c.id)}" aria-expanded="${!c.collapsed}">${c.collapsed?'▸':'▾'} ${escape(c.name)} <small>${ids.length}</small></button><select class="chapter-menu" aria-label="${escape(c.name)}章节操作" data-chapter-menu="${escape(c.id)}"><option value="">⋯</option><option value="rename">重命名</option><option value="copy">复制章节</option><option value="up">上移</option><option value="down">下移</option><option value="delete">删除章节</option></select></div>${c.collapsed?'':`<div class="level-list">${ids.map((id,i)=>`<button class="level" data-level="${escape(id)}" aria-current="${id===project.active}"><span class="number">${String(i+1).padStart(2,'0')}</span><span>${escape(project.levels[id].name)}</span>${completed.has(id)?'<span class="level-done" aria-label="已通关">✓</span>':''}</button>`).join('')}<button class="new-level" data-new-level="${escape(c.id)}">＋ 新建关卡</button></div>`}</section>`;}).join('');
  if(!chapters.length)$('chapters').innerHTML=playerListing?'<p class="empty">还没有正式关卡。请从首页进入编辑器，新建可试玩关卡。</p>':'<p class="empty">还没有章节。点击上方 ＋，开始搭建第一座庭院。</p>';
  $('level-count').textContent=`${Object.keys(project.levels).length} 座庭院`;$('move-chapter').innerHTML=project.chapters.map(c=>`<option value="${escape(c.id)}" ${c.levels.includes(project.active)?'selected':''}>${escape(c.name)}</option>`).join('');
}
function renderPalette(){const entries:[EditorSettings['tool'],string,string,string,string][]=[...Object.entries(catalog).filter(([,v])=>v.group!=='内部').map(([k,v])=>[k,v.name,v.group,v.icon,v.color] as [ObjectKind,string,string,string,string]),['source','天空水源','角色与水源','≋','#65a9ba'],['spawn','主角出生点','角色与水源','♟','#8c75b3']];$('palette').innerHTML=[...new Set(entries.map(e=>e[2]))].map(group=>`<section class="palette-section"><h3>${group}</h3><div class="palette-grid">${entries.filter(e=>e[2]===group).map(([kind,name,,icon,color])=>`<button class="asset" data-tool="${kind}" aria-pressed="false" title="${name}"><span class="thumbnail" aria-hidden="true" style="--asset-color:${color}">${icon}</span><span>${name}</span></button>`).join('')}</div></section>`).join('');}
let onName:((name:string)=>void)|null=null;
function askName(title:string,value:string,callback:(name:string)=>void){$('dialog-title').textContent=title;$<HTMLInputElement>('name-input').value=value;onName=callback;$<HTMLDialogElement>('name-dialog').showModal();$<HTMLInputElement>('name-input').select();}
$('name-form').addEventListener('submit',e=>{e.preventDefault();const name=$<HTMLInputElement>('name-input').value.trim();if(!name)return;$<HTMLDialogElement>('name-dialog').close();onName?.(name);onName=null;});$('dialog-cancel').onclick=()=>$<HTMLDialogElement>('name-dialog').close();
$('new-chapter').onclick=()=>askName('新建章节','新的章节',name=>{addChapter(project,name);renderNavigation();scheduleSave();});
$('chapters').addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;
  if(target.dataset.chapter){const c=project.chapters.find(c=>c.id===target.dataset.chapter)!;c.collapsed=!c.collapsed;renderNavigation();scheduleSave();}
  if(target.dataset.level){setLevelDrawer(false);const wasPlaying=!!game,restore=leftBeforePlay;selectLevel(target.dataset.level);if(wasPlaying){togglePlay();leftBeforePlay=restore;}}
  if(target.dataset.newLevel&&!game)askName('新建关卡','未命名庭院',name=>{capture();const c=project.chapters.find(c=>c.id===target.dataset.newLevel)!;const l=addLevel(project,c,newLevel(name));selectLevel(l.id);});
});
$('chapters').addEventListener('change',e=>{const select=e.target as HTMLSelectElement,id=select.dataset.chapterMenu;if(!id||game)return;const c=project.chapters.find(c=>c.id===id)!;const action=select.value;select.value='';
  if(action==='rename')askName('重命名章节',c.name,name=>{c.name=name;renderNavigation();scheduleSave();});
  if(action==='copy'){capture();const dest=addChapter(project,`${c.name} · 副本`);for(const id of c.levels){const copy=clone(project.levels[id]);copy.id=crypto.randomUUID();addLevel(project,dest,copy);}if(dest.levels.length)selectLevel(dest.levels[0]);else{renderNavigation();scheduleSave();}}
  if(action==='up'||action==='down'){const i=project.chapters.indexOf(c),j=Math.max(0,Math.min(project.chapters.length-1,i+(action==='up'?-1:1)));project.chapters.splice(i,1);project.chapters.splice(j,0,c);renderNavigation();scheduleSave();}
  if(action==='delete'){capture();removeChapter(project,id);afterDeletion();notice('章节已移到回收站，可以恢复。');}
});
function afterDeletion(){if(!project.active){const c=project.chapters[0]??addChapter(project,'我的庭院');addLevel(project,c);}selectLevel(project.active);}
$('rename-level').onclick=()=>askName('重命名关卡',editor.level.name,name=>{editor.edit(l=>l.name=name);changed();capture();renderNavigation();});
$('level-title-input').addEventListener('change',()=>{if(game)return;const input=$<HTMLInputElement>('level-title-input'),name=input.value.trim();if(!name){input.value=editor.level.name;notice('关卡标题不能为空。');return;}if(name!==editor.level.name){editor.edit(l=>l.name=name);changed();renderNavigation();}});
$('description-input').addEventListener('change',()=>{if(game)return;const description=$<HTMLTextAreaElement>('description-input').value;if(description!==(editor.level.description??'')){editor.edit(l=>l.description=description);changed();}});
$('duplicate-level').onclick=()=>{capture();selectLevel(duplicateLevel(project,project.active).id);};
$('delete-level').onclick=()=>{capture();removeLevel(project,project.active);afterDeletion();notice('关卡已移到回收站，可以恢复。');};
for(const [id,delta]of [['level-up',-1],['level-down',1]] as const)$(id).onclick=()=>{const c=project.chapters.find(c=>c.levels.includes(project.active))!;moveLevel(project,project.active,c.id,c.levels.indexOf(project.active)+delta);renderNavigation();scheduleSave();};
$('move-chapter').onchange=()=>{const id=$<HTMLSelectElement>('move-chapter').value;moveLevel(project,project.active,id,project.chapters.find(c=>c.id===id)!.levels.length);renderNavigation();scheduleSave();};
$('resize-level').onclick=()=>{$<HTMLInputElement>('map-width').value=String(editor.level.width);$<HTMLInputElement>('map-depth').value=String(editor.level.depth);$<HTMLDialogElement>('size-dialog').showModal();};
$('size-cancel').onclick=()=>$<HTMLDialogElement>('size-dialog').close();$('size-form').onsubmit=e=>{e.preventDefault();const width=Number($<HTMLInputElement>('map-width').value),depth=Number($<HTMLInputElement>('map-depth').value),candidate={...editor.level,width,depth};const errors=validateV2(candidate);if(errors.length){notice(errors.join('；'));return;}editor.edit(l=>{l.width=width;l.depth=depth;});$<HTMLDialogElement>('size-dialog').close();changed();};
function showTrash(){$('trash-list').innerHTML=project.trash.length?project.trash.map(t=>`<div class="trash-item"><span>${escape(t.name)} <small>${t.levels.length} 关</small></span><button data-recover="${escape(t.id)}">恢复</button></div>`).join(''):'<p class="empty">回收站是空的。删除的关卡与章节会保留在这里。</p>';}
$('trash').onclick=()=>{showTrash();$<HTMLDialogElement>('trash-dialog').showModal();};$('trash-close').onclick=()=>$<HTMLDialogElement>('trash-dialog').close();$('trash-list').onclick=e=>{const id=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-recover]')?.dataset.recover;if(id){recover(project,id);selectLevel(project.active);showTrash();notice('已恢复。');}};
$('palette').onclick=e=>{const tool=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]')?.dataset.tool as EditorSettings['tool']|undefined;if(tool){editor.settings.tool=tool;syncControls();scheduleSave();refreshStatus();}};
for(const id of ['layer','slice','brush'] as const)$(id).addEventListener('change',()=>{const n=Number($<HTMLInputElement>(id).value);if(!Number.isInteger(n)||n<0||n>(id==='layer'?31:32)){syncControls();return;}if(id==='brush'&&![1,3,5].includes(n))return;editor.settings[id]=n as 1|3|5;changed();syncControls();});
$('balance-height').addEventListener('change',()=>{const n=Number($<HTMLInputElement>('balance-height').value);if(!Number.isInteger(n)||n<1||n>31){syncControls();return;}editor.settings.balanceHeight=n;changed();syncControls();});
for(const id of ['rectangle','grid','depth','outlets'] as const)$(id).onchange=()=>{editor.settings[id]=$<HTMLInputElement>(id).checked;changed();};
function rotate(){editor.settings.direction=DIRS[(DIRS.findIndex(d=>d.name===editor.settings.direction)+1)%4].name;if(['glass','open-glass','stone-fence'].includes(editor.settings.tool))editor.settings.glassMode='manual';syncControls();scheduleSave();}
$('glass-directions').onclick=e=>{const chosen=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-glass]')?.dataset.glass;if(!chosen)return;if(chosen==='auto')editor.settings.glassMode='auto';else{editor.settings.glassMode='manual';editor.settings.direction=chosen as Direction;}syncControls();scheduleSave();};
$('animation-mode').onchange=()=>{editor.settings.animation=$<HTMLSelectElement>('animation-mode').value as EditorSettings['animation'];view?.setAnimation(editor.settings.animation??'full');scheduleSave();};
$('rotate').onclick=rotate;$('save').onclick=()=>void save();
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[<>:"/\\|?*]/g,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download(editor.level,editor.level.name);$('export-project').onclick=()=>{capture();download(project,'水之天堂-章节工程');};$('import').onclick=()=>$<HTMLInputElement>('file').click();
$('file').onchange=async()=>{const input=$<HTMLInputElement>('file'),file=input.files?.[0];if(!file)return;try{if(file.size>20_000_000)throw new Error('文件超过 20 MB');capture();const next=importProject(project,await file.text());project=next;selectLevel(project.active);notice('导入成功，已作为新副本加入。');}catch(error){notice(`导入失败，当前草稿未改变：${(error as Error).message}`);}finally{input.value='';}};
$('toggle-left').onclick=()=>{app.classList.toggle('left-closed');};$('toggle-right').onclick=()=>{app.classList.toggle('right-closed');};
function setLevelDrawer(open:boolean){if(open)clearMovement();app.classList.toggle('level-drawer-open',open);$('level-drawer-backdrop').hidden=!open;$('level-drawer-toggle').setAttribute('aria-expanded',String(open));}
$('level-drawer-toggle').onclick=()=>setLevelDrawer(!app.classList.contains('level-drawer-open'));
$('level-drawer-backdrop').onclick=()=>setLevelDrawer(false);
const openRules=()=>{clearMovement();setLevelDrawer(false);$<HTMLDialogElement>('rules-dialog').showModal();};
$('rules-open').onclick=openRules;$('mobile-rules').onclick=openRules;
$('rules-close').onclick=()=>$<HTMLDialogElement>('rules-dialog').close();
$('rules-dialog').addEventListener('close',()=>clearMovement());
async function navigateHome(){cancelWinFlow();clearTimeout(saveTimer);if(await save())location.href='./';}
$('home').onclick=()=>void navigateHome();
document.querySelector<HTMLAnchorElement>('.bottom-bar a[href="./"]')?.addEventListener('click',event=>{event.preventDefault();void navigateHome();});
$('camera-reset').onclick=()=>view?.reset();for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.onclick=()=>view?.setView(b.dataset.view as 'top'|Direction);
$('focus').onclick=()=>view?.focus(hover?.position??game?.state.player??editor.level.spawn??{x:editor.level.width/2,y:editor.settings.layer,z:editor.level.depth/2});
$('pause').onclick=()=>{if(view)view.paused=!view.paused;syncControls();};
function beginCompletion(){
  if(winFlow!=='pending'||!game)return;clearMovement();const current=game,exit=water.outlets[0]??null;
  if(!indexPlay){winFlow='done';showCue('试玩完成',current.level.name);return;}
  const id=nextPlayable();if(!id){winFlow='flight';app.classList.add('flying');showCue('唯一水路已经抵达尽头','章节完成');view?.startFlight(null,exit,()=>{if(winFlow!=='flight')return;winFlow='done';app.classList.remove('flying');showCue('全部庭院已完成','章节完成',true);});return;}
  try{
    const next=new GameSession(project.levels[id]),nextEditor=sessions.get(id)??new StackingEditor(project.levels[id],project.settings[id]??defaults());
    winFlow='flight';app.classList.add('flying');showCue('水流正通向下一座庭院','飞越中 · Enter 可快进');
    const arrive=()=>{if(winFlow!=='flight')return;capture();project.active=id;editor=nextEditor;sessions.set(id,editor);game=next;water=next.water;winFlow='idle';app.classList.remove('flying');clearMovement();
      view?.show(next.level,next.state.objects,next.water,editor.settings,next.state,[],false,true);history.replaceState(null,'',`./?mode=play&level=${encodeURIComponent(id)}`);renderNavigation();syncControls();refreshStatus();scheduleSave();
      const chapter=project.chapters.find(c=>c.levels.includes(id));showCue(chapter?.name??'新的庭院',next.level.name);cueTimer=window.setTimeout(hideCue,1800);
    };
    if(view)view.startFlight({level:next.level,state:next.state,water:next.water,settings:nextEditor.settings},exit,arrive);else arrive();
  }catch(error){winFlow='done';app.classList.remove('flying');showCue('下一关暂时无法打开',current.level.name,true);notice(`切换下一关失败：${(error as Error).message}`);}
}
function skipCompletion(){if(winFlow==='pending'){view?.finish(false);beginCompletion();}if(winFlow==='flight')view?.skipFlight();else if(winFlow==='done'&&indexPlay)setLevelDrawer(true);}
function markWon(){if(!game||game.state.status!=='won')return;clearMovement();winFlow='pending';if(indexPlay){clearLevelProgress(game.level.id);if(listedInGame(project,game.level.id)&&!completed.has(game.level.id)){completed.add(game.level.id);renderNavigation();void store.markCompleted(game.level.id).catch(()=>notice('通关已完成，但本地进度暂时无法保存。'));}}if(!view?.busy)beginCompletion();}
function act(command:Command,heldKey?:string):boolean{if(!game||winFlow!=='idle')return false;if(view?.busy){if(heldKey)queuedKey=heldKey;else pending=command;return false;}const result=game.act(command);if(!result.accepted){if(heldKey)blockedHeld=heldKey;else notice(result.message);return false;}blockedHeld=null;water=result.water;view?.show(game.level,game.state.objects,water,editor.settings,game.state,result.events);refreshStatus();if(result.state.status==='won')markWon();else if(indexPlay)saveLevelProgress(game.level.id,game.state);return true;}
function moveByKey(k:string){if(!view||!game||winFlow!=='idle')return;if(view.busy){queuedKey=k;return;}const direction=view.movementDirection(moveKeys[k]);
  if(game.state.pullTarget&&direction!==game.state.facing){if(!act({type:'move',direction},k)){act({type:'turn',direction});blockedHeld=k;}return;}
  if(!game.state.pullTarget&&pullTarget(game.level,game.state,direction)){act({type:'turn',direction});blockedHeld=k;return;}
  if(facesVoid(game.level,game.state,direction)){act({type:'turn',direction});blockedHeld=k;return;}
  act({type:'move',direction},k);
}
function startHeld(k:string){if(!game||winFlow!=='idle'||held.has(k))return;held.add(k);heldLast=k;if(view?.busy)queuedKey=k;else moveByKey(k);}
function stopHeld(k:string){held.delete(k);if(heldLast===k)heldLast=activeHeld();if(queuedKey===k)queuedKey=null;if(blockedHeld===k)blockedHeld=null;}
let leftBeforePlay=false;
function togglePlay(){finishStroke();cancelWinFlow();setLevelDrawer(false);view?.finish(false);if(game){game=null;app.classList.toggle('left-closed',leftBeforePlay);history.replaceState(null,'',`./?level=${encodeURIComponent(project.active)}`);notice('已返回编辑，试玩中的位置没有覆盖草稿。');}else{try{game=new GameSession(editor.level);const restored=indexPlay&&restoreLevelProgress(game);if(restored)notice('已恢复上次进度');}catch(error){notice(`暂不能试玩：${(error as Error).message}`);return;}leftBeforePlay=app.classList.contains('left-closed');app.classList.add('left-closed');history.replaceState(null,'',`./?mode=play&level=${encodeURIComponent(project.active)}`);}syncControls();renderNavigation();draw();$('world').focus();}
function leaveIndexPlay(){void navigateHome();}
$('play').onclick=()=>indexPlay&&game?leaveIndexPlay():togglePlay();const restartGame=()=>{cancelWinFlow();view?.finish(false);game?.restart();if(indexPlay&&game)clearLevelProgress(game.level.id);draw();};$('restart').onclick=restartGame;$('mobile-restart').onclick=restartGame;
$('cue-select').onclick=()=>setLevelDrawer(true);
function undo(){cancelWinFlow();finishStroke();if(game){const result=game.undo();if(result){water=result.water;view?.show(game.level,game.state.objects,water,editor.settings,game.state,result.events);refreshStatus();if(indexPlay&&game.state.status!=='won')saveLevelProgress(game.level.id,game.state);}}else if(editor.undo()){scheduleSave();capture();renderNavigation();draw(true);}}
function redo(){cancelWinFlow();if(game){const result=game.redo();if(result){water=result.water;view?.show(game.level,game.state.objects,water,editor.settings,game.state,result.events);refreshStatus();if(result.state.status==='won')markWon();else if(indexPlay)saveLevelProgress(game.level.id,game.state);}}else if(editor.redo()){scheduleSave();capture();renderNavigation();draw(true);}}
$('undo').onclick=undo;$('redo').onclick=redo;
let strokeButton=-1,rectangleEnd:Vec3|null=null;
function effectiveRectangle(){return editor.settings.rectangle&&!['balance','source','spawn'].includes(editor.settings.tool);}
function inspect(p:Pick|null){hover=p;if(!p){$('inspect').textContent='指向庭院，查看坐标和水深。';return;}const sample={...p.position,y:p.position.y+(p.normal.y>0&&p.id?1:0)},c=waterAt(water,sample),edges=water.outlets.filter(e=>e.x===p.position.x&&e.z===p.position.z&&e.y===(c?.y??p.position.y));$('inspect').textContent=`X ${p.position.x} · Y ${p.position.y} · Z ${p.position.z}\n${p.kind?nameOf(p.kind):'空位'} · ${c?.kind==='deep'?`深水 ${c.depth} 格`:c?.kind==='sheet'?'平流层（薄水）':'干燥'}\n${edges.length?`出水边：${edges.map(e=>`${directionName[e.direction]}${e.canFinish===false?'（开口栏，不可通关）':''}`).join('、')}`:'此层没有出水边'}`;}
function finishStroke(){if(!editor?.stroke)return;if(effectiveRectangle()&&rectangleEnd)editor.rectangle(rectangleEnd);const changedStroke=editor.end();strokeButton=-1;rectangleEnd=null;if(changedStroke){changed();refreshStatus();}}
const canvas=$<HTMLCanvasElement>('world');
canvas.addEventListener('pointerdown',e=>{if(game){if(e.button===0&&(winFlow==='pending'||winFlow==='flight')){e.preventDefault();skipCompletion();}return;}if((e.button!==0&&e.button!==2)||!view)return;e.preventDefault();canvas.focus();const erase=e.button===2,pick=view.pick(e.clientX,e.clientY);if(!pick)return;editor.begin(erase,pick);strokeButton=e.button;canvas.setPointerCapture(e.pointerId);rectangleEnd=erase?editor.erasePosition(pick):resolvePlacement(pick,editor.settings).position;if(!effectiveRectangle()){editor.paint(pick);requestDraw();}});
canvas.addEventListener('pointermove',e=>{if(game||!view)return;const pick=view.pick(e.clientX,e.clientY,editor.stroke?.before);inspect(pick);
  if(editor.stroke&&pick&&(e.buttons&3)&&effectiveRectangle()&&editor.stroke.start){const start=editor.stroke.erase?editor.stroke.start.position:resolvePlacement(editor.stroke.start,editor.settings).position;const normal=editor.stroke.erase?editor.stroke.start.normal:placementNormal(editor.stroke.start,editor.settings);rectangleEnd=view.intersectPlane(e.clientX,e.clientY,start,normal);}
  const erase=strokeButton===2||!!(e.buttons&2);view.preview(pick&&!erase?editor.preview(pick):null,pick,erase,pick?editor.previewArea(pick,rectangleEnd,erase):[]);
  if(!editor.stroke||!pick||!(e.buttons&3))return;
  if(effectiveRectangle()&&editor.stroke.start){/* The rectangle commits on pointerup. */}
  else{editor.paint(pick);requestDraw();}});
canvas.addEventListener('pointerup',e=>{if(e.button!==1)finishStroke();});canvas.addEventListener('pointercancel',()=>finishStroke());canvas.addEventListener('lostpointercapture',()=>finishStroke());canvas.addEventListener('pointerleave',()=>{if(!editor?.stroke){view?.preview(null,null);}});
window.addEventListener('keydown',e=>{if((e.target as HTMLElement).closest('input,select,textarea,dialog'))return;const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo();return;}if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();void save();return;}
  if(game){if(app.classList.contains('level-drawer-open')){if(k==='escape'){e.preventDefault();setLevelDrawer(false);}return;}if(k==='enter'&&winFlow!=='idle'){e.preventDefault();skipCompletion();return;}if(moveKeys[k]){e.preventDefault();if(!e.repeat)startHeld(k);}else if(k===' '){e.preventDefault();if(!e.repeat)act({type:'pull'});}else if(k==='z')undo();else if(k==='y')redo();else if(k==='r')$('restart').click();else if(k==='escape')indexPlay?leaveIndexPlay():togglePlay();}
  else if(k==='s'){e.preventDefault();if(!e.repeat)togglePlay();}else if(k==='r')rotate();else if(k==='f')$('focus').click();else if(k==='['||k===']'){editor.settings.brush=([1,3,5][Math.max(0,Math.min(2,[1,3,5].indexOf(editor.settings.brush)+(k===']'?1:-1)))] as 1|3|5);syncControls();changed();}else if(k==='escape'){editor.cancel();draw();}
});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(moveKeys[k])stopHeld(k);});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')){
  const k=button.dataset.move!;
  button.addEventListener('pointerdown',e=>{if(!game)return;e.preventDefault();button.setPointerCapture(e.pointerId);startHeld(k);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>stopHeld(k));
}
$('mobile-pull').onclick=()=>{if(game)act({type:'pull'});};
$('mobile-undo').onclick=()=>undo();
window.addEventListener('blur',clearMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearMovement();if(editor)void save();}});
async function start(){
  renderPalette();try{completed=await store.loadCompleted();}catch{notice('通关记录暂时无法读取。');}
  try{view=new WorldView(canvas,message=>{$('render-error').textContent=message;$('render-error').hidden=false;});view.onSample=p=>{editor.sample(p);syncControls();scheduleSave();refreshStatus();notice(`已取样：${nameOf(editor.settings.tool)}`);};view.onIdle=()=>{refreshStatus();if(winFlow==='pending'){beginCompletion();return;}if(winFlow!=='idle')return;const next=pending;pending=null;if(next){act(next);return;}const key=queuedKey??activeHeld();queuedKey=null;if(key&&held.has(key)&&blockedHeld!==key)moveByKey(key);};view.controls.addEventListener('change',()=>{if(game)refreshStatus();});view.onStats=(fps,calls)=>{$('render-stats').textContent=`${fps} FPS · ${calls} 次绘制`;};}catch(error){$('render-error').textContent=`无法启动三维画面：${(error as Error).message}。关卡仍可导出。`;$('render-error').hidden=false;}
  if(!project.levels[project.active])project.active=Object.keys(project.levels)[0];if(!project.active){const c=addChapter(project);addLevel(project,c);}const params=new URLSearchParams(location.search),progress=loadProgress(),requested=params.get('level')??progress.lastLevel;indexPlay=params.get('mode')==='play'||!!params.get('level')||!!progress.lastLevel;selectLevel(requested&&project.levels[requested]?requested:project.active);if(indexPlay)togglePlay();$('loading').hidden=true;
  if(view)try{fillThumbnails($('palette'));}catch{/* Keep the usable symbol previews if an auxiliary WebGL context is unavailable. */}
  // Local diagnostics deliberately expose the same public controller APIs used by the UI.
  Object.assign(window,{waterWorkshop:{get level(){return clone(editor.level);},get project(){capture();return clone(project);},get state(){return game?clone(game.state):null;},get water(){return clone(water);},get settings(){return clone(editor.settings);},get fps(){return view?.fps??0;},get timings(){return {...timings};},get camera(){return{position:view?.camera.position.toArray(),target:view?.controls.target.toArray(),zoom:view?.camera.zoom};},get presentation(){return view?.presentation;},get completionPhase(){return winFlow;},get previewCount(){return view?.areaGhost.count??0;},directionFor:(d:Direction)=>view?.movementDirection(d),projectPoint:(p:Vec3)=>view?.project(p),pickAt:(x:number,y:number)=>view?.pick(x,y),select:selectLevel,play:togglePlay,act,undo,redo,skipCompletion,save,importJSON:(text:string)=>{capture();project=importProject(project,text);selectLevel(project.active);},setLevel:(level:LevelDataV2)=>{const errors=validateV2(level);if(errors.length)throw new Error(errors.join('；'));capture();const c=project.chapters[0];addLevel(project,c,clone(level));selectLevel(level.id);},finish:()=>view?.finish(),view:(name:'top'|Direction|'reset')=>view?.setView(name),get busy(){return view?.busy??false;}}});
}
void start();


