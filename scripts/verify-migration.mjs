import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--no-proxy-server'] });
const root = 'http://127.0.0.1:';
const makeLevel = suffix => {
  const objects=[];
  for(let z=0;z<8;z++)for(let x=0;x<8;x++)objects.push({id:`floor-${x}-${z}`,kind:'stone',x,y:0,z,direction:'north'});
  objects.push({id:'legacy-boat',kind:'boat',x:3,y:1,z:3,direction:'north',cargo:[{id:'first',kind:'wood'},{id:'second',kind:'crate'}]});
  return {version:2,id:`origin-${suffix}`,name:`跨地址验收 ${suffix}`,width:8,depth:8,objects,source:{x:1,y:1,z:1},spawn:{x:4,y:1,z:5}};
};
async function open(context,port){const page=await context.newPage();await page.goto(root+port+'/');await page.waitForFunction(()=>!!window.waterWorkshop,{timeout:20000});return page;}
async function add(page,suffix){const level=makeLevel(suffix);await page.evaluate(level=>window.waterWorkshop.setLevel(level),level);await page.evaluate(()=>window.waterWorkshop.save());return level.id;}
async function seedOld(page,level){await page.goto(root+'4175/transfer.html');await page.evaluate(async level=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('water-paradise-workshop',1);r.onupgradeneeded=()=>{r.result.createObjectStore('levels',{keyPath:'id'});r.result.createObjectStore('meta');r.result.createObjectStore('backups');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction(['meta','levels'],'readwrite');tx.objectStore('meta').put({version:2,chapters:[{id:'old-chapter',name:'旧址关卡',levels:[level.id],collapsed:false}],active:level.id,trash:[]},'project');tx.objectStore('levels').put({id:level.id,level,settings:{tool:'glass',direction:'west',layer:4,brush:3,rectangle:false,slice:32,grid:true,depth:false,outlets:true}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
},level);}
async function oldCount(page){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('water-paradise-workshop',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const count=await new Promise((resolve,reject)=>{const r=db.transaction('levels').objectStore('levels').count();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return count;});}
async function run(existing){const context=await browser.newContext(), report={scenario:existing?'merge':'empty'};let newPage,oldPage;
  const bridge=await readFile('public/transfer.html','utf8');
  await context.route(root+'4175/transfer.html',route=>route.fulfill({status:200,contentType:'text/html',body:bridge}));
  await context.route(root+'4180/__old-transfer-probe',route=>route.fulfill({status:200,contentType:'application/json',body:'{"available":true}'}));
  if(existing){newPage=await open(context,4180);report.newId=await add(newPage,'new-'+crypto.randomUUID().slice(0,8));await newPage.close();}
  oldPage=await context.newPage();const oldLevel=makeLevel('old-'+crypto.randomUUID().slice(0,8));report.oldId=oldLevel.id;await seedOld(oldPage,oldLevel);
  const oldBefore=await oldCount(oldPage);
  newPage=await open(context,4180);
  const migrated=await newPage.evaluate(()=>window.waterWorkshop.project);
  const found=Object.values(migrated.levels).filter(level=>level.name.includes(report.oldId.split('-').at(-1)));
  if(!found.length)throw new Error('旧地址关卡未迁移');
  if(!existing&&!migrated.levels[report.oldId])throw new Error('空库迁移未保留旧 ID');
  if(existing&&(!migrated.levels[report.newId]||found.some(level=>level.id===report.oldId)))throw new Error('有内容时未以新副本合并');
  const imported=found[0],boat=imported.objects.find(o=>o.id==='legacy-boat'),second=imported.objects.find(o=>o.id==='second');
  if(boat?.cargo?.length!==1||boat.cargo[0].id!=='first'||second?.kind!=='crate')throw new Error('多件旧载荷迁移不正确');
  report.count=Object.keys(migrated.levels).length;report.bound=boat.cargo[0];report.upper={id:second.id,y:second.y};
  await newPage.reload();await newPage.waitForFunction(()=>!!window.waterWorkshop);const restored=await newPage.evaluate(()=>window.waterWorkshop.project);
  if(!restored.levels[imported.id])throw new Error('新地址刷新后关卡丢失');
  report.refresh='ok';report.oldUnchanged=(await oldCount(oldPage))===oldBefore;
  if(!report.oldUnchanged)throw new Error('旧地址内容被改写');
  await context.close();return report;
}
try{const report=[await run(false),await run(true)];await mkdir('docs',{recursive:true});await writeFile('docs/revision-migration-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
finally{await browser.close();}
