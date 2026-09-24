import { createLevel } from './level';
import type { Direction, LevelDataV1 } from './types';

export interface Example { id: string; title: string; subtitle: string; description: string; level: LevelDataV1; solution?: Direction[] }
function filled(name: string, width: number, depth: number, height: number) {
  const level = createLevel(width, depth); level.name = name;
  level.terrain = level.terrain.map(row => row.map(() => height));
  return level;
}
const puzzle = filled('一水归途', 8, 7, 1);
for (let x = 0; x < 8; x++) puzzle.terrain[3][x] = 0;
for (const [x, z] of [[4, 2], [5, 2], [5, 1]]) puzzle.terrain[z][x] = 0;
puzzle.source = { x: 2, z: 3 }; puzzle.spawn = { x: 5, z: 1 }; puzzle.boxes = [{ id: 'gate', x: 5, z: 2 }];
puzzle.decorations = [{ id: 'fern-a', kind: 'plant', x: 0, z: 0 }, { id: 'fern-b', kind: 'plant', x: 7, z: 6 }, { id: 'arch', kind: 'arch', x: 2, z: 0 }];

const rise = filled('水涨一格', 10, 8, 3);
for (let z = 1; z < 7; z++) for (let x = 1; x < 7; x++) rise.terrain[z][x] = 0;
for (const [x,z] of [[7,2],[7,3],[7,4],[8,4],[9,4]]) rise.terrain[z][x] = 0;
rise.terrain[3][0] = 1;
rise.source = { x: 2, z: 2 }; rise.spawn = { x: 7, z: 2 }; rise.boxes = [{ id: 'sill', x: 7, z: 3 }];
rise.decorations = [{ id: 'plant-a', kind: 'plant', x: 0, z: 0 }, { id: 'plant-b', kind: 'plant', x: 7, z: 7 }];

const isolate = filled('消失的支流', 9, 7, 2);
for (let x = 0; x < 8; x++) isolate.terrain[3][x] = 0;
for (const [x, z] of [[3, 2], [4, 2], [4, 1]]) isolate.terrain[z][x] = 0;
isolate.source = { x: 1, z: 3 }; isolate.spawn = { x: 4, z: 1 }; isolate.boxes = [{ id: 'divider', x: 4, z: 2 }];
isolate.decorations = [{ id: 'plant-a', kind: 'plant', x: 8, z: 3 }, { id: 'plant-b', kind: 'plant', x: 0, z: 6 }];

const cascade = filled('层层流下', 9, 9, 0);
for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) cascade.terrain[z][x] = z < 4 ? 3 : z < 7 ? 1 : 0;
for (let x = 3; x <= 5; x++) cascade.terrain[5][x] = 0;
cascade.source = { x: 4, z: 2 }; cascade.spawn = { x: 2, z: 7 };
cascade.terrain[3][8] = 2; // a walkable stair connecting the terraces
cascade.decorations = [{ id: 'plant-a', kind: 'plant', x: 0, z: 1 }, { id: 'arch', kind: 'arch', x: 5, z: 0 }];

export const examples: Example[] = [
  { id: 'homecoming', title: '一水归途', subtitle: '01 / 入门关卡', description: '推动箱子，切断右侧水路。让水只留一个出口，再走到它身边。', level: puzzle, solution: ['south', 'west', 'south', 'west', 'west', 'west', 'west'] },
  { id: 'rising', title: '水涨一格', subtitle: '02 / 蓄水实验', description: '向南推一次，把箱子推到低缺口。观察水位升高，以及水漫过箱顶。', level: rise },
  { id: 'isolation', title: '消失的支流', subtitle: '03 / 连通实验', description: '向南推动箱子。右侧虽然仍是低地，却会因为断开水源而变干。', level: isolate },
  { id: 'cascade', title: '层层流下', subtitle: '04 / 高差实验', description: '不同高度都可以出水。内部瀑布只连接水路，临空的边才计为出水点。', level: cascade },
];
