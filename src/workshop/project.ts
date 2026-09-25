import { newLevel, parseLevel, readJSON } from '../world/level';
import { clone, defaults, uid } from '../world/types';
import type { Chapter, ProjectData } from '../world/types';

const builtInIds=new Set(['homecoming','rising','isolation','cascade','sample-整列与堆叠','sample-桥下的水路','sample-台阶与铁架','sample-浮船与永久载荷','sample-隔水牵引','sample-落水的力量','sample-深水推船','sample-五格天平与板下限位','validation-push','validation-pull']);
export const listedInGame=(p:ProjectData,id:string)=>!!p.levels[id]&&!builtInIds.has(id)&&!p.hiddenFromMenu?.includes(id);
export const listedLevelIds=(p:ProjectData)=>p.chapters.flatMap(c=>c.levels.filter(id=>listedInGame(p,id)));

export function emptyProject(): ProjectData { return { version: 2, chapters: [], levels: {}, settings: {}, active: '', trash: [] }; }
export function addChapter(p: ProjectData, name = '新的章节'): Chapter { const chapter = { id: uid('chapter'), name, levels: [], collapsed: false }; p.chapters.push(chapter); return chapter; }
export function addLevel(p: ProjectData, chapter: Chapter, level = newLevel()) { p.levels[level.id] = level; p.settings[level.id] = defaults(); chapter.levels.push(level.id); p.active = level.id; return level; }
export function duplicateLevel(p: ProjectData, id: string) { const chapter = p.chapters.find(c => c.levels.includes(id))!; const level = clone(p.levels[id]); level.id = uid('level'); level.name += ' · 副本'; return addLevel(p, chapter, level); }
export function removeLevel(p: ProjectData, id: string) { const chapter = p.chapters.find(c => c.levels.includes(id)); if (!chapter) return; const index = chapter.levels.indexOf(id); p.trash.push({ id: uid('trash'), name: p.levels[id].name, levels: [clone(p.levels[id])], chapterId: chapter.id, index }); chapter.levels.splice(index, 1); delete p.levels[id];p.hiddenFromMenu=p.hiddenFromMenu?.filter(item=>item!==id); if (p.active === id) p.active = p.chapters.flatMap(c => c.levels)[0] ?? ''; }
export function removeChapter(p: ProjectData, id: string) { const c = p.chapters.find(c => c.id === id); if (!c) return; p.trash.push({ id: uid('trash'), name: c.name, chapter: clone(c), levels: c.levels.map(l => clone(p.levels[l])), chapterId: id, index: p.chapters.indexOf(c) }); for (const id of c.levels) delete p.levels[id]; p.chapters = p.chapters.filter(ch => ch.id !== id); if (!p.levels[p.active]) p.active = p.chapters.flatMap(c => c.levels)[0] ?? ''; }
export function recover(p: ProjectData, id: string) { const entry = p.trash.find(e => e.id === id); if (!entry) return; let chapter = p.chapters.find(c => c.id === entry.chapterId); if (entry.chapter) { chapter = clone(entry.chapter); chapter.levels = []; p.chapters.splice(entry.index, 0, chapter); } chapter ??= addChapter(p, '恢复的关卡'); for (const level of entry.levels) { p.levels[level.id] = clone(level); chapter.levels.splice(entry.index, 0, level.id); p.settings[level.id] ??= defaults(); } p.trash = p.trash.filter(e => e.id !== id); p.active = entry.levels[0]?.id ?? p.active; }
export function moveLevel(p: ProjectData, id: string, chapterId: string, index: number) { const from = p.chapters.find(c => c.levels.includes(id)), to = p.chapters.find(c => c.id === chapterId); if (!from || !to) return; from.levels.splice(from.levels.indexOf(id), 1); to.levels.splice(Math.max(0, Math.min(to.levels.length, index)), 0, id); }
/** Parse the complete payload before mutating the live project. IDs are remapped to new copies. */
export function importProject(p: ProjectData, text: string): ProjectData {
  const raw = readJSON(text), next = clone(p);
  if (raw && typeof raw === 'object' && 'chapters' in raw) {
    const source = raw as ProjectData;
    if (source.version !== 2 || !Array.isArray(source.chapters) || !source.levels || source.chapters.length > 200) throw new Error('章节工程格式无效');
    const parsed = source.chapters.map(c => { if (!c || typeof c.name !== 'string' || !c.name.trim() || !Array.isArray(c.levels) || c.levels.length > 500) throw new Error('章节名称或关卡列表无效'); return { name: c.name, levels: c.levels.map(id => parseLevel(source.levels[id])) }; });
    for (const c of parsed) { const chapter = addChapter(next, c.name); for (const level of c.levels) { const oldId=level.id;level.id = uid('import'); addLevel(next, chapter, level);if(source.hiddenFromMenu?.includes(oldId))(next.hiddenFromMenu??=[]).push(level.id); } }
  } else { const level = parseLevel(raw); level.id = uid('import'); const chapter = next.chapters.find(c => c.levels.includes(next.active)) ?? next.chapters[0] ?? addChapter(next, '导入的庭院'); addLevel(next, chapter, level); }
  return next;
}
