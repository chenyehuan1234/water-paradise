import { parseLevel } from '../world/level';
import { clone, defaults, uid } from '../world/types';
import type { EditorSettings, LevelDataV2, ProjectData } from '../world/types';
import { addChapter, addLevel } from './project';

const DB = 'water-paradise-workshop';
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => { request.result.createObjectStore('levels', { keyPath: 'id' }); request.result.createObjectStore('meta'); request.result.createObjectStore('backups'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('另一个页面阻止了存储升级，请关闭旧页面')); }); }
function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function complete(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('保存事务已中止')); }); }
export class ProjectStore {
  private queue = Promise.resolve();
  migrationUnavailable = false;
  async loadCompleted():Promise<Set<string>>{const db=await open();try{const tx=db.transaction('meta','readonly'),done=complete(tx),ids=await request(tx.objectStore('meta').get('completed-levels'));await done;return new Set(Array.isArray(ids)?ids.filter((id):id is string=>typeof id==='string'):[]);}finally{db.close();}}
  async markCompleted(id:string):Promise<void>{const db=await open();try{const tx=db.transaction('meta','readwrite'),done=complete(tx),store=tx.objectStore('meta');const old=await request(store.get('completed-levels'));store.put([...new Set([...(Array.isArray(old)?old:[]),id])],'completed-levels');await done;}finally{db.close();}}
  async load(): Promise<ProjectData | null> {
    const db = await open(); try {
      const tx = db.transaction(['meta', 'levels'], 'readonly'), done = complete(tx);
      const [meta, records] = await Promise.all([request(tx.objectStore('meta').get('project')), request(tx.objectStore('levels').getAll())]); await done;
      if (!meta) return null;
      const p: ProjectData = { ...meta, levels: {}, settings: {} };
      for (const record of records as { id: string; level: LevelDataV2; settings: EditorSettings }[]) { p.levels[record.id] = parseLevel(record.level); p.settings[record.id] = { ...defaults(), ...record.settings }; }
      if (p.chapters.some(c => c.levels.some(id => !p.levels[id]))) throw new Error('保存的章节缺少关卡，未覆盖原始数据');
      return p;
    } finally { db.close(); }
  }
  save(project: ProjectData): Promise<void> {
    const snapshot = clone(project);
    const run = async () => { const db = await open(); try { const tx = db.transaction(['meta', 'levels'], 'readwrite'), done = complete(tx), store = tx.objectStore('levels');
      const { levels, settings, ...meta } = snapshot; tx.objectStore('meta').put(meta, 'project');
      for (const [id, level] of Object.entries(levels)) store.put({ id, level, settings: settings[id] ?? defaults() });
      const keys = store.getAllKeys(); keys.onsuccess = () => { for (const id of keys.result) if (!Object.hasOwn(levels, String(id))) store.delete(id); }; await done;
    } finally { db.close(); } };
    const next = this.queue.catch(() => {}).then(run); this.queue = next; return next;
  }
  async migrateLegacy(project: ProjectData): Promise<boolean> {
    const legacy = localStorage.getItem('water-paradise:editor:v1'); if (!legacy) return false;
    const db = await open(); try {
      const tx = db.transaction('backups', 'readonly'), saved = await request(tx.objectStore('backups').get('v1-draft')); if (saved) return false;
      const raw = JSON.parse(legacy), level = parseLevel(raw.level ?? raw);
      const chapter = addChapter(project, '旧版草稿 · 已迁移'); addLevel(project, chapter, level);
      await this.save(project);
      const backup = db.transaction('backups', 'readwrite'), done = complete(backup); backup.objectStore('backups').put(legacy, 'v1-draft'); await done;
      // The original localStorage entry deliberately remains untouched as a second backup.
      return true;
    } finally { db.close(); }
  }
  /** The old service only reads its own origin. The new origin validates and saves a copy. */
  async migrateOrigin4175(current: ProjectData | null): Promise<{ project: ProjectData; count: number } | null> {
    if (location.origin !== 'http://127.0.0.1:4180') return null;
    const db = await open();
    try { const tx = db.transaction('meta','readonly'), marker = await request(tx.objectStore('meta').get('migrated-4175')); if (marker) return null; }
    finally { db.close(); }
    const probe=await fetch('/__old-transfer-probe').then(r=>r.ok?r.json():{available:false}).catch(()=>({available:false}));
    if(!probe.available) { this.migrationUnavailable=true; return null; }
    const nonce=crypto.randomUUID(), iframe=document.createElement('iframe');iframe.hidden=true;iframe.title='读取旧地址中的本地庭院';
    const payload=await new Promise<{ meta?: ProjectData; levels?: { id:string; level:LevelDataV2; settings:EditorSettings }[]; backups?: unknown[]; legacy?: string|null } | null>(resolve=>{
      let done=false;const finish=(value:typeof payload)=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',receive);iframe.remove();resolve(value);};
      const receive=(e:MessageEvent)=>{if(e.origin!=='http://127.0.0.1:4175'||e.source!==iframe.contentWindow||e.data?.type!=='water-paradise-transfer-response'||e.data.nonce!==nonce)return;finish(e.data.error?null:e.data.payload);};
      const timer=window.setTimeout(()=>finish(null),3000);window.addEventListener('message',receive);
      iframe.onload=()=>iframe.contentWindow?.postMessage({type:'water-paradise-transfer-request',nonce},'http://127.0.0.1:4175');
      iframe.src='http://127.0.0.1:4175/transfer.html';document.body.append(iframe);
    });
    if (!payload?.meta || !Array.isArray(payload.levels)) return null;
    const source=payload.meta;
    if (source.version!==2 || !Array.isArray(source.chapters) || source.chapters.length>200 || !Array.isArray(source.trash)) throw new Error('旧地址章节资料格式无效');
    const records=new Map(payload.levels.map(r=>[r.id,r]));
    const parsed:ProjectData={...clone(source),levels:{},settings:{}};
    for(const chapter of parsed.chapters){if(typeof chapter.id!=='string'||typeof chapter.name!=='string'||!Array.isArray(chapter.levels))throw new Error('旧地址章节无效');for(const id of chapter.levels){const row=records.get(id);if(!row)throw new Error(`旧地址关卡缺失：${id}`);parsed.levels[id]=parseLevel(row.level);parsed.settings[id]={...defaults(),...row.settings};}}
    for(const entry of parsed.trash){if(!Array.isArray(entry.levels))throw new Error('旧地址回收站无效');entry.levels=entry.levels.map(level=>parseLevel(level));}
    const next=current?clone(current):parsed;
    if(current){const ids=new Map<string,string>();for(const chapter of parsed.chapters){const copy={...chapter,id:uid('chapter'),levels:[] as string[]};next.chapters.push(copy);for(const oldId of chapter.levels){const id=uid('migrated'),level=clone(parsed.levels[oldId]);level.id=id;level.name += ' · 旧址副本';ids.set(oldId,id);next.levels[id]=level;next.settings[id]=clone(parsed.settings[oldId]);copy.levels.push(id);}}
      for(const entry of parsed.trash){const copy=clone(entry);copy.id=uid('trash');copy.chapterId=uid('chapter');copy.levels=copy.levels.map(level=>({...level,id:uid('recovered')}));next.trash.push(copy);}
    }
    // Back up both sides before committing the merged project. Neither old store is modified.
    const backupDb=await open();try{const tx=backupDb.transaction('backups','readwrite'),done=complete(tx);tx.objectStore('backups').put({incoming:payload,current,at:new Date().toISOString()},'from-4175');await done;}finally{backupDb.close();}
    await this.save(next);
    const verified=await this.load();if(!verified||Object.keys(verified.levels).length<Object.keys(next.levels).length)throw new Error('新地址保存校验失败；旧地址资料未删除');
    const markerDb=await open();try{const tx=markerDb.transaction('meta','readwrite'),done=complete(tx);tx.objectStore('meta').put({at:new Date().toISOString(),count:Object.keys(parsed.levels).length},'migrated-4175');await done;}finally{markerDb.close();}
    return {project:verified,count:Object.keys(parsed.levels).length};
  }
}
