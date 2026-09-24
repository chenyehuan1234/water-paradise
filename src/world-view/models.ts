import { CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SphereGeometry, TorusGeometry, SRGBColorSpace, ConeGeometry, Shape, ExtrudeGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjectKind } from '../world/types';

const box = new RoundedBoxGeometry(1, 1, 1, 1, .055), sphere = new SphereGeometry(1, 12, 8), pole = new CylinderGeometry(1, 1, 1, 8), cone = new ConeGeometry(1, 1, 8), ring = new TorusGeometry(.115, .023, 6, 16);
const matte = (color: string, roughness = .82, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });
export const materials = { stone: matte('#ccb899'), cap: matte('#e6bfae'), cream: matte('#f2dcc0'), wood: matte('#d98b54'), grain: matte('#a85f3e'), iron: matte('#d0ae68', .38, .5), dark: matte('#455f60', .5, .45), silver: matte('#e3d7bd', .4, .45), purple: matte('#8271ad', .55), lavender: matte('#b5a0d8', .5), shadow: matte('#57476f'), eye: matte('#caf4d3', .28), pupil: matte('#263e46'), leaf: matte('#a5bb72'), leafLight: matte('#c3d183'), aqua: matte('#8abbbe'), boat: matte('#cf8d77'), glass: new MeshStandardMaterial({ color: '#90bbc7', roughness: .18, transparent: true, opacity: .19, depthWrite: false, side: DoubleSide }) };

function texture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!; c.fillStyle = '#ded0b7'; c.fillRect(0,0,128,128);
  let seed = 918; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 650; i++) { c.fillStyle = `rgba(105,82,56,${rand()*.045})`; c.fillRect(rand()*128,rand()*128,3+rand()*18,1+rand()*7); }
  const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; return t;
}
let textured = false;
export function prepareMaterials() { if (textured) return; textured = true; materials.stone.map = texture(); materials.stone.color = new Color('#e4d5b9'); }
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
export function prototype(kind: ObjectKind): Group {
  const g = new Group(), m = materials;
  if (kind === 'stone' || kind === 'floating' || kind === 'barrier') {
    const h = kind === 'barrier' ? 2 : 1;
    b(g, kind === 'floating' ? m.aqua : m.stone, [0,h/2,0],[.975,h-.025,.975]);
    b(g, kind === 'barrier' ? m.cream : m.cap,[0,h-.055,0],[.99,.11,.99]);
    if (kind === 'floating') { b(g,m.iron,[0,.16,0],[1.005,.035,1.005]); part(g,cone,m.cream,[0,-.13,0],[.13,.24,.13],[0,0,Math.PI]); }
    if (kind === 'barrier') { b(g,m.cream,[0,.1,0],[1,.12,1]); b(g,m.dark,[0,1.5,-.493],[.19,.2,.02]); }
  }
  if (kind === 'wood' || kind === 'crate') {
    b(g,m.wood,[0,.5,0],[.9,.94,.9]);
    if (kind === 'wood') for (const z of [-.455,.455]) for (const x of [-.23,.23]) b(g,m.grain,[x,.48,z],[.014,.75,.012]);
    else { for (const y of [.1,.88]) b(g,m.silver,[0,y,0],[.94,.07,.94]); for (const x of [-.44,.44]) for (const z of [-.44,.44]) b(g,m.silver,[x,.49,z],[.055,.83,.055]); part(g,ring,m.silver,[0,.52,-.477],[1,1,1]); b(g,m.dark,[0,.58,-.455],[.14,.13,.025]); }
  }
  if (kind === 'bridge') { for (const x of [-.45,.45]) b(g,m.iron,[x,-.055,0],[.075,.11,1]); for (let z=-.45;z<=.5;z+=.225) b(g,m.iron,[0,-.045,z],[.94,.07,.052]); }
  if (kind === 'glass' || kind === 'open-glass') {
    const base = kind === 'glass' ? 0 : .3;
    const pane = b(g,m.glass,[0,(1+base)/2,-.493],[.95,1-base,.025]); pane.renderOrder = 4; pane.castShadow = false;
    for (const x of [-.48,.48]) b(g,m.dark,[x,.51,-.49],[.028,1.02,.028]);
    b(g,m.dark,[0,1,-.49],[1,.025,.028]); if (kind === 'glass') b(g,m.aqua,[0,.03,-.49],[.98,.045,.04]);
    // Restrained pointed arch makes the silhouette readable from the reference style.
    for (const side of [-1,1]) b(g,m.dark,[side*.245,.79,-.495],[.55,.021,.024],[0,0,side*.73]);
    if (kind === 'open-glass') for (const x of [-.32,0,.32]) b(g,m.iron,[x,.19,-.49],[.024,.24,.024]);
  }
  if (kind === 'boat') { b(g,m.boat,[0,-.025,0],[.98,.19,.96]); b(g,m.wood,[0,.055,0],[.9,.05,.86]); for (const x of [-.46,.46]) b(g,m.cream,[x,.06,0],[.055,.15,.9]); for (const z of [-.44,.44]) b(g,m.boat,[0,.065,z],[.93,.14,.06]); }
  if (kind === 'plant') { for (let i=0;i<9;i++) { const a=i*2.399, r=.14+(i%3)*.05; part(g,sphere,i%2?m.leaf:m.leafLight,[Math.cos(a)*r,.2+(i%4)*.1,Math.sin(a)*r],[.14,.24,.11],[.3*Math.cos(a),a,.4*Math.sin(a)]); } }
  if (kind === 'arch') { for (const x of [-.36,.36]) b(g,m.cream,[x,.55,0],[.12,1.1,.18]); for (const s of [-1,1]) b(g,m.cream,[s*.18,1.1,0],[.5,.13,.18],[0,0,s*.8]); b(g,m.lavender,[0,.6,.04],[.58,.85,.045]); for (const x of [-.14,.14]) b(g,m.dark,[x,.6,-.005],[.024,.8,.023]); }
  compact(g); g.updateMatrixWorld(true); return g;
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


