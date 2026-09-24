import {
  BufferGeometry, CanvasTexture, CapsuleGeometry, Color, ConeGeometry, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshStandardMaterial,
  Object3D, PlaneGeometry, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Modules } from '../scene/modules';
import { createMaterials } from '../scene/materials';
import { DIRECTIONS, groundAt } from '../core/types';
import type { Box, Cell, LevelDataV1, WaterSolution } from '../core/types';
import { WaterLayer, worldCell } from './water-layer';

interface Motion { object: Object3D; from: Vector3; to: Vector3; elapsed: number }
export interface BoardDebug { grid: boolean; outlets: boolean; depths: boolean }

export class BoardScene {
  readonly root = new Group();
  readonly water = new WaterLayer();
  readonly pickTargets: InstancedMesh[] = [];
  private terrain: Modules | null = null;
  private terrainInstances: InstancedMesh[] = [];
  private grid = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: '#467966', transparent: true, opacity: .52, depthWrite: false }));
  private hover = new LineLoop(new BufferGeometry().setFromPoints([new Vector3(-.48,0,-.48),new Vector3(.48,0,-.48),new Vector3(.48,0,.48),new Vector3(-.48,0,.48)]),new LineBasicMaterial({color:'#265946',depthTest:false}));
  private actor = new Group();
  private crateTexture: CanvasTexture;
  private crateMaterial: MeshStandardMaterial;
  private crateGeometry = new RoundedBoxGeometry(.98,1,.98,2,.055);
  private boxes = new InstancedMesh(this.crateGeometry, new MeshStandardMaterial(), 0);
  private boxCount = -1;
  private outletGeometry = new ConeGeometry(.1,.29,3);
  private outletMaterial = new MeshStandardMaterial({color:'#ad693e',emissive:'#7f4b28',emissiveIntensity:.18,transparent:true,opacity:1,depthWrite:false});
  private outletMesh = new InstancedMesh(this.outletGeometry,this.outletMaterial,0);
  private labelTexture: CanvasTexture;
  private labelGeometry = new PlaneGeometry(.36,.36);
  private labelMaterial: ShaderMaterial;
  private labels: InstancedMesh;
  private terrainKey = '';
  private level: LevelDataV1 | null = null;
  private motions: Motion[] = [];
  private selected: Cell | null = null;
  private debug: BoardDebug = {grid:false,outlets:true,depths:false};

  constructor() {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#bd9979';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#7c7959';ctx.lineWidth=7;ctx.strokeRect(6,6,116,116);ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(14,14);ctx.lineTo(114,114);ctx.moveTo(114,14);ctx.lineTo(14,114);ctx.stroke();
    this.crateTexture=new CanvasTexture(canvas);this.crateTexture.colorSpace=SRGBColorSpace;
    this.crateMaterial=new MeshStandardMaterial({map:this.crateTexture,roughness:.83,transparent:true,opacity:1});
    (this.boxes.material as MeshStandardMaterial).dispose();this.boxes.material=this.crateMaterial;
    const cream=new MeshStandardMaterial({color:'#f9efda',roughness:.76,transparent:true,opacity:1});
    const coat=new MeshStandardMaterial({color:'#bd724c',roughness:.8,transparent:true,opacity:1});
    const body=new Mesh(new CapsuleGeometry(.15,.22,4,8),coat);body.position.y=.28;
    const head=new Mesh(new SphereGeometry(.14,12,8),cream);head.position.y=.61;
    const hat=new Mesh(new ConeGeometry(.2,.1,16),cream);hat.position.y=.75;
    this.actor.add(body,head,hat);this.actor.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.renderOrder=10;}});
    this.actor.visible=false;
    const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=64;
    const context=atlas.getContext('2d')!;context.textAlign='center';context.textBaseline='middle';context.font='bold 38px sans-serif';
    for(let i=0;i<16;i++){context.fillStyle='rgba(248,249,226,.9)';context.beginPath();context.roundRect(i*64+3,4,58,56,12);context.fill();context.fillStyle='#265d61';context.fillText(i===0?'~':String(i),i*64+32,34);}
    this.labelTexture=new CanvasTexture(atlas);this.labelTexture.colorSpace=SRGBColorSpace;
    this.labelMaterial=new ShaderMaterial({uniforms:{atlas:{value:this.labelTexture}},transparent:true,depthWrite:false,
      vertexShader:'attribute float labelIndex; varying vec2 vUv; void main(){vUv=vec2((uv.x+labelIndex)/16.0,uv.y);vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);gl_Position=projectionMatrix*(center+vec4(position.xy,0.0,0.0));}',
      fragmentShader:'uniform sampler2D atlas;varying vec2 vUv;void main(){vec4 c=texture2D(atlas,vUv);if(c.a<.05)discard;gl_FragColor=c; #include <colorspace_fragment> }'.replace('; #include',';\n#include').replace('> }','>\n}'),
    });
    this.labels=new InstancedMesh(this.labelGeometry,this.labelMaterial,0);
    this.labels.renderOrder=20;this.labels.frustumCulled=false;
    this.grid.renderOrder=6;this.hover.renderOrder=30;this.hover.visible=false;
    this.outletMesh.renderOrder=12;this.outletMesh.frustumCulled=false;
    this.root.add(this.water.group,this.actor,this.boxes,this.grid,this.hover,this.outletMesh,this.labels);
    this.setDebug(this.debug);
  }

  setState(level: LevelDataV1, boxes: readonly Box[], player: Cell | null, water: WaterSolution, animate: boolean) {
    const key=JSON.stringify([level.width,level.depth,level.terrain,level.decorations]);
    if(key!==this.terrainKey){this.terrainKey=key;this.buildTerrain(level);}
    this.level=level;
    this.water.setSolution(level,water,animate);
    const dummy=new Object3D();
    if(this.boxCount!==boxes.length){this.root.remove(this.boxes);this.boxes.dispose();this.boxes=new InstancedMesh(this.crateGeometry,this.crateMaterial,boxes.length);this.boxes.renderOrder=8;this.boxes.castShadow=true;this.boxes.receiveShadow=true;this.root.add(this.boxes);this.boxCount=boxes.length;}
    boxes.forEach((box,i)=>{const[x,z]=worldCell(level,box.x,box.z);dummy.position.set(x,groundAt(level,box)!+.5,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();this.boxes.setMatrixAt(i,dummy.matrix);});
    this.boxes.instanceMatrix.needsUpdate=true;this.boxes.computeBoundingSphere();
    if(player){const[x,z]=worldCell(level,player.x,player.z),target=new Vector3(x,(groundAt(level,player)??0)+.025,z);this.motions=[];if(animate&&this.actor.visible)this.motions.push({object:this.actor,from:this.actor.position.clone(),to:target,elapsed:0});else this.actor.position.copy(target);this.actor.visible=true;}
    else {this.actor.visible=false;this.motions=[];}
    this.root.remove(this.outletMesh);this.outletMesh.dispose();this.outletMesh=new InstancedMesh(this.outletGeometry,this.outletMaterial,water.outlets.length);this.outletMesh.renderOrder=12;
    water.outlets.forEach((edge,i)=>{const d=DIRECTIONS.find(v=>v.name===edge.direction)!,[x,z]=worldCell(level,edge.x,edge.z);dummy.position.set(x+d.x*.6,edge.from+.13,z+d.z*.6);dummy.scale.set(1,1,1);dummy.quaternion.setFromUnitVectors(Object3D.DEFAULT_UP,new Vector3(d.x,0,d.z));dummy.updateMatrix();this.outletMesh.setMatrixAt(i,dummy.matrix);});
    this.outletMesh.computeBoundingSphere();this.root.add(this.outletMesh);
    this.root.remove(this.labels);this.labels.dispose();
    this.labelGeometry.dispose();this.labelGeometry=new PlaneGeometry(.36,.36);
    const wet=water.cells.flat().filter(cell=>cell&&cell.kind!=='dry');
    this.labels=new InstancedMesh(this.labelGeometry,this.labelMaterial,wet.length);this.labels.renderOrder=20;this.labels.frustumCulled=false;
    const labelIndices=new Float32Array(wet.length);
    wet.forEach((cell,i)=>{const[x,z]=worldCell(level,cell!.x,cell!.z);dummy.position.set(x,cell!.level+.2,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();this.labels.setMatrixAt(i,dummy.matrix);labelIndices[i]=cell!.depth;});
    this.labelGeometry.setAttribute('labelIndex',new InstancedBufferAttribute(labelIndices,1));this.root.add(this.labels);
    this.setDebug(this.debug);this.setHover(this.selected);
  }

  private buildTerrain(level:LevelDataV1){
    if(this.terrain){this.root.remove(this.terrain.group);this.terrain.dispose();}
    for(const mesh of this.terrainInstances){mesh.dispose();mesh.geometry.dispose();}
    this.terrainInstances=[];this.pickTargets.length=0;
    const m=new Modules(createMaterials());this.terrain=m;
    const layers=new Map<number,Cell[]>();
    for(let z=0;z<level.depth;z++)for(let x=0;x<level.width;x++){const h=level.terrain[z][x];if(h===null)continue;const bucket=layers.get(h)??[];bucket.push({x,z});layers.set(h,bucket);}
    const dummy=new Object3D();
    for(const[h,cells]of layers){
      const bodyGeometry=new RoundedBoxGeometry(.98,h+1.1,.98,2,.035);
      const body=new InstancedMesh(bodyGeometry,m.materials.stone,cells.length);
      const caps=new InstancedMesh(new RoundedBoxGeometry(.98,.13,.98,2,.027),h>0?m.materials.cap:m.materials.light,cells.length);
      cells.forEach((cell,i)=>{const[x,z]=worldCell(level,cell.x,cell.z);dummy.position.set(x,(h-1.2)/2,z);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);dummy.position.y=h-.065;dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);const shade=.95+((cell.x*7+cell.z*11)%9)*.008;body.setColorAt(i,new Color(shade,shade,shade));caps.setColorAt(i,new Color(shade,shade,shade));});
      for(const mesh of[body,caps]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.cells=cells;m.group.add(mesh);this.pickTargets.push(mesh);this.terrainInstances.push(mesh);}
    }
    for(const prop of level.decorations){const h=groundAt(level,prop);if(h===null)continue;const[x,z]=worldCell(level,prop.x,prop.z);if(prop.kind==='plant')m.plant(x,h,z,.75);else m.arch(x,h,z);}
    m.finishPlants();this.root.add(m.group);
    const lines:number[]=[];
    for(let z=0;z<level.depth;z++)for(let x=0;x<level.width;x++){const[wx,wz]=worldCell(level,x,z),h=(level.terrain[z][x]??-.1)+.035;for(const[a,b]of[[[-.5,-.5],[.5,-.5]],[[.5,-.5],[.5,.5]],[[.5,.5],[-.5,.5]],[[-.5,.5],[-.5,-.5]]])lines.push(wx+a[0],h,wz+a[1],wx+b[0],h,wz+b[1]);}
    this.grid.geometry.dispose();this.grid.geometry=new BufferGeometry();this.grid.geometry.setAttribute('position',new Float32BufferAttribute(lines,3));
  }
  setDebug(debug:BoardDebug){this.debug={...debug};this.grid.visible=debug.grid;this.outletMesh.visible=debug.outlets;this.labels.visible=debug.depths;this.water.setDepthVisible(debug.depths);}
  setHover(cell:Cell|null){this.selected=cell;if(!cell||!this.level||cell.x>=this.level.width||cell.z>=this.level.depth){this.hover.visible=false;return;}const[x,z]=worldCell(this.level,cell.x,cell.z);this.hover.position.set(x,(groundAt(this.level,cell)??0)+.05,z);this.hover.visible=true;}
  update(dt:number,paused:boolean){this.water.update(dt,paused);let moved=false;this.motions=this.motions.filter(m=>{m.elapsed+=dt;const t=Math.min(1,m.elapsed/.18),ease=1-Math.pow(1-t,3);m.object.position.lerpVectors(m.from,m.to,ease);moved=true;return t<1;});return moved;}
  dispose(){
    this.water.dispose();this.terrain?.dispose();for(const mesh of this.terrainInstances){mesh.dispose();mesh.geometry.dispose();}
    this.boxes.dispose();this.crateGeometry.dispose();this.crateMaterial.dispose();this.crateTexture.dispose();
    this.actor.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as MeshStandardMaterial).dispose();}});
    this.grid.geometry.dispose();(this.grid.material as LineBasicMaterial).dispose();this.hover.geometry.dispose();(this.hover.material as LineBasicMaterial).dispose();
    this.outletMesh.dispose();this.outletGeometry.dispose();this.outletMaterial.dispose();this.labels.dispose();this.labelGeometry.dispose();this.labelMaterial.dispose();this.labelTexture.dispose();
  }
}
