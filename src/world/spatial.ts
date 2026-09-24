import { glass, height, solid, standable, top } from './catalog';
import { dir, opposite, sameColumn } from './types';
import type { Direction, LevelDataV2, Vec3, WorldObject } from './types';
export const inside = (level: Pick<LevelDataV2, 'width' | 'depth'>, p: Vec3) => p.x >= 0 && p.z >= 0 && p.x < level.width && p.z < level.depth;
export function faceKey(p: Vec3, direction: Direction): string {
  const d = dir(direction);
  return direction === 'west' || direction === 'north' ? `${p.x + d.x},${p.y},${p.z + d.z}:${opposite(direction)}` : `${p.x},${p.y},${p.z}:${direction}`;
}
export function blocksEdge(objects: WorldObject[], p: Vec3, direction: Direction, low = p.y, high = p.y + 1, water = false) {
  const q = { ...p, ...{ x: p.x + dir(direction).x, z: p.z + dir(direction).z } };
  return objects.some(o => glass(o) && (!water || o.kind === 'glass') && o.y < high && o.y + 1 > low &&
    ((sameColumn(o, p) && o.direction === direction) || (sameColumn(o, q) && o.direction === opposite(direction))));
}
export function bodyFree(objects: WorldObject[], p: Vec3, h = 1, exclude = new Set<string>(), actor = false) {
  return !objects.some(o => !exclude.has(o.id) && sameColumn(o, p) && (solid(o) ? o.y < p.y + h - 1e-6 && top(o) > p.y + 1e-6 : o.kind === 'bridge' && o.y > p.y + 1e-6 && o.y < p.y + h - 1e-6)) && (!actor || p.y >= 0);
}
export function supportAt(objects: WorldObject[], p: Vec3, limit = p.y, actor = false, exclude = new Set<string>()) {
  let best: WorldObject | undefined;
  for (const o of objects) if (!exclude.has(o.id) && sameColumn(o, p) && (actor ? standable(o) : solid(o) || o.kind === 'bridge') && top(o) <= limit + 1e-6 && (!best || top(o) > top(best) || top(o) === top(best) && o.kind === 'boat')) best = o;
  return best;
}
export function placementError(level: LevelDataV2, candidate: WorldObject): string | null {
  if (!inside(level, candidate) || candidate.y < 0 || candidate.y + height(candidate) > 32) return '超出地图或 32 层范围';
  if (glass(candidate)) {
    if (level.objects.some(o => glass(o) && faceKey(o, o.direction) === faceKey(candidate, candidate.direction))) return '这条边已有玻璃';
  } else if (solid(candidate)) {
    if (candidate.kind === 'boat' && level.objects.some(o => o.kind === 'boat' && sameColumn(o, candidate) && o.y === candidate.y)) return '这里已有浮船';
    if (!bodyFree(level.objects, candidate, height(candidate))) return '这里已有物件';
    if (level.spawn && sameColumn(candidate, level.spawn) && candidate.y < level.spawn.y + 1 && top(candidate) > level.spawn.y) return '不能覆盖出生点';
  } else if (candidate.kind === 'bridge') {
    if (level.objects.some(o => sameColumn(candidate, o) && (o.kind === 'bridge' && o.y === candidate.y || solid(o) && o.y < candidate.y && top(o) > candidate.y))) return '承载面与已有物件重叠';
  } else if (level.objects.some(o => o.kind === candidate.kind && sameColumn(o, candidate) && o.y === candidate.y)) return '这里已有相同装饰';
  return null;
}
