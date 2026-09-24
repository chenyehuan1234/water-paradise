import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const qa = (page: Page) => page.evaluate(() => (window as any).waterWorkshop);
const value = <T>(page: Page, f: (q: any) => T) => page.evaluate(f, undefined);
async function blank(page: Page) {
  await page.evaluate(() => {
    const q=(window as any).waterWorkshop;
    const objects=[];
    for(let z=0;z<8;z++)for(let x=0;x<8;x++)objects.push({id:`floor-${x}-${z}`,kind:'stone',x,y:0,z,direction:'north'});
    q.setLevel({version:2,id:`qa-${crypto.randomUUID()}`,name:'操作修订验收',width:8,depth:8,objects,source:{x:1,y:1,z:1},spawn:{x:4,y:1,z:5}});
  });
}
async function center(page:Page,p:{x:number;y:number;z:number}){return page.evaluate(p=>(window as any).waterWorkshop.projectPoint(p),p);}

test.beforeEach(async({page})=>{await page.goto('/');await page.waitForFunction(()=>!!(window as any).waterWorkshop);await expect(page.locator('#render-error')).toBeHidden();});

test('revision: movement, mid-animation undo, redo, held keys and camera-relative controls',async({page},info)=>{
  await mkdir('docs/screenshots/revision',{recursive:true});await blank(page);await page.locator('#play').click();
  const before=await page.evaluate(()=>(window as any).waterWorkshop.state.player);
  await page.evaluate(()=>(window as any).waterWorkshop.act({type:'move',direction:'north'}));
  await page.waitForTimeout(70);
  const mid=await page.evaluate(()=>(window as any).waterWorkshop.presentation.positions.player);
  expect(mid[2]).toBeGreaterThan(before.z-1-(8-1)/2);expect(mid[2]).toBeLessThan(before.z-(8-1)/2);
  const transition=await page.evaluate(()=>{const q=(window as any).waterWorkshop,before=q.presentation.positions.player[2];q.undo();return {before,after:q.presentation.positions.player[2]};});
  const startUndo=[0,0,transition.after];expect(Math.abs(transition.after-transition.before)).toBeLessThan(.02);
  await page.waitForTimeout(75);const middleUndo=await page.evaluate(()=>(window as any).waterWorkshop.presentation.positions.player);
  expect(middleUndo[2]).toBeGreaterThan(startUndo[2]);
  await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-undo-middle.png`});
  await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);expect(await page.evaluate(()=>(window as any).waterWorkshop.state.player)).toEqual(before);
  await page.locator('#redo').click();await page.waitForTimeout(90);expect(await page.evaluate(()=>(window as any).waterWorkshop.busy)).toBe(true);
  await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-redo-middle.png`});
  await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);
  await page.locator('#restart').click();await page.keyboard.down('w');await page.waitForTimeout(690);await page.keyboard.up('w');
  const turns=await page.evaluate(()=>(window as any).waterWorkshop.state.turn);expect(turns).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(460);expect(await page.evaluate(()=>(window as any).waterWorkshop.state.turn)).toBe(turns);
  await page.evaluate(()=>(window as any).waterWorkshop.view('north'));expect(await page.evaluate(()=>(window as any).waterWorkshop.directionFor('north'))).toBe('south');
  await page.evaluate(()=>(window as any).waterWorkshop.view('top'));expect(await page.evaluate(()=>(window as any).waterWorkshop.directionFor('north'))).toBe('south');
  await page.evaluate(()=>(window as any).waterWorkshop.view('south'));expect(await page.evaluate(()=>(window as any).waterWorkshop.directionFor('north'))).toBe('north');
  await page.evaluate(()=>(window as any).waterWorkshop.view('east'));expect(await page.evaluate(()=>(window as any).waterWorkshop.directionFor('north'))).toBe('west');
  await page.evaluate(()=>(window as any).waterWorkshop.view('west'));expect(await page.evaluate(()=>(window as any).waterWorkshop.directionFor('north'))).toBe('east');
  await page.keyboard.down('w');await page.waitForTimeout(100);await page.keyboard.up('w');await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);
  const last=await page.evaluate(()=>(window as any).waterWorkshop.state.player);expect(last.x).toBe(before.x+1);
});

test('revision: full animation remains visible with reduced-motion OS, simplified mode settles instantly',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>!!(window as any).waterWorkshop);await blank(page);
  await expect(page.locator('#animation-mode')).toHaveValue('full');await page.locator('#play').click();
  await page.evaluate(()=>(window as any).waterWorkshop.act({type:'move',direction:'north'}));expect(await page.evaluate(()=>(window as any).waterWorkshop.busy)).toBe(true);
  await page.locator('#animation-mode').selectOption('simple');expect(await page.evaluate(()=>(window as any).waterWorkshop.busy)).toBe(false);
  await page.evaluate(()=>(window as any).waterWorkshop.act({type:'move',direction:'north'}));expect(await page.evaluate(()=>(window as any).waterWorkshop.busy)).toBe(false);
});

