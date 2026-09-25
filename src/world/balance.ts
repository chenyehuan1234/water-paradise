import { dir } from './types';
import type { WorldObject } from './types';

export type BalanceTilt = -1 | 0 | 1;
export const balancePart = (o: WorldObject) => o.kind === 'balance-end' || o.kind === 'balance-rail' || o.kind === 'balance-pillar';
export const balancePivot = (o: WorldObject) => o.y + (o.mastHeight ?? 2);
export function balanceCell(o: WorldObject, offset: number) {
  const d = dir(o.direction); return { x: o.x + d.x * offset, z: o.z + d.z * offset };
}
export function balanceParts(o: WorldObject, tilt: BalanceTilt): WorldObject[] {
  const pivot = balancePivot(o),at = (offset:number) => balanceCell(o,offset);
  const end = (side:-1|1):WorldObject => ({id:`${o.id}:end:${side}`,kind:'balance-end',...at(side*2),y:pivot-side*tilt,direction:o.direction,balanceId:o.id,balanceSide:side});
  const rails = [-1,0,1].map(offset=>({id:`${o.id}:rail:${offset}`,kind:'balance-rail' as const,...at(offset),y:pivot,direction:o.direction,balanceId:o.id}));
  const pillar:WorldObject = {id:`${o.id}:pillar`,kind:'balance-pillar',x:o.x,y:o.y,z:o.z,direction:o.direction,mastHeight:o.mastHeight??2,balanceId:o.id};
  return [end(-1),end(1),...rails,pillar];
}
