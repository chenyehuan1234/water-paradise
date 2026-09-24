/** Visual study data only. This is deliberately not a gameplay/level schema. */
export interface PoolAppearance {
  center: readonly [number, number, number];
  size: readonly [number, number];
  flow: readonly [number, number];
  edgeFoam: readonly [number, number, number, number];
  foamGap?: readonly [number, number];
}

export interface DisplaySceneConfig {
  gridSize: number;
  unit: number;
  terraceHeight: number;
  pools: readonly PoolAppearance[];
  waterfall: { center: readonly [number, number, number]; width: number; height: number };
  camera: { azimuth: number; elevation: number; minElevation: number; maxElevation: number; minZoom: number; maxZoom: number };
}

export const palette = {
  stone: '#d9c49e',
  stoneLight: '#ead9b9',
  cap: '#e4baa7',
  cream: '#f4e5cc',
  mortar: '#b9a380',
  ceramic: '#7bb9b6',
  water: '#369faa',
  waterLight: '#a0d8cc',
  foam: '#f1f8e9',
  foliage: '#9eb76a',
  foliageLight: '#c0cf85',
  foliageDark: '#6e9867',
  metal: '#8b946e',
  glass: '#a8d7cf',
} as const;

export const gardenConfig: DisplaySceneConfig = {
  gridSize: 8,
  unit: 1,
  terraceHeight: 1.72,
  pools: [
    { center: [-1.25, 1.91, -2.5], size: [4.6, 1.8], flow: [.1, .28], edgeFoam: [1, 1, 1, 1], foamGap: [3.62, 4.48] },
    { center: [.5, 1.91, -.9], size: [.86, 1.4], flow: [0, .6], edgeFoam: [1, 1, 0, 0] },
    { center: [0, .19, 1.2], size: [5.5, 2.8], flow: [.04, .24], edgeFoam: [1, 1, 1, 1] },
  ],
  waterfall: { center: [.5, 1.05, -.19], width: .86, height: 1.72 },
  camera: { azimuth: 36, elevation: 33, minElevation: 20, maxElevation: 70, minZoom: .72, maxZoom: 1.65 },
};
