import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, ShaderMaterial } from 'three';
import { DIRS as DIRECTIONS } from '../world/types';
import type { LevelDataV2, WaterEdge, WaterSolution } from '../world/types';

const quad = [0, 1, 2, 0, 2, 3];
const surfaceVertex = `
  uniform float progress;
  attribute float previousY;
  attribute vec2 visibility;
  attribute float waterDepth;
  attribute vec4 edges;
  varying vec2 vUv; varying vec2 vWorld; varying float vAlpha; varying float vDepth; varying vec4 vEdges;
  void main() {
    vec3 p = position; p.y = mix(previousY, position.y, progress);
    vUv=uv; vWorld=position.xz; vAlpha=mix(visibility.x,visibility.y,progress); vDepth=waterDepth; vEdges=edges;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }
`;
const surfaceFragment = `
  uniform float time; uniform float showDepth;
  uniform vec3 deepColor; uniform vec3 lightColor; uniform vec3 foamColor;
  varying vec2 vUv; varying vec2 vWorld; varying float vAlpha; varying float vDepth; varying vec4 vEdges;
  void main() {
    if(vAlpha<.002) discard;
    vec2 q=vWorld+vec2(.075,.12)*time;
    float wave=sin(q.x*3.5+sin(q.y*3.6))*sin(q.y*4.2-q.x);
    float line=pow(max(0.0,1.0-abs(sin(q.x*5.8+sin(q.y*4.3)*1.4))),14.0);
    float edge=min(min(mix(10.0,vUv.x,vEdges.x),mix(10.0,1.0-vUv.x,vEdges.y)),min(mix(10.0,vUv.y,vEdges.z),mix(10.0,1.0-vUv.y,vEdges.w)));
    float wobble=.008*sin(vWorld.x*24.0+time)+.008*sin(vWorld.y*21.0-time);
    float foam=1.0-smoothstep(.012,.048,edge+wobble);
    float depthAmount=clamp(vDepth*.15,0.0,.65);
    vec3 color=mix(lightColor,deepColor,.35+depthAmount+wave*.10);
    color=mix(color,foamColor,foam*.8+line*.20);
    color=mix(color,mix(vec3(.36,.78,.69),vec3(.04,.26,.40),clamp(vDepth/6.0,0.0,1.0)),showDepth*.6);
    gl_FragColor=vec4(color,vAlpha*(vDepth>.01?.68:.48));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const fallVertex = `
  uniform float progress; attribute vec3 previousPosition; attribute vec2 visibility;
  varying vec2 vUv; varying float vAlpha;
  void main(){vUv=uv;vAlpha=mix(visibility.x,visibility.y,progress);gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(previousPosition,position,progress),1.0);}
