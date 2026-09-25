import { top, waterSolid } from './catalog';
import { balanceParts } from './balance';
import { faceKey } from './spatial';
import { DIRS, key } from './types';
import type { Direction, LevelDataV2, Vec3, WaterCell, WaterEdge, WaterSolution, WorldObject } from './types';

interface Link { node: number; sill: number; ceiling: number; direction: Direction }
interface Drain { sill: number; ceiling: number; direction: Direction }
interface Interval extends Vec3 { ceiling: number; supported: boolean; index: number; links: Link[]; drains: Drain[]; head: number }
class MinHeap {
  data: [number, number][] = [];
  push(value: [number, number]) { let i = this.data.length; this.data.push(value); while (i > 0) { const p = (i - 1) >> 1; if (this.data[p][0] <= value[0]) break; this.data[i] = this.data[p]; i = p; } this.data[i] = value; }
  pop() { const first = this.data[0], end = this.data.pop()!; if (this.data.length) { let i = 0; while (i * 2 + 1 < this.data.length) { let c = i * 2 + 1; if (c + 1 < this.data.length && this.data[c + 1][0] < this.data[c][0]) c++; if (this.data[c][0] >= end[0]) break; this.data[i] = this.data[c]; i = c; } this.data[i] = end; } return first; }
}
/** Solid floors create independent air intervals. Bottomless air is a drain, never a spreading surface. */
export function solveWater(level: LevelDataV2, objects: WorldObject[] = level.objects): WaterSolution {
  const columns: Interval[][] = Array.from({ length: level.width * level.depth }, () => []), nodes: Interval[] = [];
  const occupied = new Map<number, Set<number>>(), floors = new Map<number, Set<number>>(), glass = new Set<string>(), openGlass = new Set<string>();
  for (const o of objects) {
    if (waterSolid(o)) { const k = o.z * level.width + o.x; if (!occupied.has(k)) occupied.set(k, new Set()); for (let y = o.y; y < top(o); y++) occupied.get(k)!.add(y); }
    if (o.kind === 'glass' || o.kind === 'stone-fence') glass.add(faceKey(o, o.direction));
    if (o.kind === 'open-glass') openGlass.add(faceKey(o, o.direction));
  }
  // A balance tray is a zero-thickness floor. It divides the air above and
  // below without occupying either height cell or blocking water beneath it.
  const ends = objects.filter(o => o.kind === 'balance-end');
  const expanded = new Set(ends.map(o => o.balanceId));
  for (const root of objects.filter(o => o.kind === 'balance' && !expanded.has(o.id)))
    ends.push(...balanceParts(root, 0).filter(o => o.kind === 'balance-end'));
  for (const end of ends) {
    const k = end.z * level.width + end.x;
    if (end.x < 0 || end.z < 0 || end.x >= level.width || end.z >= level.depth || end.y < 0 || end.y > 32) continue;
    if (!floors.has(k)) floors.set(k, new Set());
    floors.get(k)!.add(end.y);
  }
  for (let z = 0; z < level.depth; z++) for (let x = 0; x < level.width; x++) {
    const col = columns[z * level.width + x], occ = occupied.get(z * level.width + x) ?? new Set<number>(), plates = floors.get(z * level.width + x) ?? new Set<number>();
    let floor = 0, supported = false;
    for (let y = 0; y <= 32; y++) {
      if (y === 32 || occ.has(y) || plates.has(y)) {
        if (y > floor || y === 32 && floor === 32 && !plates.has(32)) { const n: Interval = { x, y: floor, z, ceiling: y === 32 ? 36 : y, supported, index: nodes.length, links: [], drains: [], head: Infinity }; col.push(n); nodes.push(n); }
        if (occ.has(y)) floor = y + 1;
        else if (plates.has(y)) floor = y;
        supported = supported || occ.has(y) || plates.has(y);
      }
    }
    if (plates.has(32) && floor === 32) { const n: Interval = { x, y: 32, z, ceiling: 36, supported: true, index: nodes.length, links: [], drains: [], head: Infinity }; col.push(n); nodes.push(n); }
  }
  const firstOpening = (n: Interval, direction: Direction, low: number, high: number) => { let y = low; while (y < high && glass.has(faceKey({ ...n, y }, direction))) y++; return y < high ? y : Infinity; };
  for (const n of nodes) if (n.supported) for (const d of DIRS) {
    const x = n.x + d.x, z = n.z + d.z;
    if (x < 0 || z < 0 || x >= level.width || z >= level.depth) { const sill = firstOpening(n, d.name, n.y, n.ceiling); if (isFinite(sill)) n.drains.push({ sill, ceiling: n.ceiling, direction: d.name }); continue; }
    for (const b of columns[z * level.width + x]) {
      const ceiling = Math.min(n.ceiling, b.ceiling), sill = firstOpening(n, d.name, Math.max(n.y, b.y), ceiling);
      if (!isFinite(sill)) continue;
      if (b.supported) n.links.push({ node: b.index, sill, ceiling, direction: d.name });
      else n.drains.push({ sill, ceiling, direction: d.name });
    }
  }
  const heap = new MinHeap();
  for (const n of nodes) if (n.supported && n.drains.length) { n.head = Math.min(...n.drains.map(d => d.sill)); heap.push([n.head, n.index]); }
  while (heap.data.length) {
    const [head, id] = heap.pop(), a = nodes[id]; if (a.head !== head) continue;
    for (const link of a.links) { const b = nodes[link.node], candidate = Math.max(head, link.sill, b.y); if (candidate < b.head) { b.head = candidate; heap.push([candidate, b.index]); } }
  }
  const wet = new Set<number>();
  const sourceNode = level.source ? columns[level.source.z * level.width + level.source.x]?.filter(n => n.supported).at(-1) : undefined;
  if (sourceNode && isFinite(sourceNode.head)) {
    const queue = [sourceNode.index]; wet.add(sourceNode.index);
    for (let i = 0; i < queue.length; i++) { const a = nodes[queue[i]]; for (const edge of a.links) { const b = nodes[edge.node]; if (!wet.has(b.index) && edge.sill <= a.head && b.head <= a.head) { wet.add(b.index); queue.push(b.index); } } }
  }
  const cells: WaterCell[] = nodes.filter(n => n.supported).map(n => {
    const active = wet.has(n.index), level = active ? Math.min(n.head, n.ceiling) : n.y;
    return { id: key(n), x: n.x, y: n.y, z: n.z, ceiling: n.ceiling, level, head: active ? n.head : n.y, depth: level - n.y, kind: !active ? 'dry' : level > n.y ? 'deep' : 'sheet', surface: level < n.ceiling };
  });
  const falls: WaterEdge[] = [], outlets: WaterEdge[] = [], emitted = new Set<string>();
  for (const n of nodes) if (wet.has(n.index)) {
    for (const edge of n.drains) if (edge.sill <= n.head) {
      const id = `${key(n)}:${edge.direction}:outlet`; if (emitted.has(id)) continue; emitted.add(id);
      const from = Math.min(n.head, edge.ceiling);
      let canFinish = true;
      for (let y = n.y; y <= from; y++) if (openGlass.has(faceKey({ ...n, y }, edge.direction))) { canFinish = false; break; }
      outlets.push({ id, cellId: key(n), x: n.x, y: n.y, z: n.z, direction: edge.direction, from, to: from - 4, kind: 'outlet', canFinish });
    }
    for (const edge of n.links) { const b = nodes[edge.node]; if (wet.has(b.index) && edge.sill <= n.head && b.head < n.head) {
      const from = Math.min(n.head, edge.ceiling), to = Math.max(b.y, Math.min(b.head, b.ceiling));
      if (from > to) falls.push({ id: `${key(n)}:${edge.direction}:${key(b)}`, cellId: key(n), x: n.x, y: n.y, z: n.z, direction: edge.direction, from, to, kind: 'fall' });
    } }
  }
  return { cells, falls, outlets, sourceLanding: sourceNode ? { x: sourceNode.x, y: Math.min(sourceNode.head, sourceNode.ceiling), z: sourceNode.z } : null };
}
export function waterAt(water: WaterSolution, p: Vec3): WaterCell | undefined { return water.cells.find(c => c.x === p.x && c.z === p.z && c.y <= p.y && p.y < c.ceiling); }
