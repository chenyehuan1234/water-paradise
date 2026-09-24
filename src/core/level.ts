import { groundAt, sameCell } from './types';
import type { Cell, LevelDataV1 } from './types';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;

/** Shape validation also accepts intentionally incomplete editor drafts. */
export function validateLevel(value: unknown): string[] {
  if (!record(value)) return ['关卡必须是一个 JSON 对象。'];
  const errors: string[] = [];
  if (value.version !== 1) errors.push('仅支持 version: 1 的关卡。');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 60) errors.push('关卡名称需要 1–60 个字符。');
  if (!integer(value.width, 4, 32) || !integer(value.depth, 4, 32)) return [...errors, '地图宽度和长度必须是 4–32 的整数。'];
  const width = value.width, depth = value.depth;
  if (!Array.isArray(value.terrain) || value.terrain.length !== depth || value.terrain.some(row => !Array.isArray(row) || row.length !== width || row.some(h => h !== null && !integer(h, 0, 12)))) errors.push('地形必须与地图尺寸一致，高度为 0–12 的整数或 null（虚空）。');
  const isCell = (cell: unknown): cell is Cell => record(cell) && integer(cell.x, 0, width - 1) && integer(cell.z, 0, depth - 1);
  const solid = (cell: Cell) => Array.isArray(value.terrain) && Array.isArray(value.terrain[cell.z]) && typeof value.terrain[cell.z][cell.x] === 'number';
  for (const [field, label] of [['source', '水源'], ['spawn', '出生点']] as const) {
    const cell = value[field];
    if (cell !== null && (!isCell(cell) || !solid(cell))) errors.push(`${label}必须位于地图中的实体地面上，或设为 null。`);
  }
  if (!Array.isArray(value.boxes) || value.boxes.length > width * depth) errors.push('箱子列表无效。');
  else {
    const ids = new Set<string>(), cells = new Set<string>();
    value.boxes.forEach((box, index) => {
      if (!record(box) || typeof box.id !== 'string' || !box.id || box.id.length > 80 || !isCell(box) || !solid(box)) { errors.push(`箱子 ${index + 1} 的 ID 或位置无效。`); return; }
      const key = `${box.x},${box.z}`;
      if (ids.has(box.id) || cells.has(key)) errors.push(`箱子 ${index + 1} 与其他箱子的 ID 或位置重复。`);
      ids.add(box.id); cells.add(key);
      if (isCell(value.spawn) && sameCell(box, value.spawn)) errors.push('出生点不能与箱子重叠。');
    });
  }
  if (!Array.isArray(value.decorations) || value.decorations.length > width * depth) errors.push('装饰列表无效。');
  else {
    const ids = new Set<string>();
    value.decorations.forEach((item, index) => {
      if (!record(item) || typeof item.id !== 'string' || !item.id || item.id.length > 80 || !isCell(item) || !solid(item) || !['plant', 'arch'].includes(String(item.kind))) errors.push(`装饰 ${index + 1} 无效。`);
      else { if (ids.has(item.id)) errors.push(`装饰 ${index + 1} 的 ID 重复。`); ids.add(item.id); }
    });
  }
  return errors;
}

export function validatePlayable(level: LevelDataV1): string[] {
  const errors = validateLevel(level);
  if (!level.source) errors.push('请放置一个水源。');
  if (!level.spawn) errors.push('请放置主角出生点。');
  return errors;
}

export function parseLevel(text: string): LevelDataV1 {
  if (text.length > 1_000_000) throw new Error('关卡文件过大，请使用小于 1 MB 的 JSON 文件。');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON，请检查格式。'); }
  const errors = validateLevel(value);
  if (errors.length) throw new Error(errors.join('\n'));
  const level = value as LevelDataV1;
  // Rebuild only the public schema, excluding extra imported fields.
  return {
    version: 1, name: level.name, width: level.width, depth: level.depth,
    terrain: level.terrain.map(row => [...row]), source: level.source ? { x: level.source.x, z: level.source.z } : null,
    spawn: level.spawn ? { x: level.spawn.x, z: level.spawn.z } : null,
    boxes: level.boxes.map(({ id, x, z }) => ({ id, x, z })),
    decorations: level.decorations.map(({ id, x, z, kind }) => ({ id, x, z, kind })),
  };
}

export function serializeLevel(level: LevelDataV1): string { return JSON.stringify(level, null, 2); }
export function createLevel(width = 12, depth = 12): LevelDataV1 {
  if (!integer(width, 4, 32) || !integer(depth, 4, 32)) throw new Error('地图尺寸必须是 4–32 的整数。');
  return { version: 1, name: '未命名的水庭院', width, depth, terrain: Array.from({ length: depth }, () => Array<number | null>(width).fill(0)), source: null, spawn: null, boxes: [], decorations: [] };
}

export function cleanCellOccupants(level: LevelDataV1, cell: Cell) {
  if (groundAt(level, cell) !== null) return;
  if (sameCell(level.source, cell)) level.source = null;
  if (sameCell(level.spawn, cell)) level.spawn = null;
  level.boxes = level.boxes.filter(box => !sameCell(box, cell));
  level.decorations = level.decorations.filter(item => !sameCell(item, cell));
}
