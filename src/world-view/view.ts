import { AmbientLight, Box3, BufferGeometry, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, FogExp2, GridHelper, Group, HemisphereLight, InstancedMesh, Line, LineSegments, LineBasicMaterial, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OrthographicCamera, PCFShadowMap, Plane, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, ACESFilmicToneMapping, BoxGeometry, TorusGeometry } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MOUSE } from 'three';
import { dynamic, edgePanel, top } from '../world/catalog';
import { balancePart, balanceParts, balancePivot } from '../world/balance';
import { dir, DIRS } from '../world/types';
import type { ActionEvent, Direction, EditorSettings, GameState, LevelDataV2, Vec3, WaterSolution, WorldObject } from '../world/types';
import type { Pick, Placement } from '../workshop/editor';
import { balanceModel, gargoyle, prepareMaterials, prototype } from './models';
import type { BalanceModel } from './models';
import { WaterLayer, worldCell } from './water';
import { stoneArchitecture } from './architecture';

const angle = (direction: Direction) => -DIRS.findIndex(d => d.name === direction) * Math.PI / 2;
interface Motion { events: ActionEvent[]; elapsed: number; duration: number; previousFacing: number; splashes:Set<string> }
export class WorldView {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-8,8,8,-8,.1,250);
  readonly controls: OrbitControls;
  readonly water = new WaterLayer();
  readonly staticGroup = new Group(); readonly movingGroup = new Group(); readonly markers = new Group();
  readonly balanceGroup = new Group(); private balanceVisuals=new Map<string,BalanceModel>();
  readonly avatar = gargoyle();
  readonly ghost = new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial({color:'#80bdad',transparent:true,opacity:.32,depthWrite:false}));
  readonly areaGhost = new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.21,depthWrite:false,side:DoubleSide}),1024);
  readonly areaOutline = new LineSegments(new BufferGeometry(),new LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.68,depthWrite:false,vertexColors:true}));
  private highlight = new Mesh(new BoxGeometry(1.025,1.025,1.025),new MeshBasicMaterial({color:'#c45949',transparent:true,opacity:.38,depthWrite:false}));
  private grid = new GridHelper(12,12,'#567f75','#829f8b');
  private raycaster = new Raycaster(); private bounds = new Box3(); private rayPoint = new Vector3();
  private bridgeSide:Direction='south';
  private prototypes = new Map<string, Group>(); private dynamicGroups = new Map<string,Group>();
  private level: LevelDataV2 | null = null; private objects: WorldObject[] = []; private state: GameState | undefined;
  private settings: EditorSettings | undefined; private motion: Motion | null = null;
  private chain = new Line(new BufferGeometry(),new LineBasicMaterial({color:'#6e461e'}));
  private chainLinks = new InstancedMesh(new TorusGeometry(.058,.02,6,12),new MeshStandardMaterial({color:'#e5b348',roughness:.32,metalness:.65,emissive:'#70440d',emissiveIntensity:.22}),420);
  private spit = new InstancedMesh(new SphereGeometry(.035,6,4),new MeshBasicMaterial({color:'#c5f3ed',transparent:true,opacity:.85}),28);
  private spray = new InstancedMesh(new SphereGeometry(.026,5,4),new MeshBasicMaterial({color:'#e3f8eb',transparent:true,opacity:.65,depthWrite:false}),512);
  private landingRings = new InstancedMesh(new TorusGeometry(.15,.012,4,20),new MeshBasicMaterial({color:'#def4e7',transparent:true,opacity:.35,depthWrite:false,side:DoubleSide}),256);
  private sourceLanding:Vec3|null=null;
  private falls:WaterSolution['falls']=[];
  private rings: { mesh: Mesh; time: number; strength: number }[] = [];
  private animatedEffects = new Group();
  private last = performance.now(); private elapsed = 0; private raf = 0; private frames = 0; private fpsStart = performance.now(); private size = {width:1,height:1};
  private staticSignature = ''; private previousWater = ''; private forwardIndex = 0;
  animationMode: 'full'|'simple'|'system' = 'full';
  fps = 0; paused = matchMedia('(prefers-reduced-motion: reduce)').matches; reduced = false; editor = true; failed = false;
  onSample?: (pick: Pick) => void; onIdle?: () => void; onStats?: (fps: number, calls: number) => void;
  private middle: { x: number; y: number; id: number; rotating: boolean } | null = null; private synthetic = false;
  private observer: ResizeObserver;
  constructor(readonly canvas: HTMLCanvasElement, onError: (message: string) => void) {
    prepareMaterials();
    this.renderer = new WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); this.renderer.outputColorSpace = SRGBColorSpace; this.renderer.toneMapping=ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.15; this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=PCFShadowMap;
    this.scene.background=new Color('#a7bcb0'); this.scene.fog=new FogExp2('#a7bcb0',.006);
    this.scene.add(new HemisphereLight('#fff0d5','#687e75',2.1),new AmbientLight('#c9d8ca',.25));
    const sun=new DirectionalLight('#ffe5c5',2.7);sun.position.set(-10,24,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.far=100;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;this.scene.add(sun);
    this.scene.add(this.staticGroup,this.movingGroup,this.balanceGroup,this.water.group,this.avatar.root,this.ghost,this.areaGhost,this.areaOutline,this.highlight,this.markers,this.chain,this.chainLinks,this.spit,this.spray,this.landingRings,this.grid,this.animatedEffects); this.ghost.visible=this.highlight.visible=this.chain.visible=this.chainLinks.visible=this.spit.visible=false;this.areaGhost.count=0;this.areaGhost.frustumCulled=this.areaOutline.frustumCulled=false;this.chainLinks.frustumCulled=this.spit.frustumCulled=this.spray.frustumCulled=this.landingRings.frustumCulled=false;this.ghost.renderOrder=8;this.areaGhost.renderOrder=8.1;this.areaOutline.renderOrder=8.2;this.highlight.renderOrder=9;
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.enableDamping=false;this.controls.minZoom=.35;this.controls.maxZoom=4;this.controls.minPolarAngle=.001;this.controls.maxPolarAngle=Math.PI/2;this.controls.mouseButtons={LEFT:undefined,MIDDLE:MOUSE.ROTATE,RIGHT:undefined};
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',this.middleDown,true);canvas.addEventListener('pointermove',this.middleMove,true);canvas.addEventListener('pointerup',this.middleUp,true);canvas.addEventListener('pointercancel',()=>{this.middle=null;});canvas.addEventListener('auxclick',e=>e.preventDefault());
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.failed=true;onError('画面连接已中断。草稿仍保留，可以导出或刷新重新打开。');});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement!);this.resize();
    const motion=matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',()=>{if(this.animationMode==='system'){this.reduced=motion.matches;if(this.reduced)this.finish();}});
    this.frame();
  }
  private middleDown=(e:PointerEvent)=>{if(e.button!==1||this.synthetic)return;e.preventDefault();e.stopImmediatePropagation();this.middle={x:e.clientX,y:e.clientY,id:e.pointerId,rotating:false};this.canvas.setPointerCapture(e.pointerId);};
  private middleMove=(e:PointerEvent)=>{const m=this.middle;if(!m)return;e.preventDefault();if(!m.rotating&&Math.hypot(e.clientX-m.x,e.clientY-m.y)>=5){m.rotating=true;this.synthetic=true;this.canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:1,buttons:4,pointerId:m.id,pointerType:e.pointerType,clientX:m.x,clientY:m.y}));this.synthetic=false;}};
  private middleUp=(e:PointerEvent)=>{if(e.button!==1||!this.middle)return;const m=this.middle;this.middle=null;e.preventDefault();if(!m.rotating){e.stopImmediatePropagation();if(this.editor){const p=this.pick(e.clientX,e.clientY);if(p)this.onSample?.(p);}if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);}};
  resize(){const r=this.canvas.parentElement!.getBoundingClientRect();this.size={width:r.width,height:r.height};this.renderer.setSize(r.width,r.height,false);this.updateProjection();}
  private span=13;
  private updateProjection(){const aspect=this.size.width/this.size.height;this.camera.left=-this.span*aspect/2;this.camera.right=this.span*aspect/2;this.camera.top=this.span/2;this.camera.bottom=-this.span/2;this.camera.updateProjectionMatrix();}
  reset(){if(!this.level)return;const h=Math.max(2,...this.objects.map(o=>o.kind==='balance'?balancePivot(o)+1:top(o)));this.span=Math.max(9,Math.max(this.level.width,this.level.depth)*1.12+h*.55);this.controls.target.set(0,h*.4,0);this.camera.zoom=1;this.camera.position.copy(this.controls.target).add(new Vector3(14,25,21));this.updateProjection();this.controls.update();}
  setView(view:'top'|'north'|'east'|'south'|'west'|'reset'){if(view==='reset'){this.reset();return;}const az=this.controls.getAzimuthalAngle();const v=view==='top'?new Vector3(Math.sin(az)*.001,30,Math.cos(az)*.001):new Vector3(dir(view).x*30,.05,dir(view).z*30);this.camera.position.copy(this.controls.target).add(v);this.controls.update();}
  movementDirection(relative: Direction): Direction {
    const az=this.controls.getAzimuthalAngle(), desired=Math.atan2(-Math.sin(az), Math.cos(az));
    const current=this.forwardIndex*Math.PI/2, distance=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
    if(Math.abs(distance)>Math.PI/4+Math.PI/36)this.forwardIndex=((Math.round(desired/(Math.PI/2))%4)+4)%4;
    return DIRS[(this.forwardIndex+DIRS.findIndex(d=>d.name===relative))%4].name;
  }
  setAnimation(mode:'full'|'simple'|'system'){this.animationMode=mode;this.reduced=mode==='simple'||mode==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(this.reduced)this.finish(false);}
  get presentation(){const positions:Record<string,number[]>={player:this.avatar.root.position.toArray()};for(const [id,g]of this.dynamicGroups)positions[id]=g.position.toArray();return {positions,water:this.water.snapshot,chainVisible:this.chainLinks.visible,guideGridVisible:this.grid.visible,progress:this.motion?this.motion.elapsed/this.motion.duration:1};}
  focus(p:Vec3){if(!this.level)return;const [x,z]=worldCell(this.level,p.x,p.z),delta=new Vector3(x,p.y,z).sub(this.controls.target);this.camera.position.add(delta);this.controls.target.add(delta);this.controls.update();}
  private proto(kind:WorldObject['kind'],join=0){const key=`${kind}:${join}`;if(!this.prototypes.has(key))this.prototypes.set(key,prototype(kind,join));return this.prototypes.get(key)!;}
  private clearStatic(){for(const child of [...this.staticGroup.children]){this.staticGroup.remove(child);child.traverse(node=>{if(node instanceof InstancedMesh)node.dispose();else if(node instanceof Mesh&&node.userData.generatedGeometry)node.geometry.dispose();});}}
  show(level:LevelDataV2,objects:WorldObject[],solution:WaterSolution,settings:EditorSettings,state?:GameState,events:ActionEvent[]=[],editorTransition=false){
    const changedLevel=this.level?.id!==level.id, oldFacing=this.avatar.root.rotation.y,previousObjects=this.objects;
    const presented=new Map<string,Vec3>();if(this.level){const capture=(id:string,g:Object3D)=>presented.set(id,{x:g.position.x+(this.level!.width-1)/2,y:g.position.y,z:g.position.z+(this.level!.depth-1)/2});capture('player',this.avatar.root);for(const[id,g]of this.dynamicGroups)capture(id,g);}
    const presentedTilts=new Map<string,number>();for(const [id,model]of this.balanceVisuals)presentedTilts.set(id,model.pivot-model.ends[1].position.y);
    this.motion=null;this.chain.visible=this.chainLinks.visible=false;this.setAnimation(settings.animation??'full');this.level=level;this.objects=objects;this.settings=settings;this.state=state;this.editor=!state;
    this.controls.enablePan=!!state;this.controls.mouseButtons=state?{LEFT:MOUSE.ROTATE,MIDDLE:MOUSE.ROTATE,RIGHT:MOUSE.PAN}:{LEFT:undefined,MIDDLE:MOUSE.ROTATE,RIGHT:undefined};
    const staticKey=JSON.stringify([level.id,settings.slice,objects.filter(o=>!dynamic(o)&&o.kind!=='balance'&&!balancePart(o))]),rebuildStatic=staticKey!==this.staticSignature;this.staticSignature=staticKey;if(rebuildStatic)this.clearStatic();
    const displayObjects=objects.flatMap(o=>o.kind==='boat'&&o.cargo?.[0]?[o,{...o,...o.cargo[0],cargo:undefined}]:[o]);
    const displayIds=new Set(displayObjects.filter(dynamic).map(o=>o.id));
    const animationEvents=events.map(e=>({...e,from:{...e.from},to:{...e.to}}));
    for(const boat of objects.filter(o=>o.kind==='boat'&&o.cargo?.[0]))for(const e of events.filter(e=>e.id===boat.id))if(!events.some(other=>other.id===boat.cargo![0].id&&other.type===e.type))animationEvents.push({...e,id:boat.cargo![0].id});
    events=animationEvents;for(const e of events)if(e.type==='balance'&&presentedTilts.has(e.id))e.fromTilt=presentedTilts.get(e.id);
    if(changedLevel||!events.length)for(const[id,g]of this.dynamicGroups){this.movingGroup.remove(g);this.dynamicGroups.delete(id);}
    const visible=displayObjects.filter(o=>o.y<=settings.slice&&o.kind!=='balance'&&!balancePart(o)), buckets=new Map<string,{kind:WorldObject['kind'];join:number;list:WorldObject[]}>();
    const balances=objects.filter(o=>o.kind==='balance');const balanceIds=new Set(balances.map(o=>o.id));
    for(const [id,model] of this.balanceVisuals)if(!balanceIds.has(id)){this.balanceGroup.remove(model.root);this.balanceVisuals.delete(id);}
    for(const root of balances){let model=this.balanceVisuals.get(root.id);if(!model||model.pivot!==(root.mastHeight??2)){if(model)this.balanceGroup.remove(model.root);model=balanceModel(root.mastHeight??2);this.balanceVisuals.set(root.id,model);this.balanceGroup.add(model.root);}
      this.positionObject(model.root,root);const axis=dir(root.direction);model.root.rotation.y=Math.atan2(-axis.z,axis.x);model.root.visible=root.y<=settings.slice;this.setBalancePose(model,state?.balanceTilts[root.id]??0);
    }
    const panels=visible.filter(edgePanel),panelKeys=new Set(panels.map(o=>{const d=dir(o.direction);return `${o.kind}:${o.x+d.x*.5},${o.y},${o.z+d.z*.5}:${d.x?'x':'z'}`;}));
    const panelJoin=(o:WorldObject)=>{const d=dir(o.direction),tx=-d.z,tz=d.x,cx=o.x+d.x*.5,cz=o.z+d.z*.5,axis=d.x?'x':'z';const has=(x:number,y:number,z:number)=>panelKeys.has(`${o.kind}:${x},${y},${z}:${axis}`);return (has(cx-tx,o.y,cz-tz)?1:0)|(has(cx+tx,o.y,cz+tz)?2:0)|(has(cx,o.y-1,cz)?4:0)|(has(cx,o.y+1,cz)?8:0);};
    const filled=new Set(visible.filter(o=>['stone','floating','barrier'].includes(o.kind)).flatMap(o=>Array.from({length:o.kind==='barrier'?2:1},(_,i)=>`${o.x},${o.y+i},${o.z}`)));
    const enclosed=(o:WorldObject)=>o.kind==='stone'&&[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].every(([x,y,z])=>filled.has(`${o.x+x},${o.y+y},${o.z+z}`));
    for(const o of visible){if(o.kind==='stone')continue;if(enclosed(o))continue;if(dynamic(o)){let g=this.dynamicGroups.get(o.id);if(!g){g=this.proto(o.kind).clone(true);this.movingGroup.add(g);this.dynamicGroups.set(o.id,g);}this.positionObject(g,o);}else if(rebuildStatic){const join=edgePanel(o)?panelJoin(o):0,k=`${o.kind}:${join}`;if(!buckets.has(k))buckets.set(k,{kind:o.kind,join,list:[]});buckets.get(k)!.list.push(o);}}
    if(!this.reduced)for(const old of previousObjects)if(dynamic(old)&&events.some(e=>e.id===old.id&&e.type==='leave')&&!this.dynamicGroups.has(old.id)){const g=this.proto(old.kind).clone(true);this.positionObject(g,old);this.movingGroup.add(g);this.dynamicGroups.set(old.id,g);}
    // Every persistent object starts at its last displayed pose, including interrupted undo.
    if(events.length&&!this.reduced)for(const[id,p]of presented){const mesh=id==='player'?this.avatar.root:this.dynamicGroups.get(id);if(!mesh)continue;
      const steps=events.filter(e=>e.id===id&&!['land','splash','drip','win','turn'].includes(e.type));
      if(steps.length){let nearest=0,best=Infinity;steps.forEach((e,i)=>{const dx=e.to.x-e.from.x,dy=e.to.y-e.from.y,dz=e.to.z-e.from.z,den=dx*dx+dy*dy+dz*dz,u=den?Math.max(0,Math.min(1,((p.x-e.from.x)*dx+(p.y-e.from.y)*dy+(p.z-e.from.z)*dz)/den)):0;const dist=Math.hypot(p.x-e.from.x-dx*u,p.y-e.from.y-dy*u,p.z-e.from.z-dz*u);if(dist<best){best=dist;nearest=i;}});for(const e of steps.slice(0,nearest))events.splice(events.indexOf(e),1);steps[nearest].from={...p};}
      else {const target=id==='player'?state?.player:displayObjects.find(o=>o.id===id);if(target)events.push({type:'walk',id,from:p,to:{x:target.x,y:target.y,z:target.z}});}
    }
    for(const[id,g]of this.dynamicGroups)if(!displayIds.has(id)&&!events.some(e=>e.id===id&&e.type==='leave')){this.movingGroup.remove(g);this.dynamicGroups.delete(id);}
    const transform=new Object3D(),matrix=new Matrix4();
    if(rebuildStatic)this.staticGroup.add(stoneArchitecture(level,visible.filter(o=>o.kind==='stone')));
    for(const {kind,join,list} of buckets.values()){const proto=this.proto(kind,join);for(const part of proto.children){if(!(part instanceof Mesh))continue;const mesh=new InstancedMesh(part.geometry,part.material,list.length);mesh.castShadow=part.castShadow;mesh.receiveShadow=true;mesh.renderOrder=part.renderOrder;
      list.forEach((o,i)=>{const [x,z]=worldCell(level,o.x,o.z);transform.position.set(x,o.y,z);transform.rotation.set(0,angle(o.direction),0);transform.updateMatrix();matrix.multiplyMatrices(transform.matrix,part.matrix);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();this.staticGroup.add(mesh);}}
    this.avatar.root.visible=!!(state?.player??level.spawn)&&(state?.player??level.spawn)!.y<=settings.slice;
    const player=state?.player??level.spawn;if(player)this.positionObject(this.avatar.root,{...player,direction:state?.facing??'south'});
    const viewWater={...solution,cells:solution.cells.filter(c=>c.level<=settings.slice+1),falls:solution.falls.filter(e=>e.from<=settings.slice+1),outlets:solution.outlets.filter(e=>e.from<=settings.slice+1)};
    const waterKey=JSON.stringify([viewWater.cells.filter(c=>c.kind!=='dry').map(c=>[c.id,c.level]),viewWater.falls,viewWater.outlets]),waterChanged=this.previousWater!==waterKey;this.previousWater=waterKey;
    this.water.setSolution(level,viewWater,!this.reduced&&!changedLevel&&(!!state&&events.length>0||editorTransition));this.water.setDepthVisible(settings.depth);
    this.scene.remove(this.grid);this.grid.geometry.dispose();this.grid.material.dispose();this.grid=new GridHelper(Math.max(level.width,level.depth),Math.max(level.width,level.depth),'#547b72','#8ea78e');this.grid.position.y=settings.layer+.012;this.grid.visible=settings.grid&&!state;this.grid.material.transparent=true;this.grid.material.opacity=.48;this.scene.add(this.grid);
    this.buildMarkers(solution);this.falls=[...viewWater.falls,...viewWater.outlets];this.sourceLanding=solution.sourceLanding;
    if(changedLevel)this.reset();
    if(events.length&&!this.reduced){const fall=Math.max(0,...events.filter(e=>e.type==='fall').map(e=>e.from.y-e.to.y));this.motion={events,elapsed:0,duration:events.some(e=>e.type==='win')?1.05:fall?Math.min(.85,.3+Math.sqrt(fall)*.09):events.some(e=>e.type==='climb')?.4:events.some(e=>e.type==='push'||e.type==='pull')?.33:.22,previousFacing:oldFacing,splashes:new Set()};if(waterChanged)this.motion.duration=Math.max(.32,this.motion.duration);this.motion.duration*=.5;this.water.duration=this.motion.duration;const phases=new Set(events.filter(e=>!['land','splash','drip','win','turn','balance'].includes(e.type)&&e.id!=='chain').map(e=>e.type==='fall'||e.type==='leave'?1:e.type==='load'?2:e.type==='float'?3:e.type==='slide'?4:0));if(phases.has(4))this.motion.duration*=1+1/phases.size;for(const e of events.filter(e=>e.type==='balance')){const m=this.balanceVisuals.get(e.id);if(m)this.setBalancePose(m,e.fromTilt??0);}this.animate(0);}
    if(editorTransition&&!state&&!this.reduced)this.fadeEditor();
  }
  private positionObject(object:Object3D,p:Vec3&{direction?:Direction}){if(!this.level)return;const [x,z]=worldCell(this.level,p.x,p.z);object.position.set(x,p.y,z);if(p.direction)object.rotation.y=angle(p.direction);}
  private setBalancePose(model:BalanceModel,tilt:number){for(let i=0;i<2;i++){const side=i===0?-1:1,dy=-side*tilt;model.ends[i].position.set(side*2,model.pivot+dy,0);const arm=model.arms[i];arm.position.set(side,model.pivot+dy*.5,0);arm.rotation.z=Math.atan2(dy,side*2);arm.scale.set(Math.hypot(2,dy),.12,.17);}}
  private markerGeometry=new SphereGeometry(.1,8,6);private markerMaterial=new MeshBasicMaterial({color:'#f3d078'});private nonFinishMarkerMaterial=new MeshBasicMaterial({color:'#829b97'});private sourceMaterial=new MeshBasicMaterial({color:'#f0ffec'});
  private buildMarkers(water:WaterSolution){this.markers.clear();if(!this.level)return;if(this.settings?.outlets)for(const e of water.outlets){const d=dir(e.direction),m=new Mesh(this.markerGeometry,e.canFinish===false?this.nonFinishMarkerMaterial:this.markerMaterial);this.positionObject(m,{x:e.x+d.x*.48,y:e.from+.11,z:e.z+d.z*.48});this.markers.add(m);}if(this.editor&&this.level.source){const m=new Mesh(this.markerGeometry,this.sourceMaterial);this.positionObject(m,{...this.level.source,y:(water.sourceLanding?.y??this.level.source.y)+.6});m.scale.setScalar(1.4);this.markers.add(m);}}
  private setRay(clientX:number,clientY:number){const r=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);}
  private cameraBridgeSide():Direction{const x=this.camera.position.x-this.controls.target.x,z=this.camera.position.z-this.controls.target.z;const next:Direction=Math.abs(x)>Math.abs(z)?x>0?'east':'west':z>0?'south':'north';const old=dir(this.bridgeSide),oldWeight=Math.abs(old.x?x:z),nextWeight=Math.abs(dir(next).x?x:z);if(next!==this.bridgeSide&&nextWeight>oldWeight+.08)this.bridgeSide=next;return this.bridgeSide;}
  pick(clientX:number,clientY:number,snapshot?:LevelDataV2):Pick|null{
    if(!this.level||!this.settings)return null;this.setRay(clientX,clientY);const objects=snapshot?.objects??this.objects;let closest=Infinity,pick:Pick|null=null;const cameraSide=this.cameraBridgeSide();
    const test=(o:WorldObject|{id:string;kind:'spawn'|'source';x:number;y:number;z:number;direction:Direction})=>{
      if(o.y>this.settings!.slice)return;const [x,z]=worldCell(this.level!,o.x,o.z);let sx=.5,sy=.5,sz=.5,cy=o.y+.5,cx=x,cz=z;
      if(o.kind==='source'||o.kind==='spawn'){sx=sz=.2;sy=.4;cy=o.y+.4;}else if(edgePanel(o as WorldObject)){const d=dir(o.direction);cx+=d.x*.5;cz+=d.z*.5;if(d.x)sx=.11;else sz=.11;}else if(o.kind==='bridge'){sy=.19;cy=o.y-.035;}else if(o.kind==='barrier'){sy=1;cy=o.y+1;}else if(o.kind==='boat'){sy=.25;cy=o.y-.05;}else if(o.kind==='plant'||o.kind==='arch'){sx=sz=.3;}
      this.bounds.min.set(cx-sx,cy-sy,cz-sz);this.bounds.max.set(cx+sx,cy+sy,cz+sz);if(!this.raycaster.ray.intersectBox(this.bounds,this.rayPoint))return;const dist=this.rayPoint.distanceTo(this.raycaster.ray.origin);if(dist>=closest)return;closest=dist;
      const p=this.rayPoint,normal={x:0,y:0,z:0};const candidates=[[Math.abs(p.x-this.bounds.min.x),'x',-1],[Math.abs(p.x-this.bounds.max.x),'x',1],[Math.abs(p.y-this.bounds.min.y),'y',-1],[Math.abs(p.y-this.bounds.max.y),'y',1],[Math.abs(p.z-this.bounds.min.z),'z',-1],[Math.abs(p.z-this.bounds.max.z),'z',1]] as const;const side=[...candidates].sort((a,b)=>a[0]-b[0])[0];normal[side[1]]=side[2];
      let y=o.y;if(o.kind==='barrier')y=Math.min(o.y+1,Math.max(o.y,Math.floor(p.y-1e-4)));if(o.kind==='bridge')y=normal.y>0?o.y-1:o.y;
      pick={id:o.id,kind:o.kind,position:{x:o.x,y,z:o.z},normal,direction:o.direction,cameraSide,surfaceY:o.kind==='source'||o.kind==='spawn'?o.y:top(o as WorldObject),hit:{x:p.x+(this.level!.width-1)/2,y:p.y,z:p.z+(this.level!.depth-1)/2}};
    };
    for(const o of objects){if(balancePart(o))continue;if(o.kind==='balance'){
      const tilt=this.state?.balanceTilts[o.id]??0;
      for(const part of balanceParts(o,tilt)){if(part.y>this.settings.slice)continue;const [x,z]=worldCell(this.level,part.x,part.z);const h=part.kind==='balance-pillar'?o.mastHeight??2:part.kind==='balance-end'?.25:.2;
        this.bounds.min.set(x-.5,part.y, z-.5);this.bounds.max.set(x+.5,part.y+h,z+.5);
        if(!this.raycaster.ray.intersectBox(this.bounds,this.rayPoint))continue;const distance=this.rayPoint.distanceTo(this.raycaster.ray.origin);if(distance>=closest)continue;closest=distance;
        pick={id:o.id,kind:'balance',position:{x:o.x,y:o.y,z:o.z},normal:{x:0,y:1,z:0},direction:o.direction,cameraSide,surfaceY:balancePivot(o),hit:{x:this.rayPoint.x+(this.level.width-1)/2,y:this.rayPoint.y,z:this.rayPoint.z+(this.level.depth-1)/2}};
      }
    }else test(o);}
    const draft=snapshot??this.level;
    if(draft.spawn)test({...draft.spawn,id:'$spawn',kind:'spawn',direction:'south'});
    if(draft.source)test({...draft.source,id:'$source',kind:'source',direction:'north'});
    if(pick)return pick;
    const p=this.intersectPlane(clientX,clientY,{x:0,y:this.settings.layer,z:0},{x:0,y:1,z:0});if(!p)return null;
    const hit={x:this.rayPoint.x+(this.level.width-1)/2,y:this.rayPoint.y,z:this.rayPoint.z+(this.level.depth-1)/2};return {position:p,normal:{x:0,y:1,z:0},hit,cameraSide};
  }
  intersectPlane(clientX:number,clientY:number,p:Vec3,normal:Vec3):Vec3|null{if(!this.level)return null;this.setRay(clientX,clientY);const [x,z]=worldCell(this.level,p.x,p.z),n=new Vector3(normal.x,normal.y,normal.z),plane=new Plane().setFromNormalAndCoplanarPoint(n,new Vector3(x+normal.x*.5,p.y,z+normal.z*.5));const hit=this.raycaster.ray.intersectPlane(plane,this.rayPoint);if(!hit)return null;return{x:Math.round(hit.x+(this.level.width-1)/2),y:Math.round(hit.y),z:Math.round(hit.z+(this.level.depth-1)/2)};}
  preview(placement:Placement|null,pick:Pick|null,erase=false,area:Placement[]=[]){
    const region=area.length>1||!!this.settings?.rectangle;
    this.ghost.visible=!!placement&&!erase&&!region&&!(this.settings?.tool==='bridge'&&!!placement.error);this.highlight.visible=!!pick?.id&&erase;
    if(placement){this.positionObject(this.ghost,placement.position);this.ghost.position.y+=.5;this.ghost.scale.set(1,1,1);(this.ghost.material as MeshBasicMaterial).color.set(placement.error?'#ce6e59':'#94d0b3');const tool=this.settings?.tool;if(tool&&['glass','open-glass','stone-fence'].includes(tool)){const d=dir(placement.direction);this.ghost.position.x+=d.x*.5;this.ghost.position.z+=d.z*.5;this.ghost.scale.set(d.x?.06:1,1,d.z?.06:1);}if(tool==='bridge'){this.ghost.position.y-=.5;this.ghost.scale.y=.06;}if(tool==='barrier'){this.ghost.scale.y=2;this.ghost.position.y+=.5;}if(tool==='balance')this.ghost.visible=false;}
    if(pick){this.positionObject(this.highlight,pick.position);this.highlight.position.y+=.5;this.highlight.scale.set(1.025,1.025,1.025);if(pick.kind==='bridge'){this.highlight.position.y=pick.surfaceY??pick.position.y;this.highlight.scale.set(1.025,.28,1.025);}if(pick.kind&&['glass','open-glass','stone-fence'].includes(pick.kind)){const d=dir(pick.direction!);this.highlight.position.x+=d.x*.5;this.highlight.position.z+=d.z*.5;this.highlight.scale.set(d.x?.14:1.025,1.025,d.z?.14:1.025);}}
    const transform=new Object3D(),limit=region?Math.min(area.length,1024):0;this.areaGhost.count=limit;
    const outlines:number[]=[],outlineColors:number[]=[],corners=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],edgePairs=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    for(let i=0;i<limit;i++){
      const item=area[i],kind=item.kind??this.settings?.tool,[x,z]=worldCell(this.level!,item.position.x,item.position.z);
      transform.position.set(x,item.position.y+.5,z);transform.rotation.set(0,0,0);transform.scale.set(.94,.94,.94);
      if(kind&&['glass','open-glass','stone-fence'].includes(kind)){const d=dir(item.direction);transform.position.x+=d.x*.5;transform.position.z+=d.z*.5;transform.scale.set(d.x?.065:.94,.94,d.z?.065:.94);}
      if(kind==='bridge'||kind==='balance-end'||kind==='balance-rail'){transform.position.y=item.position.y;transform.scale.y=.12;}
      if(kind==='balance-pillar'){transform.position.y=item.position.y+(this.settings?.balanceHeight??2)/2;transform.scale.set(.18,this.settings?.balanceHeight??2,.18);}
      if(kind==='barrier'){transform.position.y=item.position.y+1;transform.scale.y=1.94;}
      transform.updateMatrix();const color=new Color(erase?'#d98974':item.error&&kind==='bridge'?'#a7ada4':item.error?'#cc6c58':'#86cdb1');
      this.areaGhost.setMatrixAt(i,transform.matrix);this.areaGhost.setColorAt(i,color);
      for(const [a,b] of edgePairs)for(const index of [a,b]){const v=corners[index],p=new Vector3(v[0],v[1],v[2]).applyMatrix4(transform.matrix);outlines.push(p.x,p.y,p.z);outlineColors.push(color.r,color.g,color.b);}
    }
    const outlineGeometry=new BufferGeometry();outlineGeometry.setAttribute('position',new Float32BufferAttribute(outlines,3));outlineGeometry.setAttribute('color',new Float32BufferAttribute(outlineColors,3));this.areaOutline.geometry.dispose();this.areaOutline.geometry=outlineGeometry;
    if(limit){this.areaGhost.instanceMatrix.needsUpdate=true;if(this.areaGhost.instanceColor)this.areaGhost.instanceColor.needsUpdate=true;}
  }
  project(p:Vec3){if(!this.level)return{x:0,y:0};const [x,z]=worldCell(this.level,p.x,p.z),v=new Vector3(x,p.y,z).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(-v.y+1)*r.height/2};}
  private drawArmedChain(){
    const targetId=this.state?.pullTarget,target=targetId&&this.objects.find(o=>o.id===targetId);
    if(!target||!this.level){this.chain.visible=this.chainLinks.visible=false;return;}
    const d=dir(this.state!.facing),a=this.avatar.root.position.clone().add(new Vector3(-d.z*.8,.7,d.x*.8)),mesh=this.dynamicGroups.get(target.id);
    const [x,z]=worldCell(this.level,target.x,target.z),b=mesh?mesh.position.clone().add(new Vector3(-d.z*.47,.8,d.x*.47)):new Vector3(x-d.z*.47,target.y+.8,z+d.x*.47);
    b.x-=d.x*.46;b.z-=d.z*.46;
    const points:Vector3[]=[],count=Math.min(420,Math.max(2,Math.ceil(a.distanceTo(b)/.075))),link=new Object3D();
    for(let i=0;i<count;i++){const u=i/(count-1),v=a.clone().lerp(b,u);v.y-=Math.sin(u*Math.PI)*.04;points.push(v);link.position.copy(v);link.rotation.set(0,d.x?Math.PI/2:0,i%2?Math.PI/2:0);link.updateMatrix();this.chainLinks.setMatrixAt(i,link.matrix);}
    this.chainLinks.count=count;this.chainLinks.instanceMatrix.needsUpdate=true;this.chain.geometry.dispose();this.chain.geometry=new BufferGeometry().setFromPoints(points);this.chain.visible=this.chainLinks.visible=true;
  }
  private animate(delta:number){const motion=this.motion;if(!motion||!this.level)return;motion.elapsed+=delta;const t=Math.min(1,motion.elapsed/motion.duration),smooth=t*t*(3-2*t),byId=new Map<string,ActionEvent[]>();
    for(const e of motion.events)if(!['land','splash','drip','win','turn','balance'].includes(e.type)&&e.id!=='chain'){if(!byId.has(e.id))byId.set(e.id,[]);byId.get(e.id)!.push(e);}
    const category=(e:ActionEvent)=>e.type==='fall'||e.type==='leave'?1:e.type==='load'?2:e.type==='float'?3:e.type==='slide'?4:0;
    const reverse=motion.events.some(e=>e.reversed);const phases:number[]=[...new Set([...byId.values()].flat().map(category))].sort((a,b)=>reverse?b-a:a-b);const totalWeight=phases.reduce((n,p)=>n+(p===4?2:1),0),elapsedWeight=t*totalWeight;let phaseIndex=0,preceding=0;while(phaseIndex<phases.length-1&&elapsedWeight>=preceding+(phases[phaseIndex]===4?2:1)){preceding+=phases[phaseIndex]===4?2:1;phaseIndex++;}const activePhase=phases[phaseIndex],phaseTime=phases.length?Math.min(1,(elapsedWeight-preceding)/(activePhase===4?2:1)):t;
    for(const [id,steps]of byId){const mesh=id==='player'?this.avatar.root:this.dynamicGroups.get(id);if(!mesh)continue;const current=steps.filter(e=>category(e)===activePhase),previous=steps.filter(e=>reverse?category(e)>activePhase:category(e)<activePhase),index=Math.min(current.length-1,Math.floor(phaseTime*current.length));const e=current[index]??previous.at(-1)??steps[0],u=current.length?Math.min(1,phaseTime*current.length-index):previous.length?1:0;let x=e.from.x+(e.to.x-e.from.x)*u,z=e.from.z+(e.to.z-e.from.z)*u,y=e.from.y+(e.to.y-e.from.y)*(e.type==='fall'?u*u:u);
      if(e.type==='climb'){const vertical=e.reversed?Math.max(0,(u-.6)/.4):Math.min(1,u*2),horizontal=e.reversed?Math.min(1,u/.6):Math.max(0,(u-.4)/.6);y=e.from.y+(e.to.y-e.from.y)*vertical+Math.sin(u*Math.PI)*.13;x=e.from.x+(e.to.x-e.from.x)*horizontal;z=e.from.z+(e.to.z-e.from.z)*horizontal;}
      this.positionObject(mesh,{x,y,z});if(id==='player'&&e.type==='walk')this.avatar.body.position.y=Math.sin(u*Math.PI*2)*.035;}
    for(const e of motion.events.filter(e=>e.type==='balance')){const model=this.balanceVisuals.get(e.id);if(model)this.setBalancePose(model,(e.fromTilt??0)+((e.toTilt??0)-(e.fromTilt??0))*smooth);}
    if(this.state){const target=angle(this.state.facing),diff=Math.atan2(Math.sin(target-motion.previousFacing),Math.cos(target-motion.previousFacing));this.avatar.root.rotation.y=motion.previousFacing+diff*smooth;}
    const active=motion.events.some(e=>e.type==='push'||e.type==='pull');this.avatar.body.rotation.x=active?-.16*Math.sin(t*Math.PI):0;
    this.avatar.feet.forEach((f,i)=>{f.rotation.x=Math.sin(t*Math.PI*4+i*Math.PI)*.32*Math.sin(t*Math.PI);f.position.z=(i<2?-.23:.25)-(active&&i<2?.14*Math.sin(t*Math.PI):0);});this.avatar.wings.forEach((w,i)=>{w.rotation.y=(i?1:-1)*Math.sin(t*Math.PI)*.2;});
    if(motion.events.some(e=>e.type==='land')){const landing=Math.max(0,(t-.86)/.14);this.avatar.body.scale.y=1-.11*Math.sin(landing*Math.PI);}
    const pull=motion.events.find(e=>e.id==='chain');this.chain.visible=!!pull&&t>.03&&t<.96;this.chainLinks.visible=this.chain.visible;
    if(pull?.target&&this.chain.visible){const [tx,tz]=worldCell(this.level,pull.target.x,pull.target.z),d=dir(this.state!.facing),a=this.avatar.root.position.clone().add(new Vector3(-d.z*.8,.7,d.x*.8)),target=pull.targetId?this.dynamicGroups.get(pull.targetId):null;const b=target?target.position.clone().add(new Vector3(-d.z*.47,.8,d.x*.47)):new Vector3(tx-d.z*.47,pull.target.y+.8,tz+d.x*.47);b.x-=d.x*.46;b.z-=d.z*.46;
      const extend=Math.min(1,t/.13,(1-t)/.12),end=a.clone().lerp(b,extend),points:Vector3[]=[];const count=Math.min(420,Math.max(2,Math.ceil(a.distanceTo(end)/.075))),m=new Object3D();
      for(let i=0;i<count;i++){const u=i/(count-1),v=a.clone().lerp(end,u);v.y-=Math.sin(u*Math.PI)*.09*(1-smooth);points.push(v);m.position.copy(v);m.rotation.set(0,d.x?Math.PI/2:0,i%2?Math.PI/2:0);m.updateMatrix();this.chainLinks.setMatrixAt(i,m.matrix);}this.chainLinks.count=count;this.chainLinks.instanceMatrix.needsUpdate=true;this.chain.geometry.dispose();this.chain.geometry=new BufferGeometry().setFromPoints(points);}
    const winning=motion.events.find(e=>e.type==='win');this.spit.visible=!!winning&&t>.35&&t<.95;
    if(winning?.direction){const d=dir(winning.direction);this.avatar.root.rotation.y=angle(winning.direction);this.avatar.head.rotation.x=-.12*Math.sin(t*Math.PI);if(this.spit.visible){const m=new Object3D();for(let i=0;i<28;i++){const u=((t-.35)*2+i/28)%1;m.position.copy(this.avatar.root.position).add(new Vector3(d.x*(.4+u*1.4),.6-u*u*.7,d.z*(.4+u*1.4)));m.scale.setScalar(1-u*.6);m.updateMatrix();this.spit.setMatrixAt(i,m.matrix);}this.spit.instanceMatrix.needsUpdate=true;}}
    for(const e of motion.events)if((e.type==='splash'||e.type==='drip')&&!motion.splashes.has(e.id)){const mesh=e.id==='player'?this.avatar.root:this.dynamicGroups.get(e.id);if(!mesh||mesh.position.y<=e.to.y){this.ripple(e.to,e.type==='splash'?1:.4);motion.splashes.add(e.id);}}
    if(t>=1){this.finish(false);for(const e of motion.events)if(e.type==='win')this.ripple(e.to,.4);this.onIdle?.();}
  }
  private ripple(p:Vec3,strength:number){const m=new Mesh(new TorusGeometry(.28,.015,5,28),new MeshBasicMaterial({color:'#f1f9e2',transparent:true,opacity:.8,depthWrite:false,side:DoubleSide}));this.positionObject(m,{...p,y:p.y+.04});m.rotation.x=Math.PI/2;this.animatedEffects.add(m);this.rings.push({mesh:m,time:0,strength});}
  finish(notify=true){if(!this.motion)return;this.motion=null;this.water.finish();for(const o of this.objects.flatMap(o=>o.kind==='boat'&&o.cargo?.[0]?[o,{...o,...o.cargo[0]}]:[o])){const m=this.dynamicGroups.get(o.id);if(m)this.positionObject(m,o);}for(const [id,g]of this.dynamicGroups)if(!this.objects.some(o=>o.id===id||o.cargo?.some(c=>c.id===id))){this.movingGroup.remove(g);this.dynamicGroups.delete(id);}if(this.state){this.positionObject(this.avatar.root,{...this.state.player,direction:this.state.facing});for(const [id,model]of this.balanceVisuals)this.setBalancePose(model,this.state.balanceTilts[id]??0);}this.avatar.body.position.y=0;this.avatar.body.rotation.x=0;this.avatar.body.scale.y=1;this.avatar.head.rotation.x=0;for(const f of this.avatar.feet)f.rotation.x=0;this.chain.visible=this.chainLinks.visible=this.spit.visible=false;if(notify)this.onIdle?.();}
  private fadeEditor(){this.canvas.animate([{opacity:.65},{opacity:1}],{duration:70,easing:'ease-out'});}
  get busy(){return !!this.motion;}
  private frame=()=>{this.raf=requestAnimationFrame(this.frame);const now=performance.now(),delta=Math.min(.05,(now-this.last)/1000);this.last=now;if(this.failed||document.hidden)return;if(!this.paused)this.elapsed+=delta*2;this.water.update(delta,this.paused);this.animate(delta);if(!this.motion||!this.motion.events.some(e=>e.id==='chain'))this.drawArmedChain();if(!this.motion&&!this.reduced)this.avatar.body.scale.y=1+Math.sin(this.elapsed*2.2)*.016;
    for(const r of [...this.rings]){r.time+=delta*2;r.mesh.scale.setScalar(1+r.time*2*r.strength);(r.mesh.material as MeshBasicMaterial).opacity=Math.max(0,.7-r.time);if(r.time>.75){this.animatedEffects.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as MeshBasicMaterial).dispose();this.rings.splice(this.rings.indexOf(r),1);}}
    this.updateSpray();this.renderer.render(this.scene,this.camera);this.frames++;if(now-this.fpsStart>=1000){this.fps=Math.round(this.frames*1000/(now-this.fpsStart));this.frames=0;this.fpsStart=now;this.onStats?.(this.fps,this.renderer.info.render.calls);}};
  private updateSpray(){if(!this.level)return;const m=new Object3D();let index=0;for(const e of this.falls){if(index>=512)break;const d=dir(e.direction),[x,z]=worldCell(this.level,e.x,e.z);for(let i=0;i<3&&index<512;i++){const t=(this.elapsed*1.2+i*.33+e.x*.17+e.z*.21)%1,w=Math.sin(index*13.7)*.35;m.position.set(x+d.x*(.52+t*.18)-d.z*w,e.from-.05-t*t*Math.min(2,e.from-e.to),z+d.z*(.52+t*.18)+d.x*w);m.scale.setScalar(.6+Math.sin(index)*.2);m.updateMatrix();this.spray.setMatrixAt(index++,m.matrix);}}this.spray.count=index;this.spray.instanceMatrix.needsUpdate=true;this.spray.visible=index>0&&!this.reduced;
    const targets=this.falls.filter(e=>e.kind==='fall').map(e=>({x:e.x+dir(e.direction).x*.65,y:e.to,z:e.z+dir(e.direction).z*.65}));if(this.sourceLanding)targets.push(this.sourceLanding);let ring=0;for(const p of targets.slice(0,128)){for(let i=0;i<2;i++){const [x,z]=worldCell(this.level,p.x,p.z),t=(this.elapsed*.7+i*.5)%1;m.position.set(x,p.y+.04,z);m.rotation.set(Math.PI/2,0,0);m.scale.setScalar(.4+t*2);m.updateMatrix();this.landingRings.setMatrixAt(ring++,m.matrix);}}this.landingRings.count=ring;this.landingRings.instanceMatrix.needsUpdate=true;
  }
  dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.controls.dispose();this.water.dispose();this.clearStatic();this.areaGhost.dispose();this.areaGhost.geometry.dispose();this.areaOutline.geometry.dispose();this.renderer.dispose();}
}



