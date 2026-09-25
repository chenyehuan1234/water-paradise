import { validateLevel } from '../core/level';
import type { LevelDataV1 } from '../core/types';
import { catalog, edgePanel, height, solid, top } from './catalog';
import { bodyFree, faceKey, inside, placementError, supportAt } from './spatial';
import { DIRS, clone, uid } from './types';
import type { LevelDataV2, Vec3, WorldObject } from './types';

export function newLevel(name = '未命名庭院', width = 12, depth = 12): LevelDataV2 {
  return { version: 2, id: uid('level'), name, width, depth, objects: [], source: null, spawn: null };
}
export function migrateV1(old: LevelDataV1, id = uid('migrated')): LevelDataV2 {
  const level: LevelDataV2 = { ...newLevel(old.name, old.width, old.depth), id };
  old.terrain.forEach((row, z) => row.forEach((h, x) => { if (h !== null) for (let y = 0; y <= h; y++) level.objects.push({ id: `stone-${x}-${y}-${z}`, kind: 'stone', x, y, z, direction: 'north' }); }));
  const lift = (p: { x: number; z: number } | null): Vec3 | null => p ? { ...p, y: (old.terrain[p.z][p.x] ?? 0) + 1 } : null;
  level.spawn = lift(old.spawn); level.source = lift(old.source);
  for (const b of old.boxes) level.objects.push({ ...lift(b)!, id: b.id, kind: 'crate', direction: 'north' });
  for (const d of old.decorations) level.objects.push({ ...lift(d)!, id: d.id, kind: d.kind, direction: 'north' });
  return level;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, low: number, high: number) => Number.isInteger(v) && (v as number) >= low && (v as number) <= high;
export function validateV2(value: unknown, playable = false): string[] {
  if (!record(value)) return ['关卡必须是一个对象'];
  const errors: string[] = [];
  if (value.version !== 2) errors.push('不支持的关卡版本');
  if (typeof value.id !== 'string' || !value.id || value.id.length > 160) errors.push('缺少有效的关卡 ID');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120) errors.push('名称需要 1–120 个字符');
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 3000)) errors.push('说明需要为 3000 字以内的文本');
  if (!integer(value.width, 4, 32) || !integer(value.depth, 4, 32)) errors.push('宽、深必须为 4–32 格');
  const pos = (p: unknown): p is Vec3 => record(p) && integer(p.x, 0, Number(value.width) - 1) && integer(p.z, 0, Number(value.depth) - 1) && integer(p.y, 0, 32);
  for (const k of ['source', 'spawn']) if (value[k] !== null && !pos(value[k])) errors.push(`${k === 'source' ? '水源' : '出生点'}坐标无效`);
  if (!Array.isArray(value.objects) || value.objects.length > 50000) return [...errors, '物件列表无效或超过 50000 个'];
  const ids = new Set<string>(), cells = new Set<string>(), faces = new Set<string>(), planes = new Set<string>();
  for (const raw of value.objects) {
    if (!record(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.kind !== 'string' || !Object.hasOwn(catalog, raw.kind) || raw.kind.startsWith('balance-') || !pos(raw) || !DIRS.some(d => d.name === raw.direction)) { errors.push('存在无效的物件 ID、类型、方向或坐标'); break; }
    const o = raw as unknown as WorldObject;
    if (ids.has(o.id)) { errors.push(`物件 ID 重复：${o.id}`); break; } ids.add(o.id);
    if (o.y + height(o) > 32) errors.push(`物件 ${o.id} 超过 32 层`);
    if (o.cargo !== undefined) {
      if (o.kind !== 'boat' || !Array.isArray(o.cargo) || o.cargo.some(c => !record(c) || typeof c.id !== 'string' || !c.id || !['wood', 'crate'].includes(c.kind as string))) errors.push('船上载荷数据无效');
      else for(const cargo of o.cargo){if(ids.has(cargo.id))errors.push(`载荷 ID 重复：${cargo.id}`);ids.add(cargo.id);}
    }
    if (edgePanel(o)) { const k = faceKey(o, o.direction); if (faces.has(k)) errors.push('边界栏板重复'); faces.add(k); }
    if (o.kind === 'bridge') { const k = `${o.x},${o.y},${o.z}`; if (planes.has(k)) errors.push('桥板重复'); planes.add(k); }
    if (solid(o)) for (let y = o.y; y < top(o); y++) { const k = `${o.x},${y},${o.z}`; if (cells.has(k)) errors.push('实体物件重叠'); cells.add(k); }
    if (errors.length > 12) break;
  }
  if (!errors.length) {
    const l = value as unknown as LevelDataV2;
    for(const balance of l.objects.filter(o=>o.kind==='balance')){const error=placementError({...l,objects:l.objects.filter(o=>o.id!==balance.id)},balance);if(error)errors.push(`天平 ${balance.id}：${error}`);}
    if (l.objects.some(o => o.kind === 'bridge' && l.objects.some(s => solid(s) && s.x === o.x && s.z === o.z && s.y < o.y && top(s) > o.y))) errors.push('桥板穿过实体');
    if (l.spawn && !bodyFree(l.objects, l.spawn)) errors.push('出生点与实体重叠');
    if (playable) {
      if (!l.source) errors.push('请设置唯一水源');
      if (!l.spawn) errors.push('请设置主角出生点');
      else if (!supportAt(l.objects, l.spawn, l.spawn.y, true)) errors.push('出生点下方没有可站立的承载面');
      if (l.source && !l.objects.some(o => inside(l, o) && o.x === l.source!.x && o.z === l.source!.z && solid(o) && o.kind !== 'boat')) errors.push('水源下方没有承接实体');
    }
  }
  return [...new Set(errors)];
}
export function parseLevel(value: unknown): LevelDataV2 {
  if (record(value) && value.version === 1) {
    const errors = validateLevel(value); if (errors.length) throw new Error(errors.join('；'));
    return migrateV1(value as unknown as LevelDataV1);
  }
  const errors = validateV2(value); if (errors.length) throw new Error(errors.join('；'));
  const level = clone(value as LevelDataV2);
  // Older saves merged every load. Keep the first bound; restore the rest with their identities.
  for (const boat of [...level.objects]) if (boat.kind === 'boat' && (boat.cargo?.length ?? 0) > 1) {
    const extra = boat.cargo!.slice(1); boat.cargo = boat.cargo!.slice(0,1);
    extra.forEach((cargo,i) => level.objects.push({...cargo,x:boat.x,y:boat.y+1+i,z:boat.z,direction:boat.direction}));
  }
  const migratedErrors = validateV2(level); if (migratedErrors.length) throw new Error('旧载荷恢复失败：'+migratedErrors.join('；'));
  return level;
}
export function readJSON(text: string): unknown { if (text.length > 20_000_000) throw new Error('文件超过 20 MB'); return JSON.parse(text); }
