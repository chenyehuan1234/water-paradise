import { describe, expect, it } from 'vitest';
import { newLevel, parseLevel } from '../../src/world/level';
import { floor, object, exampleProject } from '../../src/world/examples';
import { applyAction, GameSession, initialState } from '../../src/world/game';
import { solveWater } from '../../src/world/water';
import { clone } from '../../src/world/types';
function pool(){const l=newLevel('浮船试验',8,8);floor(l);for(let x=0;x<8;x++)for(let z=0;z<8;z++)if(x===0||z===0||x===7||z===7)for(let y=1;y<=2;y++)object(l,'stone',x,y,z);l.objects=l.objects.filter(o=>!(o.x===3&&o.z===0&&o.y===2));l.source={x:2,y:1,z:2};l.spawn={x:2,y:1,z:6};return l;}
const cargo=(id:string)=>[{id,kind:'crate' as const}];
describe('载荷、浮力和四种拉取关系',()=>{
 it('陆地拉箱：一格、同高、遮挡失败',()=>{const l=pool();object(l,'crate',2,1,3);const s=new GameSession(l);s.act({type:'turn',direction:'north'});expect(s.act({type:'pull'}).accepted).toBe(true);expect(s.state.objects.find(o=>o.kind==='crate')?.z).toBe(4);object(l,'glass',2,1,5,{direction:'north'});const blocked=new GameSession(l);blocked.act({type:'turn',direction:'north'});expect(blocked.act({type:'pull'}).accepted).toBe(false);});
 it('主角在船：朝岸上箱子靠近，箱子原地不动',()=>{const l=pool();object(l,'boat',2,1,5,{id:'boat'});object(l,'stone',5,1,5);object(l,'crate',5,2,5,{id:'target'});l.spawn={x:2,y:2,z:5};const s=new GameSession(l);s.act({type:'turn',direction:'east'});expect(s.act({type:'pull'}).accepted).toBe(true);expect(s.state.player.x).toBe(3);expect(s.state.objects.find(o=>o.id==='target')?.x).toBe(5);expect(s.state.riding).toBe('boat');});
 it('主角在岸：船及永久载荷被拉近',()=>{const l=pool();object(l,'stone',2,1,5);object(l,'boat',5,1,5,{id:'boat',cargo:cargo('c')});l.spawn={x:2,y:2,z:5};const s=new GameSession(l);s.act({type:'turn',direction:'east'});expect(s.act({type:'pull'}).accepted).toBe(true);expect(s.state.objects.find(o=>o.id==='boat')?.x).toBe(4);expect(s.state.player.x).toBe(2);});
 it('两条船共同移动，重叠或互穿时整次拒绝',()=>{const l=pool();object(l,'boat',2,1,5,{id:'a'});object(l,'boat',5,1,5,{id:'b',cargo:cargo('c')});l.spawn={x:2,y:2,z:5};const s=new GameSession(l);s.act({type:'turn',direction:'east'});expect(s.act({type:'pull'}).accepted).toBe(true);expect(s.state.objects.find(o=>o.id==='a')?.x).toBe(3);expect(s.state.objects.find(o=>o.id==='b')?.x).toBe(4);const before=clone(s.state);expect(s.act({type:'pull'}).accepted).toBe(false);expect(s.state).toEqual(before);});
 it('一侧受阻，两船均保持原位',()=>{const l=pool();object(l,'boat',2,1,5,{id:'a'});object(l,'boat',5,1,5,{id:'b',cargo:cargo('c')});object(l,'stone',4,2,5);l.spawn={x:2,y:2,z:5};const s=new GameSession(l);s.act({type:'turn',direction:'east'});const before=clone(s.state);expect(s.act({type:'pull'}).accepted).toBe(false);expect(s.state).toEqual(before);});
 it('首块绑定，第二块完整尺寸且保持独立身份',()=>{const l=pool();object(l,'boat',3,1,3,{id:'boat'});object(l,'crate',3,4,3,{id:'first'});object(l,'wood',3,5,3,{id:'second'});l.spawn={x:2,y:1,z:6};const s=new GameSession(l),boat=s.state.objects.find(o=>o.id==='boat')!;expect(boat.y).toBe(2);expect(boat.cargo).toEqual([{id:'first',kind:'crate'}]);expect(s.state.objects.find(o=>o.id==='second')?.y).toBe(3);expect(s.state.objects.filter(o=>o.id==='first')).toHaveLength(0);});
 it('齐平进入空船时首块绑定，之后进入的方块独立堆叠',()=>{const l=pool();object(l,'stone',2,1,4);object(l,'stone',3,1,4);object(l,'crate',3,2,4,{id:'first'});object(l,'boat',4,1,4,{id:'boat'});l.spawn={x:2,y:2,z:4};const s=new GameSession(l);expect(s.act({type:'move',direction:'east'}).accepted).toBe(true);expect(s.state.objects.find(o=>o.id==='boat')?.cargo?.[0].id).toBe('first');});
 it('深水不手推，水位上涨受桥板与乘客头顶碰撞约束',()=>{const l=pool();object(l,'boat',3,1,5,{id:'boat'});l.spawn={x:2,y:1,z:5};const s=new GameSession(l);s.act({type:'move',direction:'east'});expect(s.state.objects.find(o=>o.id==='boat')?.x).toBe(3);
 const high=pool();high.objects=high.objects.filter(o=>!(o.x===3&&o.z===0&&o.y===1));object(high,'stone',3,1,0);object(high,'stone',3,2,0);object(high,'boat',3,1,4,{id:'boat'});object(high,'bridge',3,2,4);const t=new GameSession(high);expect(t.water.cells.find(c=>c.x===3&&c.z===4)?.level).toBe(3);expect(t.state.objects.find(o=>o.id==='boat')?.y).toBe(2);});
});
describe('落水驱船与水层通关',()=>{
 it('同回合相反水花抵消，而且相邻不同水层不受影响',()=>{
   const l=pool();object(l,'boat',4,1,4,{id:'boat'});const initial=initialState(l).state;
   // Inject the gravity phase's two pending falls, as produced by a simultaneous group action.
   initial.objects.push({id:'left-fall',kind:'crate',x:3,y:5,z:4,direction:'north'},{id:'right-fall',kind:'wood',x:5,y:5,z:4,direction:'north'});
   const r=applyAction(l,initial,{type:'wait'});expect(r.events.filter(e=>e.type==='splash')).toHaveLength(2);expect(r.events.some(e=>e.type==='slide')).toBe(false);expect(r.state.objects.find(o=>o.id==='boat')?.x).toBe(4);
 });
 it('只有真实落入原有深水产生驱船水花，船滑至边界',()=>{const l=exampleProject().levels['sample-落水的力量'],s=new GameSession(l),result=s.act({type:'move',direction:'east'});expect(result.accepted).toBe(true);expect(result.events.some(e=>e.type==='splash')).toBe(true);expect(s.state.objects.find(o=>o.kind==='boat')?.x).toBe(6);expect(result.events.filter(e=>e.type==='splash').every(e=>e.id!==s.state.objects.find(o=>o.kind==='boat')?.id)).toBe(true);});
 it('薄水只产生水滴，不产生驱船事件',()=>{const l=newLevel('薄水',8,8);floor(l);object(l,'floating',1,3,4);object(l,'floating',2,3,4);object(l,'wood',2,4,4);object(l,'boat',4,1,4,{id:'boat'});l.spawn={x:1,y:4,z:4};l.source={x:0,y:1,z:0};const s=new GameSession(l),r=s.act({type:'move',direction:'east'});expect(r.events.some(e=>e.type==='drip')).toBe(true);expect(r.events.some(e=>e.type==='splash')).toBe(false);expect(s.state.objects.find(o=>o.id==='boat')?.x).toBe(4);});
 it('等待与水位变化不会凭空制造水花',()=>{const l=pool();object(l,'boat',3,1,4);const s=new GameSession(l);const r=s.act({type:'wait'});expect(r.events.some(e=>['splash','slide'].includes(e.type))).toBe(false);expect(r.water).toEqual(solveWater(l,s.state.objects));});
 it('站在出口楼上的桥板不会误通关',()=>{const l=exampleProject().levels.homecoming;l.objects=l.objects.filter(o=>o.kind!=='crate');object(l,'crate',5,1,3);object(l,'bridge',0,4,3);l.spawn={x:0,y:4,z:3};const init=initialState(l);expect(init.water.outlets).toHaveLength(1);expect(init.state.status).toBe('playing');expect(applyAction(l,init.state,{type:'wait'}).state.status).toBe('playing');});
});