`;
const fallFragment = `
  uniform float time; varying vec2 vUv; varying float vAlpha;
  void main(){
    if(vAlpha<.002) discard;
    float stream=sin(vUv.x*65.0+sin(vUv.y*13.0+time*2.6));
    float fine=pow(max(0.0,sin(vUv.x*111.0+sin(vUv.y*6.0+time*3.0))),8.0);
    float edge=1.0-smoothstep(.01,.12,min(vUv.x,1.0-vUv.x));
    vec3 color=mix(vec3(.035,.25,.33),vec3(.80,.94,.87),.16+stream*.10+fine*.24+edge*.40);
    gl_FragColor=vec4(color,(.62+fine*.15+edge*.17)*vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
interface SurfaceTransition { fromY: number; toY: number; fromAlpha: number; toAlpha: number; x: number; z: number; depth: number; edges: number[] }
interface FallTransition { from: number[][]; to: number[][]; fromAlpha: number; toAlpha: number }
export function skyHeight(water: WaterSolution) { return Math.max(0, ...water.cells.map(c => c.y)) + 4; }
export const worldCell = (level: LevelDataV2, x: number, z: number): [number, number] => [x - (level.width - 1) / 2, z - (level.depth - 1) / 2];

export class WaterLayer {
  readonly group = new Group();
  private surfaces = new Map<string, SurfaceTransition>();
  private falls = new Map<string, FallTransition>();
  private progress = 1;
  duration = .32;
  private elapsed = 0;
  private surfaceMaterial = new ShaderMaterial({
    uniforms: { time: { value: 0 }, progress: { value: 1 }, showDepth: { value: 0 }, deepColor: { value: new Color('#286f9c') }, lightColor: { value: new Color('#78bfce') }, foamColor: { value: new Color('#f2f6e5') } },
    vertexShader: surfaceVertex, fragmentShader: surfaceFragment, transparent: true, depthWrite: false, side: DoubleSide,
  });
  private fallMaterial = new ShaderMaterial({ uniforms: { time: { value: 0 }, progress: { value: 1 } }, vertexShader: fallVertex, fragmentShader: fallFragment, transparent: true, depthWrite: false, side: DoubleSide });
  private top = new Mesh(new BufferGeometry(), this.surfaceMaterial);
  private curtains = new Mesh(new BufferGeometry(), this.fallMaterial);
  constructor() { this.top.renderOrder = 2; this.curtains.renderOrder = 3; this.top.frustumCulled = false; this.curtains.frustumCulled = false; this.group.add(this.top, this.curtains); }

  setSolution(level: LevelDataV2, water: WaterSolution, animate: boolean) {
    const next = new Map<string, SurfaceTransition>();
    const wetSurfaces = new Set(water.cells.filter(c => c.kind !== 'dry' && c.surface).map(c => `${c.x},${c.level},${c.z}`));
    for (const cell of water.cells) {
      if (cell.kind === 'dry' || !cell.surface) continue;
      const key = cell.id, old = this.surfaces.get(key), [x,z] = worldCell(level, cell.x, cell.z);
      const edge = (dx: number, dz: number) => wetSurfaces.has(`${cell.x+dx},${cell.level},${cell.z+dz}`) ? 0 : 1;
      next.set(key, { x, z, fromY: old ? old.fromY+(old.toY-old.fromY)*this.progress : cell.y+.025, toY: cell.level+.025, fromAlpha: old ? old.fromAlpha+(old.toAlpha-old.fromAlpha)*this.progress : 0, toAlpha: 1, depth: cell.depth, edges: [edge(-1,0),edge(1,0),edge(0,-1),edge(0,1)] });
    }
    if (animate) for (const [key, old] of this.surfaces) if (!next.has(key) && old.toAlpha > 0) next.set(key, { ...old, fromY: old.fromY+(old.toY-old.fromY)*this.progress, fromAlpha: old.fromAlpha+(old.toAlpha-old.fromAlpha)*this.progress, toAlpha: 0 });
    this.surfaces = next;
    const nextFalls = new Map<string, number[][]>();
    const edgeQuad = (edge: WaterEdge) => {
      const dir = DIRECTIONS.find(d => d.name === edge.direction)!, [x,z] = worldCell(level,edge.x,edge.z), cx=x+dir.x*.5, cz=z+dir.z*.5, tx=-dir.z*.5, tz=dir.x*.5;
      return [[cx-tx,edge.to+.025,cz-tz],[cx+tx,edge.to+.025,cz+tz],[cx+tx,edge.from+.025,cz+tz],[cx-tx,edge.from+.025,cz-tz]];
    };
    for (const edge of [...water.falls,...water.outlets]) nextFalls.set(edge.id,edgeQuad(edge));
    if (level.source) {
      const cell = water.sourceLanding;
      if (cell) {
        const [x,z] = worldCell(level,cell.x,cell.z), top=skyHeight(water), bottom=cell.y+.03, w=.13;
        nextFalls.set('source-x',[[x-w,bottom,z],[x+w,bottom,z],[x+w,top,z],[x-w,top,z]]);
        nextFalls.set('source-z',[[x,bottom,z-w],[x,bottom,z+w],[x,top,z+w],[x,top,z-w]]);
      }
    }
    const fallTransitions = new Map<string,FallTransition>();
    const displayPoints = (old: FallTransition) => old.from.map((p,i)=>p.map((v,j)=>v+(old.to[i][j]-v)*this.progress));
    for (const [id,points] of nextFalls) { const old=this.falls.get(id); fallTransitions.set(id,{from:old?displayPoints(old):points,to:points,fromAlpha:old?old.fromAlpha+(old.toAlpha-old.fromAlpha)*this.progress:0,toAlpha:1}); }
    if (animate) for (const [id,old] of this.falls) if (!nextFalls.has(id) && old.toAlpha>0) fallTransitions.set(id,{...old,from:displayPoints(old),fromAlpha:old.fromAlpha+(old.toAlpha-old.fromAlpha)*this.progress,toAlpha:0});
    this.falls=fallTransitions; this.progress=animate?0:1;
    this.rebuild(); this.update(0,false);
  }

  private rebuild() {
    const positions:number[]=[],uvs:number[]=[],previous:number[]=[],visibility:number[]=[],depths:number[]=[],edges:number[]=[];
    const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    for(const cell of this.surfaces.values())for(const i of quad){const [dx,dz]=corners[i];positions.push(cell.x+dx,cell.toY,cell.z+dz);uvs.push(dx+.5,dz+.5);previous.push(cell.fromY);visibility.push(cell.fromAlpha,cell.toAlpha);depths.push(cell.depth);edges.push(...cell.edges);}
    const geometry=new BufferGeometry();
    for(const [name,values,size] of [['position',positions,3],['uv',uvs,2],['previousY',previous,1],['visibility',visibility,2],['waterDepth',depths,1],['edges',edges,4]] as const)geometry.setAttribute(name,new Float32BufferAttribute(values,size));
    this.top.geometry.dispose();this.top.geometry=geometry;
    const fp:number[]=[],fu:number[]=[],oldp:number[]=[],fa:number[]=[],uv=[[0,0],[1,0],[1,1],[0,1]];
    for(const fall of this.falls.values())for(const i of quad){fp.push(...fall.to[i]);oldp.push(...fall.from[i]);fu.push(...uv[i]);fa.push(fall.fromAlpha,fall.toAlpha);}
    const fg=new BufferGeometry();
    for(const [name,values,size]of [['position',fp,3],['previousPosition',oldp,3],['uv',fu,2],['visibility',fa,2]] as const)fg.setAttribute(name,new Float32BufferAttribute(values,size));
    this.curtains.geometry.dispose();this.curtains.geometry=fg;
  }
  setDepthVisible(visible:boolean){this.surfaceMaterial.uniforms.showDepth.value=visible?1:0;}
  update(delta:number,paused:boolean){if(!paused)this.elapsed+=delta;this.progress=Math.min(1,this.progress+delta/this.duration);for(const material of [this.surfaceMaterial,this.fallMaterial]){material.uniforms.time.value=this.elapsed;material.uniforms.progress.value=this.progress;}}
  finish(){this.progress=1;this.update(0,true);}
  get snapshot(){return {progress:this.progress,surfaces:[...this.surfaces].map(([id,c])=>({id,y:c.fromY+(c.toY-c.fromY)*this.progress,alpha:c.fromAlpha+(c.toAlpha-c.fromAlpha)*this.progress})),falls:[...this.falls].map(([id,c])=>({id,points:c.from.map((p,i)=>p.map((v,j)=>v+(c.to[i][j]-v)*this.progress))}))};}
  get time(){return this.elapsed;}
  dispose(){this.top.geometry.dispose();this.curtains.geometry.dispose();this.surfaceMaterial.dispose();this.fallMaterial.dispose();}
}

