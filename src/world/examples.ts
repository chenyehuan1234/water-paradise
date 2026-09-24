import { examples as legacy } from '../core/examples';
import { migrateV1, newLevel } from './level';
import { clone } from './types';
import type { LevelDataV2, ObjectKind, ProjectData, WorldObject } from './types';
import { addChapter, addLevel, emptyProject } from '../workshop/project';
export function object(level: LevelDataV2, kind: ObjectKind, x: number, y: number, z: number, extra: Partial<WorldObject> = {}) {
  const o: WorldObject = { id: `${kind}-${x}-${y}-${z}-${extra.direction ?? 'north'}`, kind, x, y, z, direction: 'north', ...extra }; level.objects.push(o); return o;
}
export function floor(level: LevelDataV2, y = 0, x0 = 0, z0 = 0, x1 = level.width - 1, z1 = level.depth - 1) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) object(level, 'stone', x, y, z); }
function base(name: string, description: string) { const l = newLevel(name, 8, 8); l.id = `sample-${name}`; l.description = description; floor(l); l.spawn = { x: 2, y: 1, z: 6 }; l.source = { x: 1, y: 1, z: 1 }; return l; }
function pool(name: string, description: string) {
  const l = base(name, description);
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (!x || !z || x === 7 || z === 7) for (let y = 1; y < 3; y++) object(l, 'stone', x, y, z);
  // One low sill at the northern rim, with glass keeping the remaining perimeter higher.
  l.objects = l.objects.filter(o => !(o.x === 3 && o.z === 0 && o.y === 2));
  l.source = { x: 2, y: 1, z: 2 }; return l;
}
export function exampleProject(): ProjectData {
  const p = emptyProject(), old = addChapter(p, '01 · 水流基础');
  for (const e of legacy) { const l = migrateV1(e.level, e.id); l.description = e.description; l.route = e.solution?.map(direction => ({ type: 'move', direction })); addLevel(p, old, l); }
  const chapter = addChapter(p, '02 · 物件实验室');
  const stack = base('整列与堆叠', '向北推：两只箱子和上面的木块一同移动。撤销后可拆开观察，每个物件仍有自己的身份。');
  object(stack, 'crate', 2, 1, 5); object(stack, 'wood', 2, 2, 5); object(stack, 'crate', 2, 1, 4); addLevel(p, chapter, stack);
  const tunnel = base('桥下的水路', '铁架允许水穿过；悬空石块下保留下层通道。实心玻璃阻水，带开口的玻璃只挡角色。');
  for (let x = 2; x < 6; x++) { object(tunnel, 'floating', x, 3, 3); object(tunnel, 'bridge', x, 3, 4); }
  for (let x = 2; x < 6; x++) object(tunnel, x < 4 ? 'glass' : 'open-glass', x, 1, 2, { direction: 'south' }); addLevel(p, chapter, tunnel);
  const climb = base('台阶与铁架', '从台阶登上高台，再同高走上铁架。直接对着高一格的铁架无法攀爬；两格高的石柱也不可站立。');
  object(climb, 'stone', 2, 1, 5); object(climb, 'stone', 2, 1, 4); object(climb, 'stone', 2, 2, 4); for (let x = 3; x < 7; x++) object(climb, 'bridge', x, 3, 4); object(climb, 'barrier', 5, 1, 6); addLevel(p, chapter, climb);
  const boat = pool('浮船与永久载荷', '首块箱子或木块与薄船板绑定，保持完整一格；后续堆叠保持独立。深水托起船板，水位降低时搁底。');
  object(boat, 'boat', 3, 1, 3); object(boat, 'crate', 3, 4, 3); object(boat, 'boat', 5, 1, 4); object(boat, 'wood', 5, 3, 4); addLevel(p, chapter, boat);
  const pull = pool('隔水牵引', '先用 Shift + 方向键原地转向，再按 X。陆地拉船、船拉陆地和两船靠近由站位决定。');
  object(pull, 'boat', 2, 1, 5); object(pull, 'boat', 5, 1, 5, { cargo: [{ id: 'loaded-crate-b', kind: 'crate' }] }); pull.spawn = { x: 2, y: 1, z: 5 }; addLevel(p, chapter, pull);
  const splash = pool('落水的力量', '向东推动高处木块落入原有深水。相邻同水层的船被水花推动，滑到障碍前停止；平流层不会驱船。');
  object(splash, 'floating', 2, 3, 4); object(splash, 'floating', 1, 3, 4); object(splash, 'wood', 2, 4, 4); object(splash, 'boat', 4, 1, 4); splash.spawn = { x: 1, y: 4, z: 4 }; addLevel(p, chapter, splash);
  const checks = addChapter(p, '03 · 综合验证');
  const a = clone(p.levels.homecoming); a.id = 'validation-push'; a.name = '庭院归途 · 推'; a.description = '先向南推箱封住支流，再沿左侧水路抵达唯一出口。桥架与上层平台保留下方水路。';
  for (let x = 1; x < 4; x++) object(a, 'bridge', x, 4, 3); object(a, 'floating', 1, 3, 2); object(a, 'glass', 2, 4, 3, { direction: 'north' }); addLevel(p, checks, a);
  const b = clone(p.levels.homecoming); b.id = 'validation-pull'; b.name = '庭院归途 · 拉'; b.description = '面朝北拉近箱子，封住右侧水路；经西侧支路走到出口。'; b.spawn = { x: 5, y: 1, z: 4 };
  b.objects = b.objects.filter(o => !(o.kind === 'stone' && o.y === 1 && o.z === 4 && (o.x === 4 || o.x === 5)));
  b.route = [{ type: 'turn', direction: 'north' }, { type: 'pull' }, { type: 'move', direction: 'west' }, { type: 'move', direction: 'north' }, ...Array.from({ length: 4 }, () => ({ type: 'move' as const, direction: 'west' as const }))];
  object(b, 'bridge', 4, 4, 3); addLevel(p, checks, b); p.active = 'validation-push'; return p;
}
