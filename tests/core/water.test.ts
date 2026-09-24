import { describe, expect, it } from 'vitest';
import { solveWater } from '../../src/core/water';
import { createLevel } from '../../src/core/level';
import { examples } from '../../src/core/examples';
import { cloneLevel } from '../../src/core/types';

describe('source-connected equilibrium', () => {
  it('covers an entire connected plane and counts each boundary edge', () => {
    const level = createLevel(4, 4); level.source = { x: 1, z: 1 };
    const water = solveWater(level);
    expect(water.cells.flat().filter(c => c?.kind === 'sheet')).toHaveLength(16);
    expect(water.outlets).toHaveLength(16);
    expect(water.outlets.filter(e => e.x === 0 && e.z === 0)).toHaveLength(2);
  });
  it('fills to a new sill, overtops a box, and lowers again when removed', () => {
    const level = cloneLevel(examples[1].level);
    const before = solveWater(level);
    expect(before.cells[2][2]?.kind).toBe('sheet');
    const blocked = solveWater(level, [{ id: 'sill', x: 7, z: 4 }]);
    expect(blocked.cells[2][2]).toMatchObject({ kind: 'deep', depth: 1, level: 1 });
    expect(blocked.cells[4][7]).toMatchObject({ kind: 'sheet', ground: 1, level: 1 });
    expect(blocked.outlets).toHaveLength(2);
    expect(solveWater(level)).toEqual(before);
  });
  it('removes disconnected branch water rather than retaining a puddle', () => {
    const level = examples[2].level;
    expect(solveWater(level).cells[3][7]?.kind).toBe('sheet');
    expect(solveWater(level, [{ id: 'divider', x: 4, z: 3 }]).cells[3][7]?.kind).toBe('dry');
    expect(solveWater(level).cells[3][7]?.kind).toBe('sheet');
  });
  it('allows different outlet elevations, distinguishes internal falls, and drops void water four units', () => {
    const water = solveWater(examples[3].level);
    expect([...new Set(water.outlets.map(e => e.from))].sort()).toEqual([0,1,2,3]);
    expect(water.falls.length).toBeGreaterThan(0);
    expect(water.outlets.every(e => e.from - e.to === 4 && e.kind === 'outlet')).toBe(true);
    expect(water.falls.every(e => e.kind === 'fall')).toBe(true);
    expect(water.cells[5][4]).toMatchObject({ kind: 'deep', depth: 1 });
  });
  it('merges connected basins under downstream backwater', () => {
    const level = createLevel(7, 5);
    level.terrain = [[4,4,4,4,4,4,4],[4,0,0,4,0,0,4],[4,0,0,1,0,0,3],[4,0,0,4,0,0,4],[4,4,4,4,4,4,4]];
    level.source = { x: 1, z: 2 };
    const water = solveWater(level);
    expect(water.cells[2][1]?.level).toBe(3); expect(water.cells[2][5]?.level).toBe(3);
    expect(water.cells[2][3]?.depth).toBe(2); expect(water.outlets).toHaveLength(1);
  });
  it('does not fill depressions without a source and handles internal voids', () => {
    const level = createLevel(5, 5); level.terrain[2][2] = null;
    expect(solveWater(level).outlets).toHaveLength(0);
    level.source = { x: 1, z: 1 };
    expect(solveWater(level).outlets).toHaveLength(24);
    expect(solveWater(level).cells[2][2]).toBeNull();
  });
  it('accepts a source on a submerged box and classifies water above its top', () => {
    const level = createLevel(5, 5);
    level.terrain = [[3,3,3,3,3],[3,0,0,0,3],[3,0,0,0,2],[3,0,0,0,3],[3,3,3,3,3]];
    level.source = { x: 2, z: 2 }; level.boxes = [{ id: 'under-source', x: 2, z: 2 }];
    const water = solveWater(level);
    expect(water.cells[2][2]).toMatchObject({ kind: 'deep', ground: 1, level: 2, depth: 1 });
    expect(water.cells[1][1]).toMatchObject({ kind: 'deep', depth: 2 });
    expect(water.outlets).toHaveLength(1);
  });
  it('is independent of player, decoration and previous solutions', () => {
    const level = cloneLevel(examples[0].level), before = solveWater(level);
    level.spawn = { x: 0, z: 0 }; level.decorations = [];
    expect(solveWater(level)).toEqual(before);
    expect(solveWater(level)).toEqual(solveWater(level));
  });
});