test('revision: a held key stops at walls, on release and on loss of focus',async({page})=>{
  await blank(page);await page.locator('#play').click();await page.evaluate(()=>(window as any).waterWorkshop.view('north'));
  await page.keyboard.down('w');await page.waitForTimeout(1150);
  const wall=await page.evaluate(()=>(window as any).waterWorkshop.state);expect(wall.player.z).toBe(7);expect(wall.turn).toBe(2);
  await page.waitForTimeout(450);expect(await page.evaluate(()=>(window as any).waterWorkshop.state.turn)).toBe(2);await page.keyboard.up('w');
  await page.evaluate(()=>(window as any).waterWorkshop.view('south'));
  await page.keyboard.down('w');await page.waitForTimeout(80);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(470);
  const stopped=await page.evaluate(()=>(window as any).waterWorkshop.state.turn);await page.waitForTimeout(450);
  expect(await page.evaluate(()=>(window as any).waterWorkshop.state.turn)).toBe(stopped);await page.keyboard.up('w');
  await page.locator('#restart').click();await page.evaluate(()=>(window as any).waterWorkshop.view('reset'));
  await page.keyboard.down('w');await page.waitForTimeout(65);await page.keyboard.down('d');await page.keyboard.up('w');
  await page.waitForTimeout(310);await page.keyboard.up('d');await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);
  const changed=await page.evaluate(()=>(window as any).waterWorkshop.state.player);
  expect(changed.z).toBe(4);expect(changed.x).toBeGreaterThanOrEqual(5);
});

test('revision: water rise has intermediate heights while ambient flow is paused',async({page},info)=>{
  await mkdir('docs/screenshots/revision',{recursive:true});await page.evaluate(()=>(window as any).waterWorkshop.select('rising'));await page.locator('#play').click();
  const before=await page.evaluate(()=>(window as any).waterWorkshop.presentation.water.surfaces);
  await page.evaluate(()=>(window as any).waterWorkshop.act({type:'move',direction:'south'}));
  const target=await page.evaluate(()=>(window as any).waterWorkshop.water.cells.filter((c:any)=>c.kind!=='dry').map((c:any)=>({id:c.id,level:c.level})));
  const changed=target.find((c:any)=>{const old=before.find((s:any)=>s.id===c.id);return old&&Math.abs(old.y-c.level)>.5;});expect(changed).toBeTruthy();
  await page.waitForTimeout(110);const mid=await page.evaluate((id)=>(window as any).waterWorkshop.presentation.water.surfaces.find((s:any)=>s.id===id),changed.id);
  const old=before.find((s:any)=>s.id===changed.id);expect(mid.y).toBeGreaterThan(Math.min(old.y,changed.level));expect(mid.y).toBeLessThan(Math.max(old.y,changed.level));
  await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-water-middle.png`});
  await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);
  await page.evaluate(()=>(window as any).waterWorkshop.undo());await page.waitForTimeout(105);
  const lowering=await page.evaluate((id)=>(window as any).waterWorkshop.presentation.water.surfaces.find((s:any)=>s.id===id),changed.id);
  expect(lowering.y).toBeGreaterThan(Math.min(old.y,changed.level));expect(lowering.y).toBeLessThan(Math.max(old.y,changed.level));
  await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-water-lowering-middle.png`});
});

test('revision: push, pull, climb and fall have visible intermediate poses',async({page},info)=>{
  await mkdir('docs/screenshots/revision',{recursive:true});
  const check=async(id:string,pre:(q:any)=>any,command:any,objectId:string,axis:0|1|2,delay:number)=>{
    await page.evaluate(id=>(window as any).waterWorkshop.select(id),id);await page.locator('#play').click();await pre(null);
    const before=await page.evaluate(id=>{const q=(window as any).waterWorkshop;return id==='player'?q.state.player:q.state.objects.find((o:any)=>o.id===id);},objectId);
    await page.evaluate(c=>(window as any).waterWorkshop.act(c),command);
    const after=await page.evaluate(id=>{const q=(window as any).waterWorkshop;return id==='player'?q.state.player:q.state.objects.find((o:any)=>o.id===id);},objectId);
    await page.waitForTimeout(delay);
    const shown=await page.evaluate(id=>(window as any).waterWorkshop.presentation.positions[id],objectId);
    const key=['x','y','z'][axis] as 'x'|'y'|'z',dimensions=await page.evaluate(()=>(window as any).waterWorkshop.level),offset=axis===1?0:axis===0?(dimensions.width-1)/2:(dimensions.depth-1)/2;
    expect(shown[axis]+offset).toBeGreaterThan(Math.min(before[key],after[key]));expect(shown[axis]+offset).toBeLessThan(Math.max(before[key],after[key])+(id==='sample-台阶与铁架'?.18:0));
    await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-${id}-middle.png`});
    await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);await page.locator('#play').click();
  };
  await check('validation-push',async()=>{}, {type:'move',direction:'south'},'gate',2,90);
  await check('validation-pull',async()=>{await page.evaluate(()=>(window as any).waterWorkshop.act({type:'turn',direction:'north'}));await page.waitForFunction(()=>!(window as any).waterWorkshop.busy);},{type:'pull'},'gate',2,130);
  await check('sample-台阶与铁架',async()=>{}, {type:'move',direction:'north'},'player',1,155);
  await page.evaluate(()=>(window as any).waterWorkshop.select('sample-落水的力量'));await page.locator('#play').click();
  const wood=await page.evaluate(()=>(window as any).waterWorkshop.state.objects.find((o:any)=>o.kind==='wood'));
  await page.evaluate(()=>(window as any).waterWorkshop.act({type:'move',direction:'east'}));
  await page.waitForTimeout(140);const shown=await page.evaluate(id=>(window as any).waterWorkshop.presentation.positions[id],wood.id);
  const final=await page.evaluate(id=>(window as any).waterWorkshop.state.objects.find((o:any)=>o.id===id),wood.id);
  expect(shown[1]).toBeGreaterThan(final.y);expect(shown[1]).toBeLessThan(wood.y);
  await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-fall-middle.png`});
});

