import { Color, DoubleSide, MeshStandardMaterial, MeshPhysicalMaterial } from 'three';
import { palette } from './config';

export function createMaterials() {
  const matte = (color: string, roughness = .85) => new MeshStandardMaterial({ color, roughness, metalness: 0 });
  return {
    stone: matte(palette.stone),
    light: matte(palette.stoneLight),
    cap: matte(palette.cap),
    cream: matte(palette.cream),
    mortar: matte(palette.mortar),
    ceramic: matte(palette.ceramic, .42),
    leaves: new MeshStandardMaterial({ color: '#ffffff', roughness: .9, flatShading: true }),
    metal: new MeshStandardMaterial({ color: palette.metal, roughness: .52, metalness: .45 }),
    glass: new MeshPhysicalMaterial({
      color: new Color(palette.glass), roughness: .28, metalness: .03,
      transparent: true, opacity: .15, depthWrite: false, side: DoubleSide,
    }),
  };
}

export type GardenMaterials = ReturnType<typeof createMaterials>;
