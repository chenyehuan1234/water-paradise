import { ACESFilmicToneMapping, AmbientLight, CanvasTexture, DirectionalLight, FogExp2, HemisphereLight, Mesh, MeshBasicMaterial, MOUSE, PCFShadowMap, Plane, PlaneGeometry, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { GardenCamera } from '../scene/camera';
import { gardenConfig } from '../scene/config';
import { BoardScene } from './board';
import type { BoardDebug } from './board';
import type { Box, Cell, LevelDataV1, WaterSolution } from '../core/types';

export class BoardView {
  readonly renderer:WebGLRenderer;
  readonly camera:GardenCamera;
  readonly board=new BoardScene();
  readonly scene=new Scene();
  private sun=new DirectionalLight('#fff0e4',2.5);
  private observer:ResizeObserver;
  private listeners=new AbortController();
  private level:LevelDataV1|null=null;
  private frames:number[]=[];
  private previous=0;
  private fps=0;
  private shadow:Mesh<PlaneGeometry,MeshBasicMaterial>;
  paused=false;
  constructor(readonly container:HTMLElement,onFailure:(message:string)=>void){
    this.renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;this.renderer.setClearColor('#dce5db',0);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=PCFShadowMap;
    const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','水庭院三维场景');container.appendChild(canvas);
    this.camera=new GardenCamera(canvas,{...gardenConfig.camera,elevation:50});this.camera.controls.minZoom=.55;this.camera.controls.maxZoom=2.4;
    this.scene.fog=new FogExp2('#dce5db',.007);
    this.scene.add(new HemisphereLight('#f7f6dc','#92a996',1.75),new AmbientLight('#f2dec3',.18));
    this.sun.position.set(-8,18,7);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00015;this.sun.shadow.radius=4;this.sun.shadow.intensity=.85;this.sun.shadow.autoUpdate=false;this.scene.add(this.sun,this.sun.target);
    const fill=new DirectionalLight('#c8e9e5',.65);fill.position.set(4,7,-7);this.scene.add(fill,this.board.root);
    const canvasTexture=document.createElement('canvas');canvasTexture.width=128;canvasTexture.height=128;const ctx=canvasTexture.getContext('2d')!,gradient=ctx.createRadialGradient(64,64,4,64,64,64);gradient.addColorStop(0,'rgba(65,94,76,.2)');gradient.addColorStop(1,'rgba(65,94,76,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const texture=new CanvasTexture(canvasTexture);texture.colorSpace=SRGBColorSpace;
    this.shadow=new Mesh(new PlaneGeometry(1,1),new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=-2;this.scene.add(this.shadow);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.renderer.setAnimationLoop(null);onFailure('图形连接已中断。草稿可从本地恢复，请重新打开页面。');},{signal:this.listeners.signal});
    canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal:this.listeners.signal});
    document.addEventListener('visibilitychange',()=>{this.previous=0;this.frames=[];},{signal:this.listeners.signal});
    this.renderer.setAnimationLoop(time=>{const dt=this.previous?Math.min(.05,(time-this.previous)/1000):0;this.previous=time;if(document.hidden)return;if(this.board.update(dt,this.paused))this.sun.shadow.needsUpdate=true;this.camera.controls.update();this.renderer.render(this.scene,this.camera.camera);this.frames.push(time);while(this.frames.length>1&&time-this.frames[0]>1000)this.frames.shift();if(this.frames.length>1)this.fps=(this.frames.length-1)*1000/(time-this.frames[0]);container.dataset.ready='true';});
  }
  setState(level:LevelDataV1,boxes:readonly Box[],player:Cell|null,water:WaterSolution,options:{animate:boolean;fit:boolean}){
    this.level=level;this.board.setState(level,boxes,player,water,options.animate);
    const height=Math.max(0,...level.terrain.flat().filter((h):h is number=>h!==null));
    if(options.fit){this.camera.frameLevel(level.width,level.depth,height+1);this.resize();}
    const span=Math.max(level.width,level.depth)+height+3;
    Object.assign(this.sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:1,far:160});this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.set(-span,span*1.5,span*.8);this.sun.target.position.set(0,height*.3,0);this.sun.shadow.needsUpdate=true;
    this.shadow.scale.set(level.width*1.4,level.depth*1.4,1);
  }
  setEditor(editor:boolean){this.camera.controls.mouseButtons.LEFT=editor?undefined:MOUSE.ROTATE;this.camera.controls.mouseButtons.RIGHT=editor?MOUSE.ROTATE:undefined;}
  resetView(){if(this.level){const height=Math.max(0,...this.level.terrain.flat().filter((h):h is number=>h!==null));this.camera.frameLevel(this.level.width,this.level.depth,height+1);this.resize();}}
  setDebug(debug:BoardDebug){this.board.setDebug(debug);}
  resize(){const width=Math.max(this.container.clientWidth,1),height=Math.max(this.container.clientHeight,1);this.renderer.setSize(width,height);this.camera.resize(width,height);}
  pick(clientX:number,clientY:number):Cell|null{
    if(!this.level)return null;const rect=this.renderer.domElement.getBoundingClientRect(),pointer=new Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),ray=new Raycaster();ray.setFromCamera(pointer,this.camera.camera);
    const hits=ray.intersectObjects(this.board.pickTargets,false);
    if(hits.length){const hit=hits[0];if(hit.instanceId!==undefined)return {...hit.object.userData.cells[hit.instanceId]};}
    const point=ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3());if(!point)return null;
    const x=Math.floor(point.x+this.level.width/2),z=Math.floor(point.z+this.level.depth/2);
    return x>=0&&z>=0&&x<this.level.width&&z<this.level.depth?{x,z}:null;
  }
  project(cell:Cell){if(!this.level)return null;const rect=this.renderer.domElement.getBoundingClientRect(),h=this.level.terrain[cell.z]?.[cell.x]??0,p=new Vector3(cell.x-(this.level.width-1)/2,h+.04,cell.z-(this.level.depth-1)/2).project(this.camera.camera);return{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};}
  stats(){return{fps:Math.round(this.fps*10)/10,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,pixelRatio:this.renderer.getPixelRatio(),waterTime:this.board.water.time};}
  dispose(){this.renderer.setAnimationLoop(null);this.listeners.abort();this.observer.disconnect();this.camera.dispose();this.board.dispose();this.sun.shadow.dispose();this.shadow.geometry.dispose();this.shadow.material.map?.dispose();this.shadow.material.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
