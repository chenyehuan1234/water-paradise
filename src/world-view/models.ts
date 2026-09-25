import { CanvasTexture, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SphereGeometry, TorusGeometry, SRGBColorSpace, ConeGeometry, Shape, Path, ExtrudeGeometry, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjectKind } from '../world/types';

const box = new RoundedBoxGeometry(1, 1, 1, 1, .055), sphere = new SphereGeometry(1, 12, 8), pole = new CylinderGeometry(1, 1, 1, 8), cone = new ConeGeometry(1, 1, 8), ring = new TorusGeometry(.115, .023, 6, 16);
const matte = (color: string, roughness = .82, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });
export const materials = { stone: matte('#9a887b'), cap: matte('#efd2c5'), cream: matte('#f2dcc0'), barrier:matte('#918577'), barrierEdge:matte('#b4a899'), wood: matte('#d98b54'), grain: matte('#a85f3e'), crate:matte('#c9794b',.72),crateTop:matte('#eba571',.63), iron: matte('#e0b44e', .3, .55), dark: matte('#455f60', .5, .45), silver: matte('#e3d7bd', .4, .45), purple: matte('#8271ad', .55), lavender: matte('#b5a0d8', .5), shadow: matte('#57476f'), eye: matte('#caf4d3', .28), pupil: matte('#263e46'), leaf: matte('#a5bb72'), leafLight: matte('#c3d183'), aqua: matte('#8abbbe'), boat: matte('#bd7866'), boatLiner:matte('#eca88e'), boatInside:matte('#d88775'), balance:matte('#86bea8',.43,.16), glass: new MeshStandardMaterial({ color: '#a5cdd1', roughness: .15, transparent: true, opacity: .24, depthWrite: false, side: DoubleSide }) };

