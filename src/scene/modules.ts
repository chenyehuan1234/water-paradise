import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group, IcosahedronGeometry,
  InstancedMesh, Material, Mesh, Object3D, PlaneGeometry, Shape, ExtrudeGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { GardenMaterials } from './materials';
import { palette } from './config';

/** Reusable geometry and deterministic procedural modules; no asset downloads. */
export class Modules {
  readonly group = new Group();
  private geometries = new Map<string, BufferGeometry>();
  private leaves: { position: number[]; scale: number[]; rotation: number[]; color: string }[] = [];
  private seed = 1409;
  constructor(readonly materials: GardenMaterials) {}

  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  geometry(key: string, factory: () => BufferGeometry) {
    if (!this.geometries.has(key)) this.geometries.set(key, factory());
    return this.geometries.get(key)!;
  }

  block(x: number, y: number, z: number, w: number, h: number, d: number, material: Material = this.materials.stone, radius = .055) {
    const key = `box-${w}-${h}-${d}-${radius}`;
    const geometry = this.geometry(key, () => radius > 0
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4))
      : new BoxGeometry(w, h, d));
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  tiles(positions: readonly (readonly [number, number, number])[], material: Material, size = .97) {
    const geometry = this.geometry(`tile-${size}`, () => new RoundedBoxGeometry(size, .16, size, 2, .035));
    const mesh = new InstancedMesh(geometry, material, positions.length);
    const dummy = new Object3D();
    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const value = .94 + this.random() * .09;
      mesh.setColorAt(i, new Color(value, value * (.98 + this.random() * .02), value * .98));
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  rod(a: readonly [number, number, number], b: readonly [number, number, number], radius = .025, material: Material = this.materials.metal) {
    const geometry = this.geometry(`rod-${radius}`, () => new CylinderGeometry(radius, radius, 1, 8));
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...a);
    const target = new Object3D(); target.position.set(...b);
    const delta = target.position.sub(mesh.position);
    mesh.position.addScaledVector(delta, .5);
    mesh.scale.y = delta.length();
    mesh.quaternion.setFromUnitVectors(Object3D.DEFAULT_UP, delta.normalize());
    mesh.castShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  arch(x: number, ground: number, z: number) {
    const radius = 1.05, thickness = .24, stem = 1.24;
    this.block(x - radius + thickness / 2, ground + stem / 2, z, thickness, stem, .38, this.materials.light);
    this.block(x + radius - thickness / 2, ground + stem / 2, z, thickness, stem, .38, this.materials.light);
    for (const dx of [-radius + thickness / 2, radius - thickness / 2]) {
      this.block(x + dx, ground + .1, z, .4, .2, .52, this.materials.cap);
      this.block(x + dx, ground + stem - .04, z, .34, .13, .46, this.materials.cream);
    }
    const shape = new Shape();
    shape.absarc(0, 0, radius, 0, Math.PI, false);
    shape.lineTo(-radius + thickness, 0);
    shape.absarc(0, 0, radius - thickness, Math.PI, 0, true);
    shape.closePath();
    const geometry = this.geometry('arch', () => new ExtrudeGeometry(shape, { depth: .3, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 24 }));
    const mesh = new Mesh(geometry, this.materials.light);
    mesh.position.set(x, ground + stem, z - .15);
    mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
    // The small keystone gives the otherwise quiet silhouette one clear accent.
    this.block(x, ground + stem + radius - .03, z, .23, .32, .43, this.materials.cap);
  }

  plant(x: number, y: number, z: number, size = 1, trailing = false) {
    const colors = [palette.foliage, palette.foliageLight, palette.foliageDark];
    for (let i = 0; i < 11; i++) {
      const angle = this.random() * Math.PI * 2;
      const distance = this.random() * .32 * size;
      const down = trailing ? (i / 11) * .75 * size : 0;
      this.leaves.push({
        position: [x + Math.cos(angle) * distance, y + .12 + this.random() * .25 * size - down, z + Math.sin(angle) * distance + (trailing ? i / 11 * .2 : 0)],
        scale: [(.13 + this.random() * .1) * size, (.18 + this.random() * .12) * size, (.11 + this.random() * .08) * size],
        rotation: [this.random() * .6, angle, (this.random() - .5) * 1.4],
        color: colors[i % colors.length],
      });
    }
  }

  finishPlants() {
    const geometry = this.geometry('leaf', () => new IcosahedronGeometry(1, 1));
    const mesh = new InstancedMesh(geometry, this.materials.leaves, this.leaves.length);
    const dummy = new Object3D();
    this.leaves.forEach((leaf, i) => {
      dummy.position.set(leaf.position[0], leaf.position[1], leaf.position[2]);
      dummy.scale.set(leaf.scale[0], leaf.scale[1], leaf.scale[2]);
      dummy.rotation.set(leaf.rotation[0], leaf.rotation[1], leaf.rotation[2]);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, new Color(leaf.color));
    });
    mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
  }

  glassRail(x: number, y: number, z: number, width: number, rotation = 0) {
    const group = new Group();
    const geometry = this.geometry(`glass-${width}`, () => new PlaneGeometry(width - .1, .6));
    const glass = new Mesh(geometry, this.materials.glass);
    glass.position.y = .35; glass.renderOrder = 3;
    group.add(glass);
    const rodGeometry = this.geometry('rail-post', () => new CylinderGeometry(.022, .022, 1, 8));
    for (const dx of [-width / 2, width / 2]) {
      const rod = new Mesh(rodGeometry, this.materials.metal);
      rod.position.set(dx, .38, 0); rod.scale.y = .76; rod.castShadow = true; group.add(rod);
    }
    for (const height of [.08, .7]) {
      const rod = new Mesh(rodGeometry, this.materials.metal);
      rod.rotation.z = Math.PI / 2; rod.scale.y = width; rod.position.y = height; group.add(rod);
    }
    group.position.set(x, y, z); group.rotation.y = rotation; this.group.add(group);
  }

  dispose() { this.group.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); }); this.geometries.forEach(g => g.dispose()); Object.values(this.materials).forEach(m => m.dispose()); }
}
