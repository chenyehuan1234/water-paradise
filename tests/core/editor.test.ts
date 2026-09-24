import { describe, expect, it } from 'vitest';
import { EditorSession, loadDraft, saveDraft } from '../../src/editor/session';
import { createLevel, parseLevel, serializeLevel, validatePlayable } from '../../src/core/level';
import { examples } from '../../src/core/examples';
import { GameController } from '../../src/core/game';

describe('editor documents', () => {
  it('round-trips all examples and accepts incomplete drafts', () => {
    for (const example of examples) expect(parseLevel(serializeLevel(example.level))).toEqual(example.level);
    const draft = createLevel(); expect(parseLevel(serializeLevel(draft))).toEqual(draft); expect(validatePlayable(draft)).toHaveLength(2);
  });
  it('rejects malformed data, duplicate boxes and noninteger heights', () => {
    expect(() => parseLevel('{bad')).toThrow();
    const draft = createLevel(4, 4); draft.terrain[0][0] = 1.5;
    expect(() => parseLevel(serializeLevel(draft))).toThrow(/高度/);
    draft.terrain[0][0] = 0; draft.boxes = [{ id: 'a', x: 0, z: 0 }, { id: 'a', x: 1, z: 0 }];
    expect(() => parseLevel(serializeLevel(draft))).toThrow(/重复/);
    expect(() => parseLevel(JSON.stringify({ ...draft, version: 2 }))).toThrow(/version/);
  });
  it('treats a complete brush drag as one history entry', () => {
    const editor = new EditorSession(createLevel(4, 4)); editor.tool = 'raise'; editor.beginStroke();
    editor.paint({ x: 0, z: 0 }); editor.paint({ x: 0, z: 0 }); editor.paint({ x: 1, z: 0 }); editor.commitStroke();
    expect(editor.level.terrain[0].slice(0, 2)).toEqual([1, 1]);
    editor.undo(); expect(editor.level.terrain[0].slice(0, 2)).toEqual([0, 0]);
    editor.redo(); expect(editor.level.terrain[0].slice(0, 2)).toEqual([1, 1]);
  });
  it('removes occupants on erased cells and can undo the entire edit', () => {
    const editor = new EditorSession(examples[0].level); editor.tool = 'void'; editor.paint(editor.level.source!); editor.commitStroke();
    expect(editor.level.source).toBeNull(); editor.undo(); expect(editor.level).toEqual(examples[0].level);
  });
  it('playtesting clones the draft instead of moving its initial boxes', () => {
    const editor = new EditorSession(examples[0].level), before = serializeLevel(editor.level), game = new GameController(editor.level);
    game.act({ type: 'move', direction: 'south' }); expect(serializeLevel(editor.level)).toBe(before);
  });
  it('reports storage failure and does not delete corrupt drafts', () => {
    expect(saveDraft(createLevel(), { setItem() { throw new Error('quota'); } })).toContain('导出');
    expect(loadDraft({ getItem() { return '{bad'; } }).error).toContain('未被删除');
  });
});
