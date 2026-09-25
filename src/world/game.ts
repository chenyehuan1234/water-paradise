import { dynamic, height, solid, standable, top } from './catalog';
import { balanceParts } from './balance';
import { blocksEdge, bodyFree, inside, supportAt } from './spatial';
import { clone, dir, DIRS, plus, sameColumn } from './types';
import type { ActionEvent, Command, Direction, GameState, LevelDataV2, StepResult, Vec3, WaterSolution, WorldObject } from './types';
import { solveWater, waterAt } from './water';
import { validateV2 } from './level';

const point = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
const event = (events: ActionEvent[], type: ActionEvent['type'], id: string, from: Vec3, to: Vec3, extra: Partial<ActionEvent> = {}) => events.push({ type, id, from: point(from), to: point(to), ...extra });
export function supportingBoat(state: GameState, position: Vec3, exclude = new Set<string>()): WorldObject | undefined {
  let p = position;
  for (let i = 0; i < 33; i++) { const support = supportAt(state.objects, p, p.y, true, exclude);
    if (!support || top(support) !== p.y) return; if (support.kind === 'boat') return support;
    if (!dynamic(support)) return; exclude.add(support.id); p = support;
  }
}
const riding = (state: GameState) => supportingBoat(state, state.player)?.id ?? null;
const boatWater = (water: WaterSolution, boat: Vec3) => waterAt(water, {...boat, y: boat.y - .001}) ?? waterAt(water, boat);
function win(state: GameState, water: WaterSolution) {
  const e = water.outlets[0], cell = e && water.cells.find(c => c.id === e.cellId);
  // A bridge or upstairs platform above this water layer cannot satisfy a downstairs outlet.
  state.status = water.outlets.length === 1 && e.canFinish !== false && cell && sameColumn(state.player, e) && state.player.y >= cell.y && state.player.y <= cell.level && state.player.y < cell.ceiling ? 'won' : 'playing';
  if(state.status==='won')state.facing=e.direction;
}
function carriedGroup(state: GameState, seeds: string[], d: { x: number; z: number }, push: boolean) {
  const group = new Set(seeds); let changed = true;
  while (changed) { changed = false;
    for (const o of state.objects.filter(o => group.has(o.id))) for (const b of state.objects) {
      if (group.has(b.id) || !dynamic(b)) continue;
      const carried = sameColumn(o, b) && b.y === top(o);
      const ahead = push && sameColumn(plus(o, d), b) && b.y < o.y + Math.max(.01, height(o)) && b.y + Math.max(.01, height(b)) > o.y;
      if (carried || ahead) { group.add(b.id); changed = true; }
    }
  }
  return group;
}
/** All translations are preflighted as a single transaction, including carried actors. */
function translate(level: LevelDataV2, state: GameState, moves: Map<string, { x: number; z: number }>, water: WaterSolution, events: ActionEvent[], type: 'push' | 'pull' | 'slide'): boolean {
  const excluded = new Set(moves.keys()), proposals = state.objects.filter(o => moves.has(o.id)).map(o => ({ ...o, ...plus(o, moves.get(o.id)!) }));
  let actorDelta: { x: number; z: number } | undefined;
  const actorSupport = supportAt(state.objects, state.player, state.player.y, true);
  if (actorSupport && top(actorSupport) === state.player.y && moves.has(actorSupport.id)) actorDelta = moves.get(actorSupport.id);
  for (const next of proposals) {
    const old = state.objects.find(o => o.id === next.id)!, movement = moves.get(next.id)!, direction = DIRS.find(d => d.x === movement.x && d.z === movement.z)!.name;
    if (blocksEdge(state.objects, old, direction, old.y, old.y + Math.max(.01, height(old))) || !bodyFree(state.objects, next, Math.max(.01, height(old)), excluded)) return false;
    if (proposals.some(b => b.id !== next.id && sameColumn(b, next) && b.y < next.y + Math.max(.01,height(next)) && b.y + Math.max(.01,height(b)) > next.y)) return false;
    // Opposing boats may not exchange cells through one another during a simultaneous pull.
    if (proposals.some(b => b.id !== next.id && sameColumn(b, old) && sameColumn(state.objects.find(o => o.id === b.id)!, next) && b.y < next.y + Math.max(.01,height(next)) && b.y + Math.max(.01,height(b)) > next.y)) return false;
    const player = actorDelta ? plus(state.player, actorDelta) : state.player;
    if (sameColumn(player, next) && next.y < player.y + 1 && top(next) > player.y) return false;
  }
  if (actorDelta) {
    const p = plus(state.player, actorDelta), direction = DIRS.find(d => d.x === actorDelta!.x && d.z === actorDelta!.z)!.name;
    if (!inside(level, p) || !bodyFree([...state.objects.filter(o => !excluded.has(o.id)), ...proposals], p) || blocksEdge(state.objects, state.player, direction)) return false;
    // A movable support falling into a bottomless column cannot carry the player out of the world.
    const fixedOrUnmoved = state.objects.filter(o => !excluded.has(o.id));
    if (!supportAt(fixedOrUnmoved, p, p.y) && !proposals.some(o => o.kind === 'boat' && sameColumn(o, p) && waterAt(water, o)?.kind === 'deep')) return false;
  }
  for (const next of proposals) { const old = state.objects.find(o => o.id === next.id)!; event(events, type, old.id, old, next); Object.assign(old, next); }
  if (actorDelta) { const next = plus(state.player, actorDelta); event(events, type, 'player', state.player, next); state.player = next; }
  return true;
}
function splashFor(events: ActionEvent[], id: string, from: Vec3, to: Vec3, oldWater: WaterSolution) {
  const cell = waterAt(oldWater, to);
  if (cell && cell.kind !== 'dry' && from.y > cell.level && to.y <= cell.level) event(events, 'splash', id, from, { ...to, y: cell.level }, { deep: cell.kind === 'deep' });
}
function settleGravity(level: LevelDataV2, state: GameState, oldWater: WaterSolution, events: ActionEvent[], splash: boolean): boolean {
  const moving = state.objects.filter(dynamic).sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  for (const o of moving) {
    const from = point(o), floor = supportAt(state.objects, o, o.y, false, new Set([o.id]));
    let y = floor ? top(floor) : -1;
    if (o.kind === 'boat') { const w = boatWater(oldWater, o); if (w?.kind === 'deep') y = Math.max(y, Math.min(o.y, w.level)); }
    if (!inside(level, o) || y < 0) { event(events, 'leave', o.id, from, { ...o, y: -4 }); state.objects = state.objects.filter(b => b.id !== o.id); continue; }
    if (y < o.y) { o.y = y; event(events, 'fall', o.id, from, o); if (splash && o.kind !== 'boat' && floor?.kind !== 'boat') splashFor(events, o.id, from, o, oldWater); event(events, 'land', o.id, o, o); }
    if ((o.kind === 'crate' || o.kind === 'wood') && from.y > o.y && floor?.kind === 'boat' && !floor.cargo?.length && o.y === top(floor)) {
      floor.cargo ??= []; floor.cargo.push({ id: o.id, kind: o.kind }); state.objects = state.objects.filter(b => b.id !== o.id); event(events, 'load', o.id, o, floor);
    }
  }
  const floor = supportAt(state.objects, state.player, state.player.y, true);
  if (!floor || !inside(level, state.player)) return false;
  if (top(floor) < state.player.y) { const from = point(state.player); state.player.y = top(floor); event(events, 'fall', 'player', from, state.player); if (splash) splashFor(events, 'player', from, state.player, oldWater); event(events, 'land', 'player', state.player, state.player); }
  return bodyFree(state.objects, state.player);
}
function balanceSupport(state:GameState,p:Vec3):WorldObject|undefined {
  const excluded=new Set<string>();let current=p;
  for(let i=0;i<34;i++){
    const support=supportAt(state.objects,current,current.y,true,excluded);
    if(!support||top(support)!==current.y)return;
    if(support.kind==='balance-end')return support;
    if(!dynamic(support))return;
    excluded.add(support.id);current=support;
  }
}
function settleBalances(state:GameState,water:WaterSolution,events:ActionEvent[],used:Set<string>):boolean {
  for(const balance of state.objects.filter(o=>o.kind==='balance').sort((a,b)=>a.id.localeCompare(b.id))){
    if(used.has(balance.id))continue;
    const ends=state.objects.filter(o=>o.kind==='balance-end'&&o.balanceId===balance.id);
    const carried=new Map<number,WorldObject[]>([[-1,[]],[1,[]]]),weights={ '-1':0,'1':0 } as Record<string,number>;
    for(const o of state.objects.filter(dynamic)){
      const support=balanceSupport(state,o);if(!support||support.balanceId!==balance.id)continue;
      carried.get(support.balanceSide!)!.push(o);weights[String(support.balanceSide!)]+=1+(o.kind==='boat'?o.cargo?.length??0:0);
    }
    const playerEnd=balanceSupport(state,state.player);
    if(playerEnd?.balanceId===balance.id)weights[String(playerEnd.balanceSide!)]+=1;
    const lift=ends.filter(end=>state.objects.some(o=>{
      if(o.kind!=='boat'||o.x!==end.x||o.z!==end.z||o.y>=end.y)return false;
      const c=boatWater(water,o);return c?.kind==='deep'&&c.level>=end.y;
    })).map(end=>end.balanceSide!);
    const current=state.balanceTilts[balance.id]??0;
    const target=lift.length===2?current:lift.length===1?-lift[0] as -1|1:Math.sign(weights['1']-weights['-1']) as -1|0|1;
    const next=(current+Math.sign(target-current)) as -1|0|1;if(next===current)continue;
    const moved=new Set(ends.flatMap(end=>carried.get(end.balanceSide!)!.map(o=>o.id)));
    const outsiders=state.objects.filter(o=>!moved.has(o.id)&&o.balanceId!==balance.id&&o.id!==balance.id);
    const proposals=ends.map(end=>({end,delta:-end.balanceSide!*(next-current),cargo:carried.get(end.balanceSide!)!}));
    if(proposals.some(({end,delta,cargo})=>{
      if(end.y+delta<0||end.y+delta>32)return true;
      const low=Math.min(end.y,end.y+delta);
      if(delta<0&&outsiders.some(o=>solid(o)&&sameColumn(o,end)&&o.y<end.y&&top(o)>end.y+delta+1e-6))return true;
      if(!bodyFree(outsiders,{...end,y:low},Math.abs(delta)))return true;
      if(cargo.some(o=>!bodyFree(outsiders,{...o,y:o.y+delta},Math.max(.01,height(o)))))return true;
      return playerEnd?.id===end.id&&!bodyFree(outsiders,{...state.player,y:state.player.y+delta});
    }))continue;
    for(const {end,delta,cargo} of proposals){end.y+=delta;
      for(const o of cargo){const from=point(o);o.y+=delta;event(events,'float',o.id,from,o);}
      if(playerEnd?.id===end.id){const from=point(state.player);state.player.y+=delta;event(events,'float','player',from,state.player);}
    }
    state.balanceTilts[balance.id]=next;used.add(balance.id);
    event(events,'balance',balance.id,balance,balance,{fromTilt:current,toTilt:next});
  }
  return true;
}
function floatBoats(state: GameState, water: WaterSolution, events: ActionEvent[]) {
  for (const boat of state.objects.filter(o => o.kind === 'boat').sort((a,b) => a.y-b.y || a.id.localeCompare(b.id))) {
    const group = carriedGroup(state, [boat.id], {x:0,z:0}, false), members = state.objects.filter(o => group.has(o.id));
    const passenger = supportingBoat(state, state.player)?.id === boat.id;
    const c = boatWater(water, boat), floor = supportAt(state.objects, boat, boat.y, false, group), bottom = floor ? top(floor) : boat.y;
    let wanted = Math.max(bottom, c?.kind === 'deep' ? c.level : bottom);
    const outsiders = state.objects.filter(o => !group.has(o.id));
    const tallest = Math.max(...members.map(o => top(o) - boat.y), passenger ? state.player.y + 1 - boat.y : 0);
    // Include the entire vertical sweep, so a thin bridge cannot be skipped.
    for (const obstacle of outsiders) if (sameColumn(boat, obstacle) && (solid(obstacle) || obstacle.kind === 'bridge' || obstacle.kind==='balance-end') && obstacle.y >= boat.y + tallest) wanted = Math.min(wanted, obstacle.y - (obstacle.kind==='balance-end'?Math.max(1,tallest):tallest));
    const delta = wanted - boat.y; if (!delta) continue;
    if (members.some(o => !bodyFree(outsiders, {...o,y:o.y+delta}, Math.max(.001,height(o)))) || passenger && !bodyFree(outsiders,{...state.player,y:state.player.y+delta})) continue;
    for (const o of members) { const from = point(o); o.y += delta; event(events,'float',o.id,from,o); }
    if (passenger) { const from = point(state.player); state.player.y += delta; event(events,'float','player',from,state.player); }
  }
  state.riding = riding(state);
}
export function splashDirection(x: number, z: number): Direction | null { return Math.abs(x) === Math.abs(z) ? null : Math.abs(x) > Math.abs(z) ? x > 0 ? 'east' : 'west' : z > 0 ? 'south' : 'north'; }
function driveBoats(level: LevelDataV2, state: GameState, water: WaterSolution, events: ActionEvent[]) {
  const impulses = new Map<string, { x: number; z: number }>();
  for (const boat of state.objects.filter(o => o.kind === 'boat')) {
    const c = boatWater(water, boat); if (!c || c.kind === 'dry') continue;
    const force = { x: 0, z: 0 };
    for (const e of events.filter(e => e.type === 'splash')) if (Math.abs(boat.x - e.to.x) + Math.abs(boat.z - e.to.z) === 1 && c.level === e.to.y) { const direction=DIRS.find(d=>d.x===boat.x-e.to.x&&d.z===boat.z-e.to.z)!.name; if(blocksEdge(state.objects,e.to,direction,c.level,c.level+.01,true))continue; const strength = Math.max(1, e.from.y - e.to.y); force.x += (boat.x - e.to.x) * strength; force.z += (boat.z - e.to.z) * strength; }
    impulses.set(boat.id, force);
  }
  for (const boat of state.objects.filter(o => impulses.has(o.id)).sort((a,b) => a.id.localeCompare(b.id))) {
    const f = impulses.get(boat.id)!, direction = splashDirection(f.x, f.z); if (!direction) continue;
    const d = dir(direction), initial = boatWater(water, boat)!;
    for (let i = 0; i < Math.max(level.width, level.depth); i++) {
      const next = plus(boat, d), c = waterAt(water, next);
      if (!inside(level, next) || !c || c.kind === 'dry' || c.level !== initial.level || !translate(level, state, new Map([...carriedGroup(state,[boat.id],d,false)].map(id=>[id,d])), water, events, 'slide')) break;
    }
  }
}
function tryWalk(level: LevelDataV2, state: GameState, direction: Direction, water: WaterSolution, events: ActionEvent[]): boolean {
  const d = dir(direction), next = plus(state.player, d); if (!inside(level, next) || blocksEdge(state.objects, state.player, direction)) return false;
  const blockers = state.objects.filter(o => solid(o) && sameColumn(next, o) && o.y < next.y + 1 && (top(o) > next.y || o.kind === 'boat' && o.y === next.y));
  if (blockers.length && blockers.every(dynamic)) {
    const before = clone(state), oldCount = events.length;
    const group = carriedGroup(state, blockers.map(o => o.id), d, true);
    if (!translate(level, state, new Map([...group].map(id => [id, d])), water, events, 'push')) { Object.assign(state, before); events.length = oldCount; }
  }
  // A bridge above the actor is not a climbable destination. Try the lower
  // floor in the same column instead, provided the actor fits below the deck.
  const floor = state.objects.filter(o=>sameColumn(o,next)&&standable(o)&&top(o)<=state.player.y+1)
    .sort((a,b)=>top(b)-top(a)||Number(a.kind==='bridge')-Number(b.kind==='bridge'))
    .find(o=>(o.kind!=='bridge'||top(o)<=state.player.y)&&bodyFree(state.objects,{...next,y:top(o)}));
  if(!floor)return false;
  const y = top(floor), dest = { ...next, y };
  if(y>state.player.y&&blocksEdge(state.objects,state.player,direction,state.player.y,y+1))return false;
  // Cross the boundary at the actor's current height, then land on the far side.
  // Checking the full fall range here would make a lower glass panel block an
  // actor who has already stepped over its top.
  if (!bodyFree(state.objects, dest)) return false;
  const from = point(state.player);
  // Horizontal displacement happens before gravity; fall events retain their real starting height.
  state.player = { ...dest, y: Math.max(y, from.y) };
  event(events, y > from.y ? 'climb' : events.some(e => e.type === 'push') ? 'push' : 'walk', 'player', from, state.player);
  return true;
}
export function facesVoid(level:LevelDataV2,state:GameState,direction:Direction):boolean {
  if(blocksEdge(state.objects,state.player,direction))return false;
  const next=plus(state.player,dir(direction));
  return !inside(level,next)||!state.objects.some(o=>sameColumn(o,next)&&standable(o)&&top(o)<=state.player.y+1&&(o.kind!=='bridge'||top(o)<=state.player.y));
}
export function pullTarget(level:LevelDataV2,state:GameState,direction:Direction):WorldObject|undefined {
  const d=dir(direction);let previous=point(state.player);
  for(let distance=1;distance<=32;distance++){
    const p=plus(state.player,d,distance);if(!inside(level,p)||blocksEdge(state.objects,previous,direction,previous.y,previous.y+1,true))break;
    const at=state.objects.filter(o=>sameColumn(o,p));
    const target=at.find(o=>o.kind==='crate'&&o.y===state.player.y||o.kind==='boat'&&o.y===state.player.y&&o.cargo?.[0]?.kind==='crate');
    if(target)return target;
    if(!bodyFree(state.objects,p))break;
    previous=p;
  }
}
function tryPull(level: LevelDataV2, state: GameState, water: WaterSolution, events: ActionEvent[]): boolean {
  const d = dir(state.facing), target=pullTarget(level,state,state.facing);
  if (!target || target.id!==state.pullTarget) return false;
  const upperCrate = target.kind === 'crate' && !!supportingBoat(state,target,new Set([target.id]));
  const actorBoat = upperCrate ? null : riding(state), targetBoat = target.kind === 'boat' ? target.id : null;
  if (actorBoat && actorBoat === targetBoat) return false;
  const reverse = { x: -d.x, z: -d.z }, moves = new Map<string, { x: number; z: number }>();
  const actorGroup=actorBoat?carriedGroup(state,[actorBoat],d,false):new Set<string>();
  if (actorBoat) for (const id of actorGroup) moves.set(id,d);
  if (targetBoat) for (const id of carriedGroup(state,[targetBoat],reverse,false)) moves.set(id,reverse);
  if (!actorBoat && !targetBoat) for (const id of carriedGroup(state, [target.id], reverse, false)) moves.set(id, reverse);
  const from = point(state.player), targetPosition = { ...point(target), y: target.y };
  const openingBlocks=(p:Vec3,h=1)=>blocksEdge(state.objects,p,state.facing,p.y,p.y+h)&&!blocksEdge(state.objects,p,state.facing,p.y,p.y+h,true);
  const actorBlockedByOpening=!!actorBoat&&(openingBlocks(state.player)||[...actorGroup].some(id=>{const o=state.objects.find(item=>item.id===id)!;return openingBlocks(o,Math.max(.01,height(o)));}));
  if (!translate(level, state, moves, water, events, 'pull')) {
    if(!actorBlockedByOpening)return false;
    const fallback=new Map<string,{x:number;z:number}>(),seed=targetBoat??target.id;
    for(const id of carriedGroup(state,[seed],reverse,false))fallback.set(id,reverse);
    if(!translate(level,state,fallback,water,events,'pull'))return false;
  }
  event(events, 'pull', 'chain', from, state.player, { target: targetPosition, targetId: target.id }); return true;
}
function settle(level: LevelDataV2, state: GameState, oldWater: WaterSolution, events: ActionEvent[], splash: boolean, tilted=new Set<string>()): WaterSolution | null {
  if (!settleGravity(level, state, oldWater, events, splash)) return null;
  let water = solveWater(level, state.objects);
  const seen = new Set<string>(); let stable = false;
  for (let iteration = 0; iteration < 64; iteration++) {
    const before = JSON.stringify(state); if (seen.has(before)) return null; seen.add(before);
    settleBalances(state,water,events,tilted);
    floatBoats(state, water, events);
    if (!settleGravity(level,state,water,events,false)) return null;
    water = solveWater(level,state.objects);
    if (JSON.stringify(state) === before) { stable = true; break; }
  }
  if (!stable) return null;
  if (splash) {
    driveBoats(level, state, water, events);
    // A slide can move ordinary water-blocking cargo. Re-equilibrate without new splashes.
    const after = settle(level,state,water,events,false,tilted); if (!after) return null; water = after;
  }
  state.riding = riding(state); win(state, water);
  if (state.status === 'won' && !events.some(e=>e.type==='win')) event(events, 'win', 'player', state.player, state.player, { direction: water.outlets[0].direction });
  return water;
}
export function initialState(level: LevelDataV2): StepResult {
  const errors = validateV2(level, true); if (errors.length) throw new Error(errors.join('；'));
  const state: GameState = { player: point(level.spawn!), facing: 'south', pullTarget:null, objects: clone(level.objects), balanceTilts:{}, riding: null, turn: 0, status: 'playing' };
  for(const balance of state.objects.filter(o=>o.kind==='balance')){state.balanceTilts[balance.id]=0;state.objects.push(...balanceParts(balance,0));}
  const events: ActionEvent[] = [], old = solveWater(level, state.objects), water = settle(level, state, old, events, false);
  if (!water) throw new Error('主角初始化后没有合法落脚点');
  return { accepted: true, state, water, events: [], message: '庭院已就绪' };
}
export function applyAction(level: LevelDataV2, previous: GameState, command: Command): StepResult {
  const oldWater = solveWater(level, previous.objects), state = clone(previous), events: ActionEvent[] = [];
  const fail = (message: string): StepResult => ({ accepted: false, state: previous, water: oldWater, events: [], message });
  if (command.type === 'turn') { state.facing = command.direction;state.pullTarget=pullTarget(level,state,command.direction)?.id??null; event(events, 'turn', 'player', state.player, state.player); return { accepted: true, state, water: oldWater, events, message: '已转向' }; }
  if (state.status === 'won') return fail('已完成，可撤销或重开');
  if (command.type === 'move') { if(command.direction!==state.facing)state.pullTarget=null;state.facing = command.direction; if (!tryWalk(level, state, command.direction, oldWater, events)) return fail('这里无法通过'); }
  if (command.type === 'pull' && !tryPull(level, state, oldWater, events)) return fail('先朝无遮挡的同高箱子挂上锁链，再按空格拉动');
  state.turn++;
  const water = settle(level, state, oldWater, events, true); if (!water) return fail('整组移动会使主角失去落脚点');
  if(state.pullTarget!==pullTarget(level,state,state.facing)?.id)state.pullTarget=null;
  return { accepted: true, state, water, events, message: (state as GameState).status === 'won' ? '唯一水路，找到归途' : command.type === 'wait' ? '等待一回合，水位保持稳定' : '操作完成' };
}
export class GameSession {
  readonly level: LevelDataV2;
  state: GameState; water: WaterSolution;
  private past: {before:GameState;after:GameState;events:ActionEvent[]}[] = []; private future: typeof this.past = [];
  constructor(level: LevelDataV2) { this.level = clone(level); const start = initialState(this.level); this.state = start.state; this.water = start.water; }
  act(command: Command) { const result = applyAction(this.level, this.state, command); if (result.accepted) { if(command.type!=='turn'){this.past.push({before:clone(this.state),after:clone(result.state),events:clone(result.events)});if (this.past.length > 300) this.past.shift();this.future = [];}this.state = result.state; this.water = result.water; } return result; }
  undo(): StepResult | false { const entry = this.past.pop(); if (!entry) return false; this.future.push(entry); this.state = clone(entry.before); this.water = solveWater(this.level,this.state.objects);
    return {accepted:true,state:this.state,water:this.water,events:entry.events.filter(e=>!['win','splash','drip','land','load'].includes(e.type)).reverse().map(e=>({...e,from:e.to,to:e.from,fromTilt:e.toTilt,toTilt:e.fromTilt,reversed:true})),message:'已撤销'}; }
  redo(): StepResult | false { const entry = this.future.pop(); if (!entry) return false; this.past.push(entry); this.state = clone(entry.after); this.water = solveWater(this.level,this.state.objects); return {accepted:true,state:this.state,water:this.water,events:clone(entry.events),message:'已重做'}; }
  restart() { const start = initialState(this.level); this.state = start.state; this.water = start.water; this.past = []; this.future = []; }
  get canUndo() { return !!this.past.length; } get canRedo() { return !!this.future.length; }
}
export function unsupported(level: LevelDataV2) { return level.objects.filter(o => dynamic(o) && (!supportAt(level.objects, o, o.y, false, new Set([o.id])) || top(supportAt(level.objects, o, o.y, false, new Set([o.id]))!) !== o.y)); }
