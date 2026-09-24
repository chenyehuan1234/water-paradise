import { cleanCellOccupants, createLevel, parseLevel, serializeLevel } from '../core/level';
import { cellKey, cloneLevel, groundAt, sameCell } from '../core/types';
import type { Cell, LevelDataV1 } from '../core/types';

export type EditorTool = 'height' | 'raise' | 'lower' | 'void' | 'box' | 'remove-box' | 'spawn' | 'source' | 'plant' | 'arch' | 'remove-decoration';
export const DRAFT_KEY = 'water-paradise:editor:v1';

export class EditorSession {
  level: LevelDataV1;
  tool: EditorTool = 'height';
  brushHeight = 1;
  selected: Cell | null = null;
  private past: LevelDataV1[] = [];
  private future: LevelDataV1[] = [];
  private strokeStart: LevelDataV1 | null = null;
  private visited = new Set<string>();
  constructor(level: LevelDataV1 = createLevel()) { this.level = cloneLevel(level); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get inStroke() { return this.strokeStart !== null; }
  beginStroke() { this.commitStroke(); this.strokeStart = cloneLevel(this.level); this.visited.clear(); }
  paint(cell: Cell): boolean {
    if (cell.x < 0 || cell.z < 0 || cell.x >= this.level.width || cell.z >= this.level.depth || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) return false;
    this.selected = { ...cell };
    if (!this.strokeStart) this.beginStroke();
    const key = cellKey(cell);
    if (this.visited.has(key)) return false;
    this.visited.add(key);
    const before = serializeLevel(this.level), h = groundAt(this.level, cell), { x, z } = cell;
    if (this.tool === 'height') this.level.terrain[z][x] = this.brushHeight;
    else if (this.tool === 'raise') this.level.terrain[z][x] = Math.min(12, (h ?? -1) + 1);
    else if (this.tool === 'lower') this.level.terrain[z][x] = h === null ? null : Math.max(0, h - 1);
    else if (this.tool === 'void') { this.level.terrain[z][x] = null; cleanCellOccupants(this.level, cell); }
    else if (this.tool === 'remove-box') this.level.boxes = this.level.boxes.filter(box => !sameCell(box, cell));
    else if (this.tool === 'remove-decoration') this.level.decorations = this.level.decorations.filter(item => !sameCell(item, cell));
    else if (h !== null) {
      if (this.tool === 'source') this.level.source = { ...cell };
      else if (this.tool === 'spawn' && !this.level.boxes.some(box => sameCell(box, cell))) this.level.spawn = { ...cell };
      else if (this.tool === 'box' && !sameCell(this.level.spawn, cell) && !this.level.boxes.some(box => sameCell(box, cell))) this.level.boxes.push({ id: this.nextId('box'), ...cell });
      else if ((this.tool === 'plant' || this.tool === 'arch') && !this.level.decorations.some(item => sameCell(item, cell))) this.level.decorations.push({ id: this.nextId('decor'), kind: this.tool, ...cell });
    }
    return before !== serializeLevel(this.level);
  }
  private nextId(prefix: string) { const ids = new Set([...this.level.boxes, ...this.level.decorations].map(item => item.id)); let i = 1; while (ids.has(`${prefix}-${i}`)) i++; return `${prefix}-${i}`; }
  commitStroke() {
    if (!this.strokeStart) return false;
    const changed = serializeLevel(this.strokeStart) !== serializeLevel(this.level);
    if (changed) { this.past.push(this.strokeStart); if (this.past.length > 200) this.past.shift(); this.future = []; }
    this.strokeStart = null; this.visited.clear(); return changed;
  }
  replace(level: LevelDataV1) { this.commitStroke(); this.past.push(cloneLevel(this.level)); if (this.past.length > 200) this.past.shift(); this.future = []; this.level = cloneLevel(level); this.selected = null; }
  rename(name: string) { const trimmed = name.trim().slice(0, 60) || '未命名的水庭院'; if (trimmed === this.level.name) return; const next = cloneLevel(this.level); next.name = trimmed; this.replace(next); }
  undo() { this.commitStroke(); const previous = this.past.pop(); if (!previous) return false; this.future.push(this.level); this.level = previous; this.selected = null; return true; }
  redo() { this.commitStroke(); const next = this.future.pop(); if (!next) return false; this.past.push(this.level); this.level = next; this.selected = null; return true; }
}

export function saveDraft(level: LevelDataV1, storage?: Pick<Storage, 'setItem'>): string | null {
  try { (storage ?? localStorage).setItem(DRAFT_KEY, serializeLevel(level)); return null; }
  catch { return '本地自动保存失败。编辑稿仍在当前页面，请导出 JSON 保存。'; }
}
export function loadDraft(storage?: Pick<Storage, 'getItem'>): { level: LevelDataV1 | null; error: string | null } {
  try { const saved = (storage ?? localStorage).getItem(DRAFT_KEY); return { level: saved ? parseLevel(saved) : null, error: null }; }
  catch { return { level: null, error: '无法读取本地草稿，原存储内容未被删除。可以导入已导出的 JSON。' }; }
}
