import { cloneLevel, DIRECTIONS, groundAt, sameCell } from './types';
import type { GameCommand, GameState, LevelDataV1, StepResult, WaterSolution } from './types';
import { solveWater } from './water';
import { validatePlayable } from './level';

function settle(level: LevelDataV1, state: GameState): { state: GameState; water: WaterSolution } {
  const water = solveWater(level, state.boxes);
  return { state: { ...state, status: water.outlets.length === 1 && sameCell(state.player, water.outlets[0]) ? 'won' : 'playing' }, water };
}

export function createGame(level: LevelDataV1) {
  const errors = validatePlayable(level);
  if (errors.length) throw new Error(errors.join('\n'));
  return settle(level, { player: { ...level.spawn! }, boxes: structuredClone(level.boxes), turn: 0, status: 'playing' });
}

export function applyAction(level: LevelDataV1, original: GameState, command: GameCommand): StepResult {
  const reject = (message: string): StepResult => ({ ...settle(level, original), accepted: false, message });
  if (original.status === 'won') return reject('已找到唯一出水点，可以撤销或重开。');
  const state: GameState = structuredClone(original);
  if (command.type === 'move') {
    const dir = DIRECTIONS.find(d => d.name === command.direction)!;
    const next = { x: state.player.x + dir.x, z: state.player.z + dir.z };
    const currentHeight = groundAt(level, state.player)!, nextHeight = groundAt(level, next);
    if (nextHeight === null) return reject('前方是虚空。');
    if (Math.abs(nextHeight - currentHeight) > 1) return reject('这里的高低差超过一格。');
    const box = state.boxes.find(b => sameCell(b, next));
    if (box) {
      const beyond = { x: next.x + dir.x, z: next.z + dir.z };
      if (currentHeight !== nextHeight || groundAt(level, beyond) !== nextHeight || state.boxes.some(b => sameCell(b, beyond))) return reject('箱子只能推到同高、空着的实体地面。');
      Object.assign(box, beyond);
    }
    state.player = next;
  }
  state.turn++;
  const result = settle(level, state);
  return { ...result, accepted: true, message: result.state.status === 'won' ? '你找到了唯一的出水点。' : command.type === 'wait' ? '等待一回合。布局未变时，水位保持不变。' : '' };
}

export class GameController {
  readonly level: LevelDataV1;
  state: GameState;
  water: WaterSolution;
  private past: GameState[] = [];
  private future: GameState[] = [];
  constructor(level: LevelDataV1) { this.level = cloneLevel(level); const game = createGame(this.level); this.state = game.state; this.water = game.water; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  act(command: GameCommand) {
    const result = applyAction(this.level, this.state, command);
    if (result.accepted) { this.past.push(structuredClone(this.state)); if (this.past.length > 200) this.past.shift(); this.future = []; this.state = result.state; this.water = result.water; }
    return result;
  }
  undo() { const previous = this.past.pop(); if (!previous) return false; this.future.push(structuredClone(this.state)); Object.assign(this, settle(this.level, previous)); return true; }
  redo() { const next = this.future.pop(); if (!next) return false; this.past.push(structuredClone(this.state)); Object.assign(this, settle(this.level, next)); return true; }
  restart() { Object.assign(this, createGame(this.level)); this.past = []; this.future = []; }
}
