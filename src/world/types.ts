export type Direction = 'north' | 'east' | 'south' | 'west';
export const DIRS = [{ name: 'north', x: 0, z: -1 }, { name: 'east', x: 1, z: 0 }, { name: 'south', x: 0, z: 1 }, { name: 'west', x: -1, z: 0 }] as const;
export interface Vec3 { x: number; y: number; z: number }
export type ObjectKind = 'stone' | 'floating' | 'wood' | 'crate' | 'barrier' | 'glass' | 'open-glass' | 'bridge' | 'boat' | 'plant' | 'arch';
export interface Cargo { id: string; kind: 'wood' | 'crate' }
export interface WorldObject extends Vec3 { id: string; kind: ObjectKind; direction: Direction; cargo?: Cargo[] }
export interface LevelDataV2 { version: 2; id: string; name: string; width: number; depth: number; objects: WorldObject[]; source: Vec3 | null; spawn: Vec3 | null; description?: string; route?: Command[] }
export type AnimationMode = 'full' | 'simple' | 'system';
export interface EditorSettings { tool: ObjectKind | 'source' | 'spawn'; direction: Direction; glassMode?: 'auto' | 'manual'; animation?: AnimationMode; layer: number; brush: 1 | 3 | 5; rectangle: boolean; slice: number; grid: boolean; depth: boolean; outlets: boolean }
export interface Chapter { id: string; name: string; levels: string[]; collapsed: boolean }
export interface DeletedEntry { id: string; name: string; chapter?: Chapter; levels: LevelDataV2[]; chapterId: string; index: number }
export interface ProjectData { version: 2; chapters: Chapter[]; levels: Record<string, LevelDataV2>; settings: Record<string, EditorSettings>; active: string; trash: DeletedEntry[] }
export interface WaterCell extends Vec3 { id: string; ceiling: number; level: number; head: number; depth: number; kind: 'dry' | 'sheet' | 'deep'; surface: boolean }
export interface WaterEdge extends Vec3 { id: string; cellId: string; direction: Direction; from: number; to: number; kind: 'fall' | 'outlet' }
export interface WaterSolution { cells: WaterCell[]; falls: WaterEdge[]; outlets: WaterEdge[]; sourceLanding: Vec3 | null }
export interface GameState { player: Vec3; facing: Direction; objects: WorldObject[]; riding: string | null; turn: number; status: 'playing' | 'won' }
export type Command = { type: 'move'; direction: Direction } | { type: 'turn'; direction: Direction } | { type: 'pull' } | { type: 'wait' };
export interface ActionEvent { reversed?: boolean; type: 'walk' | 'turn' | 'push' | 'climb' | 'fall' | 'land' | 'pull' | 'load' | 'float' | 'slide' | 'splash' | 'drip' | 'win' | 'leave'; id: string; from: Vec3; to: Vec3; target?: Vec3; targetId?: string; deep?: boolean; direction?: Direction }
export interface StepResult { accepted: boolean; state: GameState; water: WaterSolution; events: ActionEvent[]; message: string }
export const key = (p: Vec3) => `${p.x},${p.y},${p.z}`;
export const same = (a: Vec3, b: Vec3) => a.x === b.x && a.y === b.y && a.z === b.z;
export const sameColumn = (a: Vec3, b: Vec3) => a.x === b.x && a.z === b.z;
export const clone = <T>(value: T): T => structuredClone(value);
export const dir = (d: Direction) => DIRS.find(v => v.name === d)!;
export const opposite = (d: Direction): Direction => DIRS[(DIRS.findIndex(v => v.name === d) + 2) % 4].name;
export const plus = (p: Vec3, d: { x: number; z: number }, n = 1): Vec3 => ({ x: p.x + d.x * n, y: p.y, z: p.z + d.z * n });
export const uid = (prefix = 'item') => `${prefix}-${globalThis.crypto.randomUUID()}`;
export const defaults = (): EditorSettings => ({ tool: 'stone', direction: 'north', glassMode: 'auto', animation: 'full', layer: 0, brush: 1, rectangle: false, slice: 32, grid: true, depth: false, outlets: true });
