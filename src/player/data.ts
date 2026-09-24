import project from '../data/chapter-project.json';
import type { LevelDataV2, ProjectData } from '../world/types';

const data = project as unknown as ProjectData;

export interface ChapterView {
  id: string;
  name: string;
  levels: LevelDataV2[];
}

/** 按章节组织的全部内置关卡，顺序与章节工程一致。 */
export const chapters: ChapterView[] = data.chapters
  .map((c) => ({
    id: c.id,
    name: c.name,
    levels: c.levels.map((id) => data.levels[id]).filter((l): l is LevelDataV2 => !!l),
  }))
  .filter((c) => c.levels.length > 0);

export const levelMap: Record<string, LevelDataV2> = data.levels;

/** 扁平化的关卡顺序，用于“下一关”。 */
export const orderedLevels: LevelDataV2[] = chapters.flatMap((c) => c.levels);

export function nextLevel(id: string): LevelDataV2 | null {
  const i = orderedLevels.findIndex((l) => l.id === id);
  return i >= 0 && i < orderedLevels.length - 1 ? orderedLevels[i + 1] : null;
}

/** 正式关卡在工程里以纯数字 1–7 命名，栏目中呈现为“第 N 关”，不改原名。 */
export function displayName(level: LevelDataV2): string {
  const trimmed = level.name.trim();
  return /^\d+$/.test(trimmed) ? `第 ${trimmed} 关` : trimmed;
}

const PROGRESS_KEY = 'water-paradise-progress-v1';

export function completedLevels(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markCompleted(id: string): void {
  const done = completedLevels();
  if (done.has(id)) return;
  done.add(id);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done]));
  } catch {
    /* 进度记录失败不影响游戏。 */
  }
}
