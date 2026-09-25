import type { ObjectKind, WorldObject } from './types';
export const catalog: Record<ObjectKind, { name: string; group: string; icon: string; color: string; description: string }> = {
  stone: { name: '庭院石块', group: '建筑', icon: '▰', color: '#d8bea0', description: '固定的一格实体。逐块堆叠，顶面可以站立。' },
  floating: { name: '浮空方块', group: '建筑', icon: '◇', color: '#91bfc0', description: '可以悬空的固定实体，挡水、承载角色。' },
  barrier: { name: '挡水石块', group: '建筑', icon: '✜', color: '#918577', description: '厚石座与十字石柱，两格高。挡人挡水，顶部不可站立。' },
  bridge: { name: '铁架桥板', group: '建筑', icon: '▤', color: '#bd995b', description: '水平承载面，水可穿过、下方可通行。只能从同高处走上。' },
  wood: { name: '木块', group: '可移动物件', icon: '▧', color: '#d68c57', description: '只能推，有重力，不浮水。整列与上方堆叠可以一起推动。' },
  crate: { name: '拉环箱子', group: '可移动物件', icon: '▣', color: '#ce8a64', description: '可以推，面朝同高箱子挂链后按空格拉近一格。' },
  boat: { name: '浮船', group: '可移动物件', icon: '⌑', color: '#ce9784', description: '深水与陆地均可同高推动，水花可驱动；从上方落入的首块物件会绑定。' },
  balance: { name: '五格天平', group: '机关', icon: '⚖', color: '#75b49e', description: '固定五格宽，两端称重升降；支柱高度可设置，水能穿过。' },
  'balance-end': { name: '天平端点', group: '内部', icon: '', color: '#75b49e', description: '运行时承载面。' },
  'balance-rail': { name: '天平横杆', group: '内部', icon: '', color: '#75b49e', description: '运行时中段碰撞。' },
  'balance-pillar': { name: '天平支柱', group: '内部', icon: '', color: '#75b49e', description: '运行时中心碰撞。' },
  glass: { name: '实心玻璃', group: '水路设施', icon: '▯', color: '#8fbcc6', description: '放在格子边界。挡人挡水，不可翻越，可叠放。' },
  'open-glass': { name: '金饰开口栏', group: '水路设施', icon: '♧', color: '#d7aa58', description: '金色镂空花饰，挡人但允许水流过。' },
  'stone-fence': { name: '挡水石栅栏', group: '水路设施', icon: '◇', color: '#cbb79d', description: '放在格子边界。挡人挡水、不可攀爬，可叠放；菱形开孔为装饰。' },
  plant: { name: '庭院植物', group: '装饰', icon: '♧', color: '#99b576', description: '无碰撞与水流机制的叶簇。' },
  arch: { name: '石窗拱饰', group: '装饰', icon: '∩', color: '#cbbb9e', description: '纯装饰拱窗，不提供承载与碰撞。' },
};
export const dynamic = (o: WorldObject) => o.kind === 'wood' || o.kind === 'crate' || o.kind === 'boat';
export const edgePanel = (o: WorldObject) => o.kind === 'glass' || o.kind === 'open-glass' || o.kind === 'stone-fence';
export const solid = (o: WorldObject) => ['stone', 'floating', 'wood', 'crate', 'barrier', 'boat', 'balance-rail', 'balance-pillar'].includes(o.kind);
export const waterSolid = (o: WorldObject) => solid(o) && !['boat','balance-rail','balance-pillar'].includes(o.kind);
// Boat y is its deck, not its hull bottom. Only the first bound load occupies a cell.
export const height = (o: WorldObject) => o.kind === 'barrier' ? 2 : o.kind === 'balance-pillar' ? o.mastHeight ?? 1 : o.kind === 'boat' ? (o.cargo?.length ? 1 : 0) : ['bridge','balance','balance-end','plant','arch'].includes(o.kind) ? 0 : 1;
export const standable = (o: WorldObject) => (solid(o) && !['barrier','balance-rail','balance-pillar'].includes(o.kind)) || o.kind === 'bridge' || o.kind === 'balance-end';
export const top = (o: WorldObject) => o.y + height(o);
