import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import type { LevelDataV2, WorldObject } from '../world/types';
import { materials } from './models';
import { worldCell } from './water';

/** Merge exposed stone walls while retaining each source block for picking. */
export function stoneArchitecture(level: LevelDataV2, stones: WorldObject[]): Group {
  const group = new Group(), occupied = new Set(stones.map(o => `${o.x},${o.y},${o.z}`));
  const wall:number[]=[],wallUv:number[]=[],cap:number[]=[],capUv:number[]=[];
  const faces = new Map<string,Set<string>>(), rims = new Map<string,Set<string>>();
  const has=(x:number,y:number,z:number)=>occupied.has(`${x},${y},${z}`);
  const add=(map:Map<string,Set<string>>,side:string,plane:number,u:number,y:number)=>{
    const k=`${side}:${plane}`;if(!map.has(k))map.set(k,new Set());map.get(k)!.add(`${u},${y}`);
  };
  function quad(target:number[],uv:number[],points:number[][],mapping:(p:number[])=>number[]){
    for(const i of [0,1,2,0,2,3]){target.push(...points[i]);uv.push(...mapping(points[i]));}
  }
  for(const o of stones){
    const [cx,cz]=worldCell(level,o.x,o.z),x0=cx-.5,x1=cx+.5,z0=cz-.5,z1=cz+.5,y0=o.y,y1=o.y+1;
    const exposedTop=!has(o.x,o.y+1,o.z);
    for(const [side,visible,plane,u] of [
      ['west',!has(o.x-1,o.y,o.z),o.x,o.z],['east',!has(o.x+1,o.y,o.z),o.x+1,o.z],
      ['north',!has(o.x,o.y,o.z-1),o.z,o.x],['south',!has(o.x,o.y,o.z+1),o.z+1,o.x],
    ] as const)if(visible){add(faces,side,plane,u,o.y);if(exposedTop)add(rims,side,plane,u,o.y);}
    if(exposedTop){
      const margin=.009,top=y1+.012;
      quad(cap,capUv,[[x0+margin,top,z0+margin],[x0+margin,top,z1-margin],[x1-margin,top,z1-margin],[x1-margin,top,z0+margin]],p=>[p[0],p[2]]);
    }
    if(!has(o.x,o.y-1,o.z))quad(wall,wallUv,[[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y0,z0]],p=>[p[0]*.45,p[2]*.45]);
  }
  const worldX=(x:number)=>x-level.width/2,worldZ=(z:number)=>z-level.depth/2;
  function wallQuad(side:string,plane:number,u0:number,u1:number,y0:number,y1:number,edge=false){
    const offset=edge?(side==='west'||side==='north'?-.002:.002):0;
    if(side==='west'){const x=worldX(plane)+offset,z0=worldZ(u0),z1=worldZ(u1);return [[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0]];}
    if(side==='east'){const x=worldX(plane)+offset,z0=worldZ(u0),z1=worldZ(u1);return [[x,y0,z1],[x,y0,z0],[x,y1,z0],[x,y1,z1]];}
    if(side==='north'){const z=worldZ(plane)+offset,x0=worldX(u0),x1=worldX(u1);return [[x1,y0,z],[x0,y0,z],[x0,y1,z],[x1,y1,z]];}
    const z=worldZ(plane)+offset,x0=worldX(u0),x1=worldX(u1);return [[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]];
  }
  function merge(map:Map<string,Set<string>>,target:number[],uv:number[],rim=false){
    for(const [id,cells] of map){const [side,rawPlane]=id.split(':'),plane=Number(rawPlane);while(cells.size){
      const [u,y]=cells.values().next().value!.split(',').map(Number);
      let width=1,height=1;while(cells.has(`${u+width},${y}`))width++;
      if(!rim)while(Array.from({length:width},(_,i)=>cells.has(`${u+i},${y+height}`)).every(Boolean))height++;
      for(let yy=y;yy<y+height;yy++)for(let uu=u;uu<u+width;uu++)cells.delete(`${uu},${yy}`);
      const points=wallQuad(side,plane,u,u+width,rim?y+.905:y,rim?y+1.012:y+height,rim);
      quad(target,uv,points,p=>side==='west'||side==='east'?[p[2]*.45,p[1]*.45]:[p[0]*.45,p[1]*.45]);
    }}
  }
  merge(faces,wall,wallUv);merge(rims,cap,capUv,true);
  for(const [positions,uvs,material] of [[wall,wallUv,materials.stone],[cap,capUv,materials.cap]] as const){
    if(!positions.length)continue;
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
    const mesh=new Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.generatedGeometry=true;group.add(mesh);
  }
  return group;
}
