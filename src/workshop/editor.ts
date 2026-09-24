import { glass, height } from '../world/catalog';
import { placementError, inside } from '../world/spatial';
import { clone, defaults, dir, key, uid } from '../world/types';
import type { EditorSettings, LevelDataV2, Vec3, WorldObject } from '../world/types';

export interface Pick { position: Vec3; normal: Vec3; hit?: Vec3; id?: string; kind?: WorldObject['kind'] | 'source' | 'spawn'; direction?: WorldObject['direction'] }
export interface Placement { position: Vec3; direction: WorldObject['direction']; error: string | null }
export function resolvePlacement(pick: Pick, settings: EditorSettings): Placement {
  let p = { ...pick.position }, direction = settings.direction;
  const pane = pick.kind === 'glass' || pick.kind === 'open-glass';
  if ((settings.tool === 'glass' || settings.tool === 'open-glass') && pane && pick.direction) {
    direction = settings.glassMode === 'manual' ? settings.direction : pick.direction;
    const h = pick.hit ?? pick.position;
    const side = direction === 'north' || direction === 'south' ? 'x' : 'z';
    if (h.y - pick.position.y > .77) p.y++;
    else if (Math.abs(h[side] - pick.position[side]) > .32) p[side] += Math.sign(h[side] - pick.position[side]);
    return { position: p, direction, error: null };
  }
  if (pick.id) {
    if (settings.tool === 'glass' || settings.tool === 'open-glass') {
      if (pick.normal.y > 0) p.y++;
      if (settings.glassMode !== 'manual') {
        if (pick.normal.x || pick.normal.z) direction = pick.normal.x ? pick.normal.x > 0 ? 'east' : 'west' : pick.normal.z > 0 ? 'south' : 'north';
        else {
          const h = pick.hit ?? pick.position, dx = h.x - pick.position.x, dz = h.z - pick.position.z;
          direction = Math.abs(dx) > Math.abs(dz) ? dx >= 0 ? 'east' : 'west' : dz >= 0 ? 'south' : 'north';
        }
      }
      if (pick.normal.y < 0) p.y--;
    } else { p = { x: p.x + pick.normal.x, y: p.y + pick.normal.y, z: p.z + pick.normal.z }; }
    if (settings.tool === 'bridge' && pick.normal.y < 0) p.y++;
  } else if ((settings.tool === 'glass' || settings.tool === 'open-glass') && settings.glassMode !== 'manual' && pick.hit) {
    const dx = pick.hit.x - p.x, dz = pick.hit.z - p.z;
    direction = Math.abs(dx) > Math.abs(dz) ? dx >= 0 ? 'east' : 'west' : dz >= 0 ? 'south' : 'north';
  }
  return { position: p, direction, error: null };
}
export function placementNormal(pick: Pick, settings: EditorSettings): Vec3 {
  if (settings.tool === 'glass' || settings.tool === 'open-glass') {
    const d = dir(resolvePlacement(pick,settings).direction); return {x:d.x,y:0,z:d.z};
  }
  return pick.normal;
}
export class StackingEditor {
  level: LevelDataV2; settings: EditorSettings;
  private past: LevelDataV2[] = []; private future: LevelDataV2[] = [];
  stroke: { before: LevelDataV2; visited: Set<string>; deleted: Set<string>; erase: boolean; start: Pick | null } | null = null;
  constructor(level: LevelDataV2, settings = defaults()) { this.level = clone(level); this.settings = clone(settings); }
  private remember(before: LevelDataV2) { this.past.push(before); if (this.past.length > 100) this.past.shift(); this.future = []; }
  edit(change: (level: LevelDataV2) => void) { const before = clone(this.level); change(this.level); if (JSON.stringify(before) !== JSON.stringify(this.level)) this.remember(before); }
  begin(erase: boolean, start: Pick | null) { if (this.stroke) this.end(); this.stroke = { before: clone(this.level), visited: new Set(), deleted: new Set(), erase, start }; }
  end() { if (!this.stroke) return false; const changed = JSON.stringify(this.level) !== JSON.stringify(this.stroke.before); if (changed) this.remember(this.stroke.before); this.stroke = null; return changed; }
  cancel() { if (this.stroke) { this.level = this.stroke.before; this.stroke = null; } }
  preview(pick: Pick): Placement {
    const result = resolvePlacement(pick, this.settings), { position, direction } = result;
    if (this.settings.tool === 'source' || this.settings.tool === 'spawn') result.error = inside(this.level, position) && position.y >= 0 && position.y <= 32 ? null : '超出范围';
    else result.error = placementError(this.level, { ...position, kind: this.settings.tool, direction, id: 'preview' });
    return result;
  }
  sample(pick: Pick) { if (pick.kind) { this.settings.tool = pick.kind; if (pick.direction) { this.settings.direction = pick.direction; this.settings.glassMode = 'manual'; } } }
  paint(pick: Pick) {
    const stroke = this.stroke; if (!stroke) return;
    if (stroke.erase) {
      if (pick.id && !stroke.deleted.has(pick.id)) { stroke.deleted.add(pick.id); this.remove(pick.id); }
      if (this.settings.brush > 1) { const r = (this.settings.brush - 1) / 2; for (const o of stroke.before.objects) if (o.y === pick.position.y && Math.abs(o.x - pick.position.x) <= r && Math.abs(o.z - pick.position.z) <= r) { stroke.deleted.add(o.id); this.remove(o.id); } }
      return;
    }
    const placement = resolvePlacement(pick, this.settings), r = ['spawn', 'source'].includes(this.settings.tool) ? 0 : (this.settings.brush - 1) / 2;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      const normal = placementNormal(pick,this.settings), p = { ...placement.position };
      if (normal.x) { p.y += a; p.z += b; } else if (normal.z) { p.x += a; p.y += b; } else { p.x += a; p.z += b; }
      this.place(p, placement.direction);
    }
  }
  rectangle(end: Vec3) {
    const s = this.stroke; if (!s?.start) return;
    const start = resolvePlacement(s.start, this.settings), n = placementNormal(s.start,this.settings);
    const axes: ('x' | 'y' | 'z')[] = n.x ? ['y', 'z'] : n.z ? ['x', 'y'] : ['x', 'z'];
    for (let a = Math.min(start.position[axes[0]], end[axes[0]]); a <= Math.max(start.position[axes[0]], end[axes[0]]); a++) for (let b = Math.min(start.position[axes[1]], end[axes[1]]); b <= Math.max(start.position[axes[1]], end[axes[1]]); b++) {
      const p = { ...start.position, [axes[0]]: a, [axes[1]]: b };
      if (s.erase) for (const o of s.before.objects) { const hit = s.start.position; const axis = n.x ? 'x' : n.z ? 'z' : 'y'; if (o[axis] === hit[axis] && o[axes[0]] === a && o[axes[1]] === b) this.remove(o.id); }
      else this.place(p, start.direction);
    }
  }
  private place(p: Vec3, direction: WorldObject['direction']) {
    const s = this.stroke, tool = this.settings.tool, k = `${key(p)}:${tool}:${direction}`;
    if (!s || s.visited.has(k)) return; s.visited.add(k);
    if (!inside(this.level, p) || p.y < 0 || p.y > 32) return;
    if (tool === 'spawn' || tool === 'source') { if (tool === 'spawn' && this.level.objects.some(o => !glass(o) && o.x === p.x && o.z === p.z && o.y <= p.y && o.y + height(o) > p.y)) return; this.level[tool] = { ...p }; return; }
    const o: WorldObject = { ...p, direction, id: uid(tool), kind: tool };
    if (!placementError(this.level, o)) this.level.objects.push(o);
  }
  private remove(id: string) { if (id === '$source') this.level.source = null; else if (id === '$spawn') this.level.spawn = null; else this.level.objects = this.level.objects.filter(o => o.id !== id); }
  undo() { this.end(); const before = this.past.pop(); if (!before) return false; this.future.push(clone(this.level)); this.level = before; return true; }
  redo() { const next = this.future.pop(); if (!next) return false; this.past.push(clone(this.level)); this.level = next; return true; }
  get canUndo() { return !!this.past.length; } get canRedo() { return !!this.future.length; }
}
