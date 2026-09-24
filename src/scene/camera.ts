import { MathUtils, OrthographicCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DisplaySceneConfig } from './config';

export class GardenCamera {
  readonly camera = new OrthographicCamera(-8, 8, 6, -6, .1, 100);
  readonly controls: OrbitControls;
  private target = new Vector3(0, .85, 0);
  private spanX = 13;
  private spanY = 13.5;
  private distance = 20;
  constructor(canvas: HTMLCanvasElement, private config: DisplaySceneConfig['camera']) {
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true; this.controls.dampingFactor = .08;
    this.controls.rotateSpeed = .65; this.controls.zoomSpeed = .8;
    this.controls.minPolarAngle = MathUtils.degToRad(90 - config.maxElevation);
    this.controls.maxPolarAngle = MathUtils.degToRad(90 - config.minElevation);
    this.controls.minZoom = config.minZoom; this.controls.maxZoom = config.maxZoom;
    this.reset();
  }

  resize(width: number, height: number) {
    const aspect = width / Math.max(height, 1);
    const span = Math.max(this.spanY, this.spanX / aspect);
    this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix();
  }

  setView(azimuth: number, elevation: number) {
    // Clear inertia so reset is exact even during a drag deceleration.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false; this.controls.update();
    const polar = MathUtils.degToRad(90 - MathUtils.clamp(elevation, this.config.minElevation, this.config.maxElevation));
    this.camera.position.copy(new Vector3().setFromSpherical(new Spherical(this.distance, polar, MathUtils.degToRad(azimuth))).add(this.target));
    this.controls.target.copy(this.target);
    this.controls.update(); this.controls.enableDamping = damping;
  }

  reset() { this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.setView(this.config.azimuth, this.config.elevation); }
  frameLevel(width: number, depth: number, height: number) {
    this.target.set(0, height * .35, 0);
    this.spanX = Math.max(11, (width + depth) * .72 + 1);
    this.spanY = Math.max(13, (width + depth) * .46 + height * .8 + 6);
    this.distance = Math.max(20, Math.hypot(width, depth) + height + 15);
    this.camera.far = 250;
    this.reset();
  }
  dispose() { this.controls.dispose(); }
}
