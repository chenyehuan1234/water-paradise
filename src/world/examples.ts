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
  const boat = pool('浮船与永久载荷', '只有从上方落入空船的首块箱子或木块才绑定；同高推箱靠向船时二者一起前进，仍各自独立。深水托起船板，同高时也可推动。');
  object(boat, 'boat', 3, 1, 3); object(boat, 'crate', 3, 4, 3); object(boat, 'boat', 5, 1, 4); object(boat, 'wood', 5, 3, 4); addLevel(p, chapter, boat);
  const pull = pool('隔水牵引', '面朝同层箱子时按对应方向键挂链，再按空格。陆地拉船、船拉陆地和两船靠近由站位决定。');
  object(pull, 'boat', 2, 1, 5); object(pull, 'boat', 5, 1, 5, { cargo: [{ id: 'loaded-crate-b', kind: 'crate' }] }); pull.spawn = { x: 2, y: 1, z: 5 }; addLevel(p, chapter, pull);
  const splash = pool('落水的力量', '向东推动高处木块落入已有水面。相邻同水面的船被水花推动，平流层同样有效，船可在同高深浅水之间滑行。');
  object(splash, 'floating', 2, 3, 4); object(splash, 'floating', 1, 3, 4); object(splash, 'wood', 2, 4, 4); object(splash, 'boat', 4, 1, 4); splash.spawn = { x: 1, y: 4, z: 4 }; addLevel(p, chapter, splash);
  const boatPush=pool('深水推船', '从齐平石台推动深水中的船。把陆地木块推向船时两者同移，木块不绑定；只有真正从上方落入空船才绑定。');
  object(boatPush,'stone',2,1,4);object(boatPush,'stone',3,1,4);object(boatPush,'wood',3,2,4);object(boatPush,'boat',4,1,4);boatPush.spawn={x:2,y:2,z:4};addLevel(p,chapter,boatPush);
  const balance=base('五格天平与板下限位', '青绿天平固定五格宽，两端称重。右端木块压下、左端抬起后，可将两块叠在一起的箱子推入左端板底，使它不能回落；移走限位块再观察。');
  object(balance,'balance',4,1,4,{direction:'east',mastHeight:1});object(balance,'wood',6,2,4);
  object(balance,'crate',2,1,3);object(balance,'crate',2,2,3);balance.spawn={x:2,y:1,z:2};addLevel(p,chapter,balance);
  const checks = addChapter(p, '03 · 综合验证');
  const a = clone(p.levels.homecoming); a.id = 'validation-push'; a.name = '庭院归途 · 推'; a.description = '先向南推箱封住支流，再沿左侧水路抵达唯一出口。桥架与上层平台保留下方水路。';
  for (let x = 1; x < 4; x++) object(a, 'bridge', x, 4, 3); object(a, 'floating', 1, 3, 2); object(a, 'glass', 2, 4, 3, { direction: 'north' }); addLevel(p, checks, a);
  const b = clone(p.levels.homecoming); b.id = 'validation-pull'; b.name = '庭院归途 · 拉'; b.description = '面朝北拉近箱子，封住右侧水路；经西侧支路走到出口。'; b.spawn = { x: 5, y: 1, z: 4 };
  b.objects = b.objects.filter(o => !(o.kind === 'stone' && o.y === 1 && o.z === 4 && (o.x === 4 || o.x === 5)));
  b.route = [{ type: 'turn', direction: 'north' }, { type: 'pull' }, { type: 'move', direction: 'west' }, { type: 'move', direction: 'north' }, ...Array.from({ length: 4 }, () => ({ type: 'move' as const, direction: 'west' as const }))];
  object(b, 'bridge', 4, 4, 3); addLevel(p, checks, b); p.active = 'validation-push';p.hiddenFromMenu=Object.keys(p.levels);p.sampleRevision=1; return p;
}
/** Add only the new demonstration levels to an existing user's saved project. */
export function appendRevisedExamples(project:ProjectData):boolean {
  if((project.sampleRevision??0)>=1)return false;
  const source=exampleProject(),ids=['sample-深水推船','sample-五格天平与板下限位'];
  const original=project.active;
  const chapter=project.chapters.find(c=>c.levels.includes('sample-浮船与永久载荷'))??addChapter(project,'物件实验 · 新样例');
  for(const id of ids)if(!project.levels[id]){addLevel(project,chapter,clone(source.levels[id]));(project.hiddenFromMenu??=[]).push(id);}
  project.active=original;project.sampleRevision=1;return true;
}