test('revision: top-face glass automatically targets four edges and can be erased with one undo',async({page},info)=>{
  await blank(page);await page.locator('[data-tool="glass"]').click();await page.locator('[data-view="top"]').click();
  for(const [x,z] of [[3.36,3],[2.64,3],[3,3.36],[3,2.64]]){const p=await center(page,{x,y:1.01,z});await page.mouse.click(p.x,p.y);}
  const glass=await page.evaluate(()=>(window as any).waterWorkshop.level.objects.filter((o:any)=>o.kind==='glass'&&o.x===3&&o.z===3&&o.y===1));
  expect(glass.map((o:any)=>o.direction).sort()).toEqual(['east','north','south','west']);
  await mkdir('docs/screenshots/revision',{recursive:true});await page.screenshot({path:`docs/screenshots/revision/${info.project.name}-glass-four-edges.png`});
  const edge=await center(page,{x:3.5,y:2,z:3});await page.mouse.click(edge.x,edge.y,{button:'right'});
  expect(await page.evaluate(()=>(window as any).waterWorkshop.level.objects.filter((o:any)=>o.kind==='glass'&&o.x===3&&o.z===3&&o.y===1).length)).toBe(3);
  await page.locator('#undo').click();expect(await page.evaluate(()=>(window as any).waterWorkshop.level.objects.filter((o:any)=>o.kind==='glass'&&o.x===3&&o.z===3&&o.y===1).length)).toBe(4);
});

test('revision: glass edge extension, vertical rectangle, sampling and manual direction',async({page})=>{
  await blank(page);await page.locator('[data-tool="glass"]').click();await page.locator('[data-view="top"]').click();
  const tile=await center(page,{x:3.36,y:1.01,z:3});await page.mouse.click(tile.x,tile.y);
  const top=await center(page,{x:3.5,y:2,z:3});await page.mouse.click(top.x,top.y);
  expect(await page.evaluate(()=>(window as any).waterWorkshop.level.objects.some((o:any)=>o.kind==='glass'&&o.x===3&&o.y===2&&o.z===3&&o.direction==='east'))).toBe(true);
  await page.locator('[data-view="east"]').click();
  const edge=await center(page,{x:3.5,y:1.45,z:3.43});
  const sampled=await page.evaluate(p=>(window as any).waterWorkshop.pickAt(p.x,p.y),edge);expect(sampled.kind).toBe('glass');
  await page.mouse.click(edge.x,edge.y,{button:'middle'});expect(await page.evaluate(()=>(window as any).waterWorkshop.settings.direction)).toBe('east');
  await page.mouse.click(edge.x,edge.y);
  expect(await page.evaluate(()=>(window as any).waterWorkshop.level.objects.some((o:any)=>o.kind==='glass'&&o.x===3&&o.y===1&&o.z===4&&o.direction==='east'))).toBe(true);
  await page.locator('[data-glass="south"]').click();expect(await page.evaluate(()=>(window as any).waterWorkshop.settings.glassMode)).toBe('manual');
  await page.locator('[data-glass="east"]').click();await page.locator('#rectangle').check();
  const before=await page.evaluate(()=>(window as any).waterWorkshop.level.objects.filter((o:any)=>o.kind==='glass').length);
  const start=await center(page,{x:3.5,y:1.4,z:3}),end=await center(page,{x:3.5,y:3.4,z:5});
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:10});await page.mouse.up();
  const after=await page.evaluate(()=>(window as any).waterWorkshop.level.objects.filter((o:any)=>o.kind==='glass').length);expect(after).toBeGreaterThan(before);
  await page.locator('#undo').click();expect(await page.evaluate(()=>(window as any).waterWorkshop.level.objects.filter((o:any)=>o.kind==='glass').length)).toBe(before);
  await page.locator('[data-glass="auto"]').click();expect(await page.evaluate(()=>(window as any).waterWorkshop.settings.glassMode)).toBe('auto');
});
