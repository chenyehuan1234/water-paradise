import { describe, expect, it } from 'vitest';
import { examples } from '../../src/core/examples';
import { solveWater as oldSolve } from '../../src/core/water';
import { migrateV1, newLevel, validateV2 } from '../../src/world/level';
import { solveWater, waterAt } from '../../src/world/water';
import { GameSession, applyAction, initialState, splashDirection } from '../../src/world/game';
import { exampleProject, floor, object } from '../../src/world/examples';
import { StackingEditor } from '../../src/workshop/editor';
import { clone, defaults } from '../../src/world/types';
import { importProject, removeLevel, recover } from '../../src/workshop/project';

function board() { const l = newLevel('试验', 8, 8); floor(l); l.spawn = { x: 2, y: 1, z: 6 }; l.source = { x: 0, y: 1, z: 0 }; return l; }
describe('三维水路', () => {
  for(const id of ['rising','isolation'])it(`迁移后 ${id} 的升水、隔离与撤销仍一致`,()=>{
    const example=examples.find(e=>e.id===id)!,l=migrateV1(example.level),session=new GameSession(l),before=clone(session.water);session.act({type:'move',direction:'south'});
    const legacyBoxes=example.level.boxes.map(b=>({...b,z:b.z+1})),old=oldSolve(example.level,legacyBoxes);
    for(const row of old.cells)for(const c of row)if(c){const cell=session.water.cells.find(v=>v.x===c.x&&v.z===c.z)!;expect(cell.depth).toBe(c.depth);expect(cell.kind).toBe(c.kind);expect(cell.level).toBe(c.level+1);}
    session.undo();expect(session.water).toEqual(before);session.redo();expect(session.water.outlets.length).toBe(old.outlets.length);
  });
  for (const e of examples) it(`迁移保持 ${e.title} 的水位与出口`, () => {
    const a = oldSolve(e.level, e.level.boxes), l = migrateV1(e.level), b = solveWater(l);
    expect(b.outlets.length).toBe(a.outlets.length);
    for (const row of a.cells) for (const cell of row) if (cell) { const current = b.cells.find(c => c.x === cell.x && c.z === cell.z)!; expect(current.kind).toBe(cell.kind); expect(current.depth).toBe(cell.depth); expect(current.level).toBe(cell.level + 1); }
  });
  it('桥下流水与上层水域不会压成最高地表', () => {
    const l = board(); object(l, 'floating', 2, 3, 2); object(l, 'bridge', 3, 3, 2);
    const w = solveWater(l); expect(w.cells.filter(c => c.x === 2 && c.z === 2).length).toBe(2); expect(waterAt(w, { x: 2, y: 1, z: 2 })?.kind).toBe('sheet'); expect(waterAt(w, { x: 2, y: 4, z: 2 })?.kind).toBe('dry'); expect(waterAt(w, { x: 3, y: 1, z: 2 })?.kind).toBe('sheet');
  });
  it('玻璃在边界阻水，开口玻璃透水', () => {
    const l = board(); for (let z = 0; z < 8; z++) object(l, 'glass', 2, 1, z, { direction: 'east' });
    expect(waterAt(solveWater(l), { x: 4, y: 1, z: 4 })?.kind).toBe('dry'); l.objects.filter(o => o.kind === 'glass').forEach(o => o.kind = 'open-glass'); expect(waterAt(solveWater(l), { x: 4, y: 1, z: 4 })?.kind).toBe('sheet');
  });
  it('船与载荷不会改变水流', () => { const l = board(), before = solveWater(l); object(l, 'boat', 3, 1, 3, { cargo: [{ id: 'c', kind: 'crate' }] }); expect(solveWater(l)).toEqual(before); });
  it('底部虚空是出口而不是无支撑水面', () => { const l = newLevel('悬空', 4, 4); object(l, 'floating', 1, 5, 1); l.source = { x: 1, y: 6, z: 1 }; const w = solveWater(l); expect(w.cells.filter(c => c.kind !== 'dry')).toHaveLength(1); expect(w.outlets).toHaveLength(4); expect(w.outlets.every(e => e.from - e.to === 4)).toBe(true); });
});
describe('三维动作', () => {
  it('示例全部可进入试玩，两个综合路线有效', () => {
    const p = exampleProject();
    for (const l of Object.values(p.levels)) { expect(validateV2(l, true), l.name).toEqual([]); const s = new GameSession(l); if (l.route) { for (const cmd of l.route) expect(s.act(cmd).accepted, `${l.name}: ${JSON.stringify(cmd)}`).toBe(true); expect(s.state.status, l.name).toBe('won'); } }
  });
  it('整列及上方堆叠整体移动，阻挡时不部分提交', () => {
    const l = board(); object(l, 'crate', 2, 1, 5); object(l, 'wood', 2, 2, 5); object(l, 'crate', 2, 1, 4); const s = new GameSession(l); expect(s.act({ type: 'move', direction: 'north' }).accepted).toBe(true); expect(s.state.objects.filter(o => ['wood', 'crate'].includes(o.kind)).map(o => o.z)).toEqual([4,4,3]);
    object(l, 'stone', 2, 1, 3); object(l, 'stone', 2, 3, 5); const blocked = new GameSession(l), before = clone(blocked.state); blocked.act({ type: 'move', direction: 'north' }); expect(blocked.state.objects).toEqual(before.objects);
  });
  it('可以爬箱子但不能直接爬高一格铁架', () => { const l = board(); object(l, 'bridge', 2, 2, 5); const s = new GameSession(l); expect(s.act({ type: 'move', direction: 'north' }).accepted).toBe(false); });
  it('主角不能走进无底虚空，物件可以离场且撤销恢复', () => { const l = board(); l.objects = l.objects.filter(o => !(o.x === 2 && o.z < 5)); object(l, 'crate', 2, 1, 5); const s = new GameSession(l); s.act({ type: 'move', direction: 'north' }); expect(s.state.objects.some(o => o.kind === 'crate')).toBe(false); expect(s.act({ type: 'move', direction: 'north' }).accepted).toBe(false); s.undo(); expect(s.state.objects.some(o => o.kind === 'crate')).toBe(true); });
  it('原地转向不耗回合，X 只能拉取箱子，且水流不受玩家影响', () => { const l = board(); object(l, 'crate', 2, 1, 3); const s = new GameSession(l), w = clone(s.water); s.act({ type: 'turn', direction: 'north' }); expect(s.state.turn).toBe(0); expect(s.act({ type: 'pull' }).accepted).toBe(true); expect(s.state.objects.find(o => o.kind === 'crate')?.z).toBe(4); s.undo(); expect(s.water).toEqual(w); s.redo(); expect(s.state.turn).toBe(1); });
  it('合力平局不驱船，反方向抵消', () => { expect(splashDirection(0,0)).toBe(null); expect(splashDirection(2,2)).toBe(null); expect(splashDirection(-3,1)).toBe('west'); });
  it('相同指令序列与回放结果完全相同', () => { const l = exampleProject().levels['validation-pull']; const a = new GameSession(l), b = new GameSession(l); for (const cmd of l.route!) { a.act(cmd); b.act(cmd); } expect(a.state).toEqual(b.state); const end = clone(a.state); a.undo(); a.redo(); expect(a.state).toEqual(end); expect(applyAction(l, initialState(l).state, { type: 'wait' }).water).toEqual(initialState(l).water); });
});
describe('堆叠编辑与数据', () => {
  it('同一笔不叠高，整笔一次撤销', () => { const e = new StackingEditor(newLevel()); const pick = { position: { x: 3, y: 0, z: 3 }, normal: { x: 0, y: 1, z: 0 } }; e.begin(false, pick); e.paint(pick); e.paint(pick); e.paint({ ...pick, position: { ...pick.position, x: 4 } }); e.end(); expect(e.level.objects).toHaveLength(2); e.undo(); expect(e.level.objects).toHaveLength(0); e.redo(); expect(e.level.objects).toHaveLength(2); });
  it('实体命中按面放置，虚空使用放置层，矩形固定在起笔面', () => { const l = newLevel(); object(l, 'stone', 1, 0, 1); const e = new StackingEditor(l, { ...defaults(), layer: 6 }); const pick = { id: l.objects[0].id, position: { x: 1, y: 0, z: 1 }, normal: { x: 0, y: 1, z: 0 } }; expect(e.preview(pick).position.y).toBe(1); e.begin(false, pick); e.rectangle({ x: 3, y: 9, z: 3 }); e.end(); expect(e.level.objects.filter(o => o.y === 1)).toHaveLength(9); });
  it('导入失败与试玩不修改编辑稿，删除可恢复', () => { const p = exampleProject(), copy = clone(p), editor = new StackingEditor(p.levels[p.active]); expect(() => importProject(p, '{broken')).toThrow(); expect(p).toEqual(copy); const s = new GameSession(editor.level); s.act({ type: 'move', direction: 'south' }); expect(editor.level).toEqual(copy.levels[p.active]); const id = p.active; removeLevel(p, id); recover(p, p.trash.at(-1)!.id); expect(p.levels[id]).toEqual(copy.levels[id]); });
});
