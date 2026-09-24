export interface Cell { x: number; z: number }
export interface Box extends Cell { id: string }
export interface Decoration extends Cell { id: string; kind: 'plant' | 'arch' }
export interface LevelDataV1 {
  version: 1;
  name: string;
  width: number;
  depth: number;
  terrain: (number | null)[][];
  source: Cell | null;
  spawn: Cell | null;
  boxes: Box[];
  decorations: Decoration[];
}
export type Direction = 'north' | 'east' | 'south' | 'west';
export const DIRECTIONS: readonly { name: Direction; x: number; z: number }[] = [
  { name: 'north', x: 0, z: -1 }, { name: 'east', x: 1, z: 0 },
  { name: 'south', x: 0, z: 1 }, { name: 'west', x: -1, z: 0 },
];
export type WaterKind = 'dry' | 'sheet' | 'deep';
export interface WaterCell extends Cell { kind: WaterKind; ground: number; level: number; depth: number }
export interface WaterEdge extends Cell {
  id: string; direction: Direction; from: number; to: number; kind: 'fall' | 'outlet';
}
export interface WaterSolution {
  cells: (WaterCell | null)[][];
  falls: WaterEdge[];
  outlets: WaterEdge[];
}
export interface GameState { player: Cell; boxes: Box[]; turn: number; status: 'playing' | 'won' }
export type GameCommand = { type: 'move'; direction: Direction } | { type: 'wait' };
export interface StepResult { state: GameState; water: WaterSolution; accepted: boolean; message: string }
export const sameCell = (a: Cell | null, b: Cell | null) => a !== null && b !== null && a.x === b.x && a.z === b.z;
export const cellKey = (cell: Cell) => `${cell.x},${cell.z}`;
export const cloneLevel = (level: LevelDataV1): LevelDataV1 => structuredClone(level);
export function groundAt(level: LevelDataV1, cell: Cell): number | null {
  return level.terrain[cell.z]?.[cell.x] ?? null;
}