function texture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!; c.fillStyle = '#ded0b7'; c.fillRect(0,0,128,128);
  let seed = 918; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 650; i++) { c.fillStyle = `rgba(105,82,56,${rand()*.045})`; c.fillRect(rand()*128,rand()*128,3+rand()*18,1+rand()*7); }
  const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; return t;
}
let textured = false;
export function prepareMaterials() { if (textured) return; textured = true; materials.stone.map = texture(); materials.stone.color = new Color('#a59287'); }
function part(g: Group, geometry: typeof box | typeof sphere | typeof pole | typeof ring | ExtrudeGeometry, material: MeshStandardMaterial, pos: number[], scale: number[], rotation?: number[]) {
  const m = new Mesh(geometry, material); m.position.set(pos[0], pos[1], pos[2]); m.scale.set(scale[0], scale[1], scale[2]); if (rotation) m.rotation.set(rotation[0],rotation[1],rotation[2]); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
const b = (g: Group, m: MeshStandardMaterial, p: number[], s: number[], r?: number[]) => part(g, box, m, p, s, r);
function compact(g:Group){
  for(const child of g.children)if(child instanceof Group)compact(child);
  const groups=new Map<MeshStandardMaterial,Mesh[]>();
  for(const child of g.children)if(child instanceof Mesh&&child.material instanceof MeshStandardMaterial){if(!groups.has(child.material))groups.set(child.material,[]);groups.get(child.material)!.push(child);}
  for(const [material,parts]of groups){if(parts.length<2)continue;const copies=parts.map(p=>{p.updateMatrix();return (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()).applyMatrix4(p.matrix);});const merged=mergeGeometries(copies);for(const c of copies)c.dispose();if(!merged)continue;const mesh=new Mesh(merged,material);mesh.castShadow=parts[0].castShadow;mesh.receiveShadow=true;mesh.renderOrder=parts[0].renderOrder;for(const p of parts)g.remove(p);g.add(mesh);}
}
/** Shared frame bits: left, right, bottom, top. Visual joining never joins logical objects. */
export function prototype(kind: ObjectKind, join = 0): Group {
  const g = new Group(), m = materials;
  if (kind === 'stone' || kind === 'floating') {
    const h = 1;
    b(g, kind === 'floating' ? m.aqua : m.stone, [0,h/2,0],[.975,h-.025,.975]);
    b(g,m.cap,[0,h-.055,0],[.99,.11,.99]);
    if (kind === 'floating') { b(g,m.iron,[0,.16,0],[1.005,.035,1.005]); part(g,cone,m.cream,[0,-.13,0],[.13,.24,.13],[0,0,Math.PI]); }
  }
  if(kind==='barrier'){
    // A weighty carved plinth with a rounded cross-shaped finial. Its full
    // two-cell collision remains independent of this decorative silhouette.
    b(g,m.barrier,[0,.47,0],[.94,.94,.94]);
    b(g,m.barrierEdge,[0,.93,0],[.78,.12,.78]);
    b(g,m.barrier,[0,1.03,0],[.56,.16,.56]);
    b(g,m.barrier,[0,1.40,0],[.23,.70,.23]);
    b(g,m.barrier,[0,1.67,0],[.72,.20,.22]);
    for(const x of [-.36,.36])part(g,sphere,m.barrier,[x,1.67,0],[.115,.115,.115]);
    part(g,sphere,m.barrier,[0,1.91,0],[.13,.14,.13]);
  }
  if (kind === 'wood') {
    b(g,m.wood,[0,.5,0],[.9,.94,.9]);
    for (const z of [-.455,.455]) for (const x of [-.23,.23]) b(g,m.grain,[x,.48,z],[.014,.75,.012]);
  }
  if(kind==='crate'){
    part(g,new CylinderGeometry(.64,.56,.78,4),m.crate,[0,.48,0],[1,1,1],[0,Math.PI/4,0]);
    b(g,m.silver,[0,.9,0],[.98,.095,.98]);
    b(g,m.crateTop,[0,.953,0],[.75,.024,.75]);
    for(const z of [-.455,.455])for(const x of [-.27,.27]){
      b(g,m.silver,[x,.81,z],[.14,.12,.07]);
      part(g,ring,m.silver,[x,.75,z+(z<0?-.055:.055)],[1.25,1.25,1.25]);
    }
  }
  if (kind === 'bridge') {
    // Dark structural rails stay legible through a deep-water surface; gold
    // crossbars keep the lighter wrought-metal look from the reference.
    for (const x of [-.46,.46]) { b(g,m.dark,[x,-.035,0],[.10,.14,1]);b(g,m.iron,[x,.045,0],[.055,.025,1]); }
    for (let z=-.45;z<=.5;z+=.18) { b(g,m.dark,[0,-.068,z],[.91,.025,.064]);b(g,m.iron,[0,-.025,z],[.88,.08,.048]); }
  }
  if (kind === 'glass' || kind === 'open-glass' || kind === 'stone-fence') {
    const left=!(join&1),right=!(join&2),bottom=!(join&4),top=!(join&8),z=-.493;
    if(kind==='glass'){
      const pane=b(g,m.glass,[0,.5,z],[1,1,.025]);pane.renderOrder=4;pane.castShadow=false;
      if(left)b(g,m.dark,[-.49,.5,z],[.035,1.02,.05]);if(right)b(g,m.dark,[.49,.5,z],[.035,1.02,.05]);
      if(bottom)b(g,m.aqua,[0,.025,z],[1,.05,.06]);if(top)b(g,m.dark,[0,.985,z],[1,.04,.06]);
      // A single broad etched sweep reads across neighbours without a frame on every tile.
      for(const side of [-1,1])b(g,m.silver,[side*.29,.72,z-.014],[.55,.012,.012],[0,0,side*.68]);
    }else if(kind==='open-glass'){
      if(left)b(g,m.iron,[-.49,.5,z],[.047,1.02,.055]);if(right)b(g,m.iron,[.49,.5,z],[.047,1.02,.055]);
      if(bottom)b(g,m.iron,[0,.025,z],[1,.05,.055]);if(top)b(g,m.iron,[0,.985,z],[1,.05,.055]);
      // Gold arch, paired curls and a clear open centre: deliberately unlike the blue solid pane.
      for(const side of [-1,1]){
        b(g,m.iron,[side*.245,.66,z],[.59,.027,.038],[0,0,side*.83]);
        b(g,m.iron,[side*.23,.25,z],[.47,.025,.038],[0,0,-side*.62]);
        part(g,new TorusGeometry(.13,.018,5,12,Math.PI*1.5),m.iron,[side*.25,.22,z],[1,1,1],[0,0,side>0?.2:Math.PI]);
      }
      b(g,m.cream,[0,.78,z],[.065,.065,.05],[0,0,Math.PI/4]);
    }else{
      const shape=new Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(.5,1);shape.lineTo(-.5,1);shape.closePath();
      const hole=new Path();hole.moveTo(0,.19);hole.lineTo(.31,.5);hole.lineTo(0,.81);hole.lineTo(-.31,.5);hole.closePath();shape.holes.push(hole);
      part(g,new ExtrudeGeometry(shape,{depth:.105,steps:1,bevelEnabled:false}),m.stone,[0,0,z-.052],[1,1,1]);
      const inset=b(g,m.glass,[0,.5,z-.064],[.4,.4,.01],[0,0,Math.PI/4]);inset.renderOrder=4;inset.castShadow=false;
      if(left)b(g,m.cream,[-.49,.5,z],[.045,1,.13]);if(right)b(g,m.cream,[.49,.5,z],[.045,1,.13]);
      if(bottom)b(g,m.cap,[0,.035,z],[1,.07,.14]);if(top)b(g,m.cap,[0,.965,z],[1,.07,.14]);
    }
  }
  if (kind === 'boat') {
    // A shallow hollow hull: the dark inset sits below the deck, while the
    // long side profiles curl upward at the pointed bow and stern.
    const hull=new Group();hull.position.y=.25;g.add(hull);
    b(hull,m.boat,[0,-.37,0],[.72,.10,.84]);
    b(hull,m.boatInside,[0,-.305,0],[.62,.025,.68]);
    const side=new Shape();side.moveTo(-.47,-.38);side.quadraticCurveTo(-.54,-.20,-.47,.13);side.lineTo(-.42,.16);side.quadraticCurveTo(-.37,-.16,-.23,-.18);side.quadraticCurveTo(0,-.22,.23,-.18);side.quadraticCurveTo(.37,-.16,.42,.16);side.lineTo(.47,.13);side.quadraticCurveTo(.54,-.20,.47,-.38);side.closePath();
    const sideGeometry=new ExtrudeGeometry(side,{depth:.09,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.025,bevelThickness:.02,curveSegments:10});
    part(hull,sideGeometry,m.boat,[-.43,0,0],[1,1,1],[0,Math.PI/2,0]);
    part(hull,sideGeometry,m.boat,[.34,0,0],[1,1,1],[0,Math.PI/2,0]);
    for(const x of [-.36,.36]){
      const points=[new Vector3(x,-.12,-.39),new Vector3(x,-.17,-.24),new Vector3(x,-.19,0),new Vector3(x,-.17,.24),new Vector3(x,-.12,.39)];
      const rim=new Mesh(new TubeGeometry(new CatmullRomCurve3(points),16,.022,6,false),m.boatLiner);rim.castShadow=true;hull.add(rim);
    }
    for(const z of [-.4,.4]){
      b(hull,m.boat,[0,-.23,z],[.77,.21,.115],[z<0?-.14:.14,0,0]);
      b(hull,m.boatLiner,[0,-.12,z*.98],[.62,.035,.08],[z<0?-.14:.14,0,0]);
      for(const x of [-.37,.37])part(hull,cone,m.boatLiner,[x,.025,z*1.08],[.065,.22,.06],[z<0?-.16:.16,0,x<0?-.1:.1]);
    }
  }
  if (kind === 'plant') { for (let i=0;i<9;i++) { const a=i*2.399, r=.14+(i%3)*.05; part(g,sphere,i%2?m.leaf:m.leafLight,[Math.cos(a)*r,.2+(i%4)*.1,Math.sin(a)*r],[.14,.24,.11],[.3*Math.cos(a),a,.4*Math.sin(a)]); } }
  if (kind === 'arch') { for (const x of [-.36,.36]) b(g,m.cream,[x,.55,0],[.12,1.1,.18]); for (const s of [-1,1]) b(g,m.cream,[s*.18,1.1,0],[.5,.13,.18],[0,0,s*.8]); b(g,m.lavender,[0,.6,.04],[.58,.85,.045]); for (const x of [-.14,.14]) b(g,m.dark,[x,.6,-.005],[.024,.8,.023]); }
  compact(g); g.updateMatrixWorld(true); return g;
}
export interface BalanceModel { root:Group; ends:[Group,Group]; arms:[Mesh,Mesh]; pivot:number }
export function balanceModel(mastHeight:number):BalanceModel {
  const root=new Group(),m=materials,pivot=mastHeight;
  part(root,pole,m.balance,[0,pivot/2,0],[.15,pivot,.15]);
  b(root,m.balance,[0,pivot,0],[.56,.42,.35]);part(root,sphere,m.cream,[0,pivot,.2],[.13,.13,.07]);
  const ends:[Group,Group]=[new Group(),new Group()],arms:[Mesh,Mesh]=[new Mesh(box,m.balance),new Mesh(box,m.balance)];
  for(let i=0;i<2;i++){
    const side=i===0?-1:1,end=ends[i],arm=arms[i];end.position.set(side*2,pivot,0);
    b(end,m.balance,[0,-.055,0],[.98,.11,.92]);b(end,m.cream,[0,.008,0],[.86,.025,.80]);
    for(const z of [-.43,.43])b(end,m.balance,[0,-.015,z],[.94,.10,.045]);
    arm.castShadow=arm.receiveShadow=true;root.add(arm,end);
  }
  root.updateMatrixWorld(true);return{root,ends,arms,pivot};
}
export interface Gargoyle { root: Group; body: Group; head: Group; feet: Group[]; wings: Group[] }
export function gargoyle(): Gargoyle {
  const root = new Group(), body = new Group(), head = new Group(), feet: Group[] = [], wings: Group[] = [], m=materials; root.add(body); body.add(head); head.position.set(0,.48,-.19);
  part(body,sphere,m.purple,[0,.39,.05],[.27,.27,.32]); part(body,sphere,m.lavender,[0,.32,-.17],[.20,.22,.18]);
  part(head,sphere,m.purple,[0,.1,-.05],[.275,.23,.235]); b(head,m.lavender,[0,.015,-.24],[.31,.16,.19]);
  for (const s of [-1,1]) {
    part(head,sphere,m.shadow,[s*.13,.15,-.226],[.10,.073,.045]); part(head,sphere,m.eye,[s*.13,.15,-.255],[.074,.043,.026]); part(head,sphere,m.pupil,[s*.13,.15,-.277],[.018,.033,.012]);
    b(head,m.purple,[s*.13,.205,-.239],[.18,.045,.054],[0,0,s*.2]);
    part(head,cone,m.cream,[s*.205,.34,-.04],[.055,.23,.06],[0,0,-s*.32]); part(head,cone,m.purple,[s*.29,.17,.02],[.08,.2,.07],[0,0,-s*1.2]);
    part(head,sphere,m.shadow,[s*.075,.06,-.326],[.022,.016,.014]);
    const wing = new Group(); wing.position.set(s*.2,.46,.12); const shape = new Shape(); shape.moveTo(0,0); shape.lineTo(s*.3,.23); shape.lineTo(s*.46,.13); shape.lineTo(s*.35,-.14); shape.lineTo(s*.23,-.035); shape.lineTo(s*.12,-.13); shape.closePath();
    const geo = new ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.014,bevelThickness:.01}); part(wing,geo,m.shadow,[0,0,0],[1,1,1]); b(wing,m.lavender,[s*.17,.1,-.015],[.38,.035,.034],[0,0,s*.56]); body.add(wing); wings.push(wing);
  }
  for (const z of [-.23,.25]) for (const s of [-1,1]) { const foot = new Group(); foot.position.set(s*.22,.18,z); part(foot,sphere,m.purple,[0,0,0],[.083,.17,.105]); b(foot,m.lavender,[0,-.105,-.045],[.17,.09,.2]); for(const x of [-.045,.045]) part(foot,cone,m.cream,[x,-.1,-.155],[.02,.055,.02],[Math.PI/2,0,0]); root.add(foot); feet.push(foot); }
  part(body,cone,m.purple,[0,.23,.44],[.075,.32,.075],[Math.PI*.68,0,0]);
  compact(root); return { root, body, head, feet, wings };
}


