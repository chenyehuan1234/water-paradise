import { describe, expect, it } from 'vitest';
import { applyAction, createGame, GameController } from '../../src/core/game';
import { examples } from '../../src/core/examples';
import { cloneLevel } from '../../src/core/types';
import { createLevel } from '../../src/core/level';

describe('turns, blockers and goal', () => {
  it('has a recorded seven-move solution which pushes a box and reaches the sole outlet', () => {
    const example = examples[0], game = new GameController(example.level);
    expect(game.water.outlets).toHaveLength(2);
    example.solution!.forEach(direction => expect(game.act({ type: 'move', direction }).accepted).toBe(true));
    expect(game.state).toMatchObject({ turn: 7, status: 'won', player: { x: 0, z: 3 } });
    expect(game.water.outlets).toHaveLength(1);
  });
  it('undo and redo restore both boxes and derived water', () => {
    const game = new GameController(examples[0].level), before = structuredClone({ state: game.state, water: game.water });
    game.act({ type: 'move', direction: 'south' }); const after = structuredClone({ state: game.state, water: game.water });
    expect(game.water.cells[3][7]?.kind).toBe('dry');
    expect(game.undo()).toBe(true); expect({ state: game.state, water: game.water }).toEqual(before);
    expect(game.redo()).toBe(true); expect({ state: game.state, water: game.water }).toEqual(after);
    game.restart(); expect({ state: game.state, water: game.water }).toEqual(before);
  });
  it('wait and player-only movement do not accumulate more water', () => {
    const game = new GameController(examples[1].level), before = structuredClone(game.water);
    game.act({ type: 'wait' }); expect(game.state.turn).toBe(1); expect(game.water).toEqual(before);
    game.act({ type: 'move', direction: 'west' }); expect(game.water).toEqual(before);
  });
  it('does not advance invalid movement, allows one-step climbs, rejects void and large cliffs', () => {
    const level = createLevel(4, 4); level.spawn = { x: 1, z: 1 }; level.source = { x: 3, z: 3 };
    level.terrain[0][1] = 2; level.terrain[1][0] = null; level.terrain[1][2] = 1;
    const state = createGame(level).state;
    expect(applyAction(level, state, { type: 'move', direction: 'north' }).accepted).toBe(false);
    expect(applyAction(level, state, { type: 'move', direction: 'west' }).state.turn).toBe(0);
    expect(applyAction(level, state, { type: 'move', direction: 'east' }).accepted).toBe(true);
  });
  it('rejects chain pushing, pushing into void, and pushing across heights', () => {
    const level = createLevel(4, 4); level.spawn = { x: 0, z: 1 }; level.source = { x: 0, z: 0 };
    level.boxes = [{ id: 'a', x: 1, z: 1 }, { id: 'b', x: 2, z: 1 }];
    expect(new GameController(level).act({ type: 'move', direction: 'east' }).accepted).toBe(false);
    level.boxes.pop(); level.terrain[1][2] = null;
    expect(new GameController(level).act({ type: 'move', direction: 'east' }).accepted).toBe(false);
    level.terrain[1][2] = 1;
    expect(new GameController(level).act({ type: 'move', direction: 'east' }).accepted).toBe(false);
  });
  it('does not win merely by standing on a tile with two outlet sides', () => {
    const level = createLevel(4, 4); level.terrain = level.terrain.map(row => row.map(() => 2)); level.terrain[0][0] = 0;
    level.spawn = { x: 0, z: 0 }; level.source = { x: 0, z: 0 };
    const game = createGame(level); expect(game.water.outlets).toHaveLength(2); expect(game.state.status).toBe('playing');
  });
  it('is deterministic and never mutates the level or original state', () => {
    const level = cloneLevel(examples[0].level), original = JSON.stringify(level), state = createGame(level).state, stateCopy = structuredClone(state);
    expect(applyAction(level, state, { type: 'move', direction: 'south' })).toEqual(applyAction(level, state, { type: 'move', direction: 'south' }));
    expect(state).toEqual(stateCopy); expect(JSON.stringify(level)).toBe(original);
  });
});
