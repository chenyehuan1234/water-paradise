import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';

const folder='docs/recordings/revision';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
const blank=()=>{const objects=[];for(let z=0;z<8;z++)for(let x=0;x<8;x++)objects.push({id:`floor-${x}-${z}`,kind:'stone',x,y:0,z,direction:'north'});window.waterWorkshop.setLevel({version:2,id:`film-${crypto.randomUUID()}`,name:'动作记录',width:8,depth:8,objects,source:{x:1,y:1,z:1},spawn:{x:4,y:1,z:5}});};
const shots=[
  {name:'walk',prepare:blank,action:async page=>page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'north'}))},
  {name:'push',level:'validation-push',action:async page=>page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'south'}))},
  {name:'pull',level:'validation-pull',prepare:async page=>{await page.evaluate(()=>window.waterWorkshop.act({type:'turn',direction:'north'}));await page.waitForFunction(()=>!window.waterWorkshop.busy);},action:async page=>page.evaluate(()=>window.waterWorkshop.act({type:'pull'}))},
  {name:'climb',level:'sample-台阶与铁架',action:async page=>page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'north'}))},
  {name:'fall',level:'sample-落水的力量',action:async page=>page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'east'}))},
  {name:'water-rise',level:'rising',action:async page=>page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'south'}))},
  {name:'water-lower',level:'rising',action:async page=>{await page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'south'}));await page.waitForFunction(()=>!window.waterWorkshop.busy);await page.evaluate(()=>window.waterWorkshop.undo());}},
  {name:'undo-during-walk',prepare:blank,action:async page=>{await page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'north'}));await page.waitForTimeout(90);await page.evaluate(()=>window.waterWorkshop.undo());}},
  {name:'redo',prepare:blank,action:async page=>{await page.evaluate(()=>window.waterWorkshop.act({type:'move',direction:'north'}));await page.waitForFunction(()=>!window.waterWorkshop.busy);await page.evaluate(()=>window.waterWorkshop.undo());await page.waitForFunction(()=>!window.waterWorkshop.busy);await page.evaluate(()=>window.waterWorkshop.redo());}},
];
try {for(const shot of shots.filter(shot=>!process.argv[2]||shot.name===process.argv[2])){const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:folder,size:{width:1280,height:720}}});const page=await context.newPage();await page.goto('http://127.0.0.1:4180/');await page.waitForFunction(()=>!!window.waterWorkshop);
    if(shot.level)await page.evaluate(id=>window.waterWorkshop.select(id),shot.level);
    if(shot.prepare)await (typeof shot.prepare==='function'&&shot.prepare===blank?page.evaluate(blank):shot.prepare(page));
    await page.locator('#play').click();await page.evaluate(()=>document.querySelector('#notice').textContent='');await page.waitForTimeout(200);
    await shot.action(page);await page.waitForTimeout(1050);const video=page.video();await page.close();const source=await video.path();await rename(source,`${folder}/${shot.name}.webm`);await context.close();console.log(shot.name);
  }} finally {await browser.close();}