describe('薄船板、独立上层与可逆历史',()=>{
 it('一格深水把空船托到水面，绑定方块保持一整格',()=>{
   const l=pool();object(l,'boat',3,1,3,{id:'boat'});const empty=new GameSession(l);
   expect(empty.water.cells.find(c=>c.x===3&&c.z===3)?.level).toBe(2);
   expect(empty.state.objects.find(o=>o.id==='boat')?.y).toBe(2);
   const loaded=pool();object(loaded,'boat',3,1,3,{id:'boat',cargo:[{id:'bound',kind:'crate'}]});loaded.spawn={x:3,y:2,z:3};
   const game=new GameSession(loaded),boat=game.state.objects.find(o=>o.id==='boat')!;
   expect(boat.y).toBe(2);expect(boat.y+1).toBe(3);expect(game.state.player.y).toBe(3);expect(game.state.riding).toBe('boat');
 });
 it('内置隔水牵引样例按实际层高可拉动两船',()=>{
   const l=exampleProject().levels['sample-隔水牵引'],s=new GameSession(l);
   expect(s.state.player.y).toBe(2);expect(s.act({type:'turn',direction:'east'}).accepted).toBe(true);
   expect(s.act({type:'pull'}).accepted).toBe(true);
   expect(s.state.objects.filter(o=>o.kind==='boat').map(o=>o.x).sort()).toEqual([3,4]);
 });
 it('浮船升降带动普通上层物件，普通物件仍保留 ID',()=>{
   const l=pool();object(l,'boat',3,1,3,{id:'boat',cargo:[{id:'bound',kind:'wood'}]});object(l,'crate',3,2,3,{id:'upper'});
   const s=new GameSession(l),boat=s.state.objects.find(o=>o.id==='boat')!,upper=s.state.objects.find(o=>o.id==='upper')!;
   expect(boat.y).toBe(2);expect(upper.y).toBe(3);expect(upper.id).toBe('upper');expect(boat.cargo).toEqual([{id:'bound',kind:'wood'}]);
 });
 it('X 只拉独立上层箱子，首块绑定木块不能把船变成拉取目标',()=>{
   const l=pool();object(l,'stone',2,1,4);object(l,'stone',2,2,4);object(l,'stone',3,1,4);object(l,'stone',3,2,4);
   object(l,'boat',4,1,4,{id:'boat',cargo:[{id:'bound',kind:'wood'}]});object(l,'crate',4,2,4,{id:'upper'});
   l.spawn={x:2,y:3,z:4};const s=new GameSession(l);s.act({type:'turn',direction:'east'});
   expect(s.act({type:'pull'}).accepted).toBe(true);
   expect(s.state.objects.find(o=>o.id==='boat')?.x).toBe(4);
   expect(s.state.objects.find(o=>o.id==='upper')).toMatchObject({x:3,id:'upper'});
   const noUpper=pool();object(noUpper,'stone',2,1,4);object(noUpper,'boat',4,1,4,{id:'boat',cargo:[{id:'bound',kind:'wood'}]});noUpper.spawn={x:2,y:2,z:4};
   const t=new GameSession(noUpper);t.act({type:'turn',direction:'east'});expect(t.act({type:'pull'}).accepted).toBe(false);
 });
 it('升船检查完整堆叠净空，桥板过低时船保持被淹没',()=>{
   const l=pool();object(l,'boat',3,1,3,{id:'boat',cargo:[{id:'bound',kind:'crate'}]});object(l,'wood',3,2,3,{id:'upper'});object(l,'bridge',3,3,3);
   const s=new GameSession(l);expect(s.water.cells.find(c=>c.x===3&&c.z===3)?.level).toBe(2);
   expect(s.state.objects.find(o=>o.id==='boat')?.y).toBe(1);
   expect(s.state.objects.find(o=>o.id==='upper')?.y).toBe(2);
 });
 it('旧存档多件船载荷恢复成一件绑定和独立上层',()=>{
   const l=pool();object(l,'boat',3,1,3,{id:'boat',cargo:[{id:'first',kind:'wood'},{id:'second',kind:'crate'}]});
   const parsed=parseLevel(l),boat=parsed.objects.find(o=>o.id==='boat')!;
   expect(boat.cargo).toEqual([{id:'first',kind:'wood'}]);expect(parsed.objects.find(o=>o.id==='second')).toMatchObject({kind:'crate',x:3,y:2,z:3});
 });
 it('撤销和重做保留完整逻辑快照及反向路径',()=>{
   const l=exampleProject().levels['validation-push'],s=new GameSession(l),before=clone(s.state);
   const action=s.act({type:'move',direction:'south'});expect(action.accepted).toBe(true);const after=clone(s.state);
   const reverse=s.undo();expect(reverse&&reverse.events.some(e=>e.reversed)).toBe(true);expect(s.state).toEqual(before);
   const forward=s.redo();expect(forward&&forward.events.some(e=>!e.reversed)).toBe(true);expect(s.state).toEqual(after);
 });
});
