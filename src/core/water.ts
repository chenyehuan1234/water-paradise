import { DIRECTIONS } from './types';
import type { Box, LevelDataV1, WaterCell, WaterEdge, WaterSolution } from './types';

/** Stable binary min-heap: elevation first, cell index second. */
class MinHeap {
  private items: { id: number; height: number }[] = [];
  private before(a: { id: number; height: number }, b: { id: number; height: number }) { return a.height < b.height || (a.height === b.height && a.id < b.id); }
  push(id: number, height: number) {
    const item = { id, height }; let i = this.items.length; this.items.push(item);
    while (i > 0) { const parent = (i - 1) >> 1; if (!this.before(item, this.items[parent])) break; this.items[i] = this.items[parent]; i = parent; }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (!first || !last) return undefined;
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.items.length && this.before(this.items[child + 1], this.items[child])) child++;
        if (!this.before(this.items[child], last)) break;
        this.items[i] = this.items[child]; i = child;
      }
      this.items[i] = last;
    }
    return first;
  }
}

/** Integer, source-connected equilibrium. No Three.js, wall clock, or prior water. */
export function solveWater(level: LevelDataV1, boxes: readonly Box[] = level.boxes): WaterSolution {
  const { width, depth } = level, count = width * depth;
  const ground = new Float64Array(count).fill(NaN);
  const spill = new Float64Array(count).fill(Infinity);
  const heap = new MinHeap();
  const index = (x: number, z: number) => z * width + x;
  const inBounds = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth;
  const isVoid = (x: number, z: number) => !inBounds(x, z) || Number.isNaN(ground[index(x, z)]);
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) if (level.terrain[z][x] !== null) ground[index(x, z)] = level.terrain[z][x]!;
  for (const box of boxes) if (inBounds(box.x, box.z) && !isVoid(box.x, box.z)) ground[index(box.x, box.z)]++;
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
    if (!isVoid(x, z) && DIRECTIONS.some(d => isVoid(x + d.x, z + d.z))) {
      const id = index(x, z); spill[id] = ground[id]; heap.push(id, ground[id]);
    }
  }
  // Minimax Dijkstra: a cell's level is the lowest maximum sill on any route out.
  for (let item = heap.pop(); item; item = heap.pop()) {
    if (item.height !== spill[item.id]) continue;
    const x = item.id % width, z = Math.floor(item.id / width);
    for (const dir of DIRECTIONS) {
      const nx = x + dir.x, nz = z + dir.z;
      if (isVoid(nx, nz)) continue;
      const next = index(nx, nz), candidate = Math.max(item.height, ground[next]);
      if (candidate < spill[next]) { spill[next] = candidate; heap.push(next, candidate); }
    }
  }
  const wet = new Uint8Array(count), queue: number[] = [];
  if (level.source && !isVoid(level.source.x, level.source.z)) { const id = index(level.source.x, level.source.z); queue.push(id); wet[id] = 1; }
  for (let read = 0; read < queue.length; read++) {
    const id = queue[read], x = id % width, z = Math.floor(id / width);
    for (const dir of DIRECTIONS) {
      const nx = x + dir.x, nz = z + dir.z;
      if (isVoid(nx, nz)) continue;
      const next = index(nx, nz);
      if (!wet[next] && spill[next] <= spill[id]) { wet[next] = 1; queue.push(next); }
    }
  }
  const cells: (WaterCell | null)[][] = Array.from({ length: depth }, () => Array(width).fill(null));
  const falls: WaterEdge[] = [], outlets: WaterEdge[] = [];
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
    if (isVoid(x, z)) continue;
    const id = index(x, z), h = ground[id], height = wet[id] ? spill[id] : h;
    cells[z][x] = { x, z, ground: h, level: height, depth: height - h, kind: !wet[id] ? 'dry' : height === h ? 'sheet' : 'deep' };
    if (!wet[id]) continue;
    for (const dir of DIRECTIONS) {
      const nx = x + dir.x, nz = z + dir.z, edgeId = `${x},${z}:${dir.name}`;
      if (isVoid(nx, nz)) outlets.push({ id: edgeId, x, z, direction: dir.name, from: height, to: height - 4, kind: 'outlet' });
      else if (wet[index(nx, nz)] && spill[index(nx, nz)] < height) falls.push({ id: edgeId, x, z, direction: dir.name, from: height, to: spill[index(nx, nz)], kind: 'fall' });
    }
  }
  return { cells, falls, outlets };
}
