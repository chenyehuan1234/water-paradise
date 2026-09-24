import { BufferGeometry, Group, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import { Modules } from './modules';
import { createMaterials } from './materials';
import { WaterVisual } from './water';
import type { DisplaySceneConfig } from './config';

export class Garden {
  readonly group = new Group();
  readonly grid = new Group();
  readonly water: WaterVisual;
  private modules = new Modules(createMaterials());

  constructor(config: DisplaySceneConfig) {
    const m = this.modules, mat = m.materials;
    const n = config.gridSize, unit = config.unit, half = n * unit / 2;
    this.group.name = 'Water Paradise / appearance study';

    // A terraced island, with a thin cap and a quiet, tapered foundation.
    m.block(0, -.78, 0, 8.16, 1.24, 8.16, mat.stone, .12);
    m.block(0, -1.44, 0, 7.9, .18, 7.9, mat.mortar);
    m.block(0, -1.59, 0, 7.65, .2, 7.65, mat.stone);
    m.block(0, -.18, 0, 8.35, .16, 8.35, mat.cream);
    const lowerTiles: [number, number, number][] = [], upperTiles: [number, number, number][] = [];
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
      const px = (x + .5) * unit - half, pz = (z + .5) * unit - half;
      if (z >= 3) lowerTiles.push([px, -.02, pz]);
      if (z < 3) upperTiles.push([px, config.terraceHeight, pz]);
    }
    m.tiles(lowerTiles, mat.light); m.tiles(upperTiles, mat.cap);
    m.block(0, .8, -2.5, 8, 1.62, 3, mat.stone, .06);
    // Shallow blue beds remain readable through the surface.
    m.block(-1.25, 1.815, -2.5, 4.62, .035, 1.82, mat.ceramic, .01);
    m.block(0, .07, 1.2, 5.52, .06, 2.82, mat.ceramic, .02);
    // Large joints on the visible terrace facade, deliberately not brick texture.
    for (const x of [-3, -2, -1, 0, 1, 2, 3]) m.block(x, .84, -.994, .012, 1.35, .014, mat.mortar, 0);
    m.block(0, .7, -.99, 7.8, .018, .02, mat.mortar, 0);

    // Upper pool coping; leave a real opening for the visual channel.
    m.block(-1.25, 1.95, -3.48, 4.87, .22, .18, mat.cream);
    m.block(-3.64, 1.95, -2.5, .18, .22, 2.12, mat.cream);
    m.block(1.14, 1.95, -2.5, .18, .22, 2.12, mat.cream);
    m.block(-1.825, 1.95, -1.52, 3.65, .22, .18, mat.cream);
    m.block(1.075, 1.95, -1.52, .13, .22, .18, mat.cream);
    // The projecting aqueduct has solid sides and a tiled underside.
    m.block(.5, 1.7, -.9, 1.22, .25, 1.5, mat.cap);
    m.block(.5, 1.84, -.9, .87, .025, 1.4, mat.ceramic, .01);
    for (const x of [-.04, 1.04]) m.block(x, 1.98, -.9, .2, .29, 1.49, mat.cream);

    // Low lower-pool curb frames the water without hiding the tile layout.
    m.block(-2.84, .18, 1.2, .18, .28, 3.14, mat.cream);
    m.block(2.84, .18, 1.2, .18, .28, 3.14, mat.cream);
    m.block(0, .18, 2.69, 5.5, .28, .18, mat.cream);

    // Four generous steps on the dry right bank.
    for (let i = 0; i < 4; i++) {
      const top = .43 * (i + 1), z = .95 - i * .55;
      m.block(3.38, top / 2, z, 1.03, top, .55, mat.stone);
      m.block(3.38, top + .035, z, 1.09, .1, .58, mat.cap);
    }

    // Rear parapet and a single open arch; these establish the garden silhouette.
    for (let i = 0; i < 8; i++) {
      const x = i - 3.5;
      m.block(x, 2.04, -3.91, .94, .48, .24, mat.stone);
      m.block(x, 2.3, -3.91, .99, .1, .33, mat.cap);
    }
    m.arch(-1.5, 1.81, -3.38);
    m.block(2.94, 1.94, -2.97, 1.25, .26, 1.15, mat.cream);
    m.block(2.94, 2.1, -2.97, 1.12, .1, 1.02, mat.mortar);
    m.plant(2.8, 2.17, -3.1, 1.25);
    m.plant(3.12, 2.17, -2.85, .9);
    for (const [x, y, z, s] of [
      [-3.66, 1.98, -3.4, .9], [-3.65, 1.83, -1.65, 1.1],
      [3.72, 1.91, -2.2, .9], [-3.65, .14, 2.85, 1.2],
      [-3.7, .04, .5, .85], [3.57, .1, 3.12, .95],
    ]) m.plant(x, y, z, s, true);
    m.plant(-3.6, .08, 3.25, .85);
    // Front / side glazing is intentionally sparse and has very thin framing.
    for (const x of [-1.5, 0, 1.5]) m.glassRail(x, .07, 3.78, 1.5);
    m.glassRail(3.87, .07, 2.26, 1.38, Math.PI / 2);
    for (const x of [-3.94, 3.94]) {
      m.block(x, .22, 3.88, .3, .48, .3, mat.stone);
      m.block(x, .49, 3.88, .4, .1, .4, mat.cap);
    }
    // Larger supports below the island make its construction legible from behind.
    for (const x of [-3.1, 3.1]) for (const z of [-3.9, 3.9]) {
      m.block(x, -.9, z, .42, 1.25, .35, mat.light);
      m.block(x, -.34, z, .54, .12, .47, mat.cap);
    }
    m.finishPlants();
    this.group.add(m.group);
    this.water = new WaterVisual(config); this.group.add(this.water.group);

    const makeGrid = (rows: number, elevation: number, centerZ: number) => {
      const points: Vector3[] = [];
      for (let column = 0; column <= n; column++) {
        const x = (column - n / 2) * unit;
        points.push(new Vector3(x, 0, -rows * unit / 2), new Vector3(x, 0, rows * unit / 2));
      }
      for (let row = 0; row <= rows; row++) {
        const z = (row - rows / 2) * unit;
        points.push(new Vector3(-half, 0, z), new Vector3(half, 0, z));
      }
      const grid = new LineSegments(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: '#376d69', transparent: true, opacity: .45, depthWrite: false }));
      grid.position.set(0, elevation, centerZ); grid.renderOrder = 4;
      return grid;
    };
    const lowerGrid = makeGrid(n - 3, .34, 1.5);
    const upperGrid = makeGrid(3, 2.14, -2.5);
    this.grid.add(lowerGrid, upperGrid); this.grid.visible = false; this.group.add(this.grid);
  }

  dispose() {
    this.modules.dispose(); this.water.dispose();
    this.grid.traverse(object => { if (object instanceof LineSegments) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); } });
  }
}
