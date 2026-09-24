import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, DirectionalLight, FogExp2,
  HemisphereLight, Mesh, MeshBasicMaterial, PCFShadowMap, PlaneGeometry, Scene,
  SRGBColorSpace, WebGLRenderer,
} from 'three';
import { Garden } from './garden';
import { GardenCamera } from './camera';
import type { DisplaySceneConfig } from './config';

export interface DisplaySnapshot {
  paused: boolean; gridVisible: boolean; elapsed: number;
  azimuth: number; elevation: number; zoom: number;
  fps: number; drawCalls: number; triangles: number; pixelRatio: number;
}

/** Scene lifecycle. No gameplay state, network API or simulation decisions. */
export class GardenDisplay {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly garden: Garden;
  readonly view: GardenCamera;
  private observer: ResizeObserver;
  private previousTime = 0;
  private frames: number[] = [];
  private fps = 0;
  private disposed = false;
  private contextLost = false;
  private extraDisposables: { dispose(): void }[] = [];

  constructor(private container: HTMLElement, config: DisplaySceneConfig, onFailure: (message: string) => void) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setClearColor('#dce5db', 0);
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', '庭院三维视图：拖动环绕，滚轮缩放；方向键旋转，R 重置，G 网格，空格暂停');
    container.appendChild(canvas);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true; this.renderer.setAnimationLoop(null);
      onFailure('图形连接已中断，请点击“重新打开”恢复庭院。');
    }, { signal: this.listeners.signal });
    this.scene.fog = new FogExp2('#dce5db', .014);
    this.scene.add(new HemisphereLight('#f7f6dc', '#92a996', 1.75));
    this.scene.add(new AmbientLight('#f2dec3', .18));
    const sun = new DirectionalLight('#fff0e4', 2.5);
    sun.position.set(-5, 11, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 9, bottom: -8, near: 1, far: 30 });
    sun.shadow.normalBias = .025; sun.shadow.bias = -.00015; sun.shadow.radius = 4;
    sun.shadow.intensity = .85;
    // Geometry and sunlight are static in this visual study; water casts no shadow.
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
    this.scene.add(sun); this.extraDisposables.push({ dispose: () => sun.shadow.dispose() });
    const fill = new DirectionalLight('#c8e9e5', .65); fill.position.set(4, 5, -7); this.scene.add(fill);

    this.garden = new Garden(config); this.scene.add(this.garden.group);
    this.view = new GardenCamera(canvas, config.camera);
    this.addFloatingShadow();
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.resize();
    document.addEventListener('visibilitychange', () => { this.previousTime = 0; this.frames = []; }, { signal: this.listeners.signal });
    this.renderer.setAnimationLoop(time => this.frame(time));
  }

  private listeners = new AbortController();

  private addFloatingShadow() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(65,94,76,.25)'); gradient.addColorStop(.5, 'rgba(65,94,76,.12)'); gradient.addColorStop(1, 'rgba(65,94,76,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    const geometry = new PlaneGeometry(13, 13);
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    const shadow = new Mesh(geometry, material); shadow.rotation.x = -Math.PI / 2; shadow.position.set(.3, -2.55, .4); this.scene.add(shadow);
    this.extraDisposables.push(texture, geometry, material);
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height); this.view.resize(width, height);
  }

  private frame(time: number) {
    if (this.disposed || this.contextLost) return;
    const delta = this.previousTime ? Math.min((time - this.previousTime) / 1000, .05) : 0;
    this.previousTime = time;
    if (document.hidden) return;
    this.garden.water.update(delta); this.view.controls.update();
    this.renderer.render(this.scene, this.view.camera);
    this.frames.push(time);
    while (this.frames.length > 1 && time - this.frames[0] > 1000) this.frames.shift();
    if (this.frames.length > 1) this.fps = (this.frames.length - 1) * 1000 / (time - this.frames[0]);
    this.container.dataset.ready = 'true';
  }

  setPaused(paused: boolean) { this.garden.water.paused = paused; }
  setGridVisible(visible: boolean) { this.garden.grid.visible = visible; }
  resetView() { this.view.reset(); }
  snapshot(): DisplaySnapshot {
    return {
      paused: this.garden.water.paused, gridVisible: this.garden.grid.visible, elapsed: this.garden.water.elapsed,
      azimuth: this.view.controls.getAzimuthalAngle() * 180 / Math.PI,
      elevation: 90 - this.view.controls.getPolarAngle() * 180 / Math.PI, zoom: this.view.camera.zoom,
      fps: Math.round(this.fps * 10) / 10,
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, pixelRatio: this.renderer.getPixelRatio(),
    };
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.listeners.abort(); this.observer.disconnect();
    this.view.dispose(); this.garden.dispose(); this.extraDisposables.forEach(item => item.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
