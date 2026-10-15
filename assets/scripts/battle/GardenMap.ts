import { moonMap } from "./MoonMap";
import { thunderMap } from "./ThunderMap";
import { sandMap } from "./SandMap";
import { siegeMap } from "./SiegeMap";
import {isFrontier,frontierMap} from "./FrontierMaps";
import {resolveObservatory} from "./ObservatoryMap";
import {starAirborne} from "./ObservatorySystem";
import {resolveArsenal} from "./ArsenalMap";
import {resolveHarbor} from "./HarborMap";
import { FURNACE_STONES } from "./FurnaceEncounters";
import { CROWN_STONES } from "./CrownSystem";
import type { SurvivalWorld } from "./SurvivalWorld";
import { Point } from "./SurvivalTypes";
export const GARDEN_STONES = [
  { x: -7, y: -7 },
  { x: -7, y: 0 },
  { x: -7, y: 7 },
  { x: 7, y: -7 },
  { x: 7, y: 0 },
  { x: 7, y: 7 },
  { x: -13, y: -12 },
  { x: 13, y: 12 },
];
export const CHURCH_STONES = [{x:-12,y:-4},{x:12,y:-4},{x:-12,y:12},{x:12,y:12}];
export const ALTAR_STONES = [{x:-13,y:-13},{x:13,y:-13},{x:13,y:13},{x:-13,y:13}];
export function resolveGarden(p: Point, radius = 0.3, stones = GARDEN_STONES) {
  for (const stone of stones) {
    const dx = p.x - stone.x,
      dy = p.y - stone.y,
      d = Math.hypot(dx, dy),
      r = 1.05 + radius;
    if (d < r) {
      p.x = stone.x + (d > 0.001 ? dx / d : 1) * r;
      p.y = stone.y + (d > 0.001 ? dy / d : 0) * r;
    }
  }
}
export function stepGarden(w: SurvivalWorld, dt: number) {
  if (w.stageId === 1) return;
  if(w.stageId===17){moonMap.resolve(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")moonMap.resolve(e,e.kind==="boss"?.65:.35);return;}
  if(w.stageId===16){thunderMap.resolve(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")thunderMap.resolve(e,e.kind==="boss"?.65:.35);return;}
  if(w.stageId===15){sandMap.resolve(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")sandMap.resolve(e,e.kind==="boss"?.65:.35);return;}
  if(w.stageId===14){siegeMap.resolve(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")siegeMap.resolve(e,e.kind==="boss"?.65:.35);return;}
  if(isFrontier(w.stageId)){const map=frontierMap(w.stageId);map.resolve(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")map.resolve(e,e.kind==="boss"?.65:.35);return;}
  if(w.stageId===10){resolveObservatory(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving"&&!starAirborne(e))resolveObservatory(e,e.kind==="boss"?.65:.35);return;}
  if(w.stageId===9){resolveArsenal(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")resolveArsenal(e,e.kind==="boss"?.65:.35);return;}
  if(w.stageId===8){resolveHarbor(w.player);for(const e of w.enemies)if(e.hp>0&&e.state!=="arriving")resolveHarbor(e,e.kind==="boss"?.65:.35);return;}
  const stones = w.stageId === 6 ? FURNACE_STONES : w.stageId >= 5 ? CROWN_STONES : w.stageId === 4 ? CHURCH_STONES : w.stageId === 3 ? ALTAR_STONES : GARDEN_STONES;
  resolveGarden(w.player, .3, stones);
  w.player.x = Math.max(-22, Math.min(22, w.player.x));
  w.player.y = Math.max(-26, Math.min(26, w.player.y));
  for (const e of w.enemies) {
    if (e.hp <= 0 || e.state === "arriving") continue;
    if (e.state === "seek")
      for (const s of stones) {
        const dx = e.x - s.x,
          dy = e.y - s.y,
          d = Math.hypot(dx, dy);
        if (d < 1.9 && d > 0.001) {
          const toward = (w.player.x - e.x) * -dy + (w.player.y - e.y) * dx;
          const turn = Math.sign(toward) || 1;
          e.x += (-dy / d) * turn * 1.8 * dt;
          e.y += (dx / d) * turn * 1.8 * dt;
        }
      }
    if (e.state === "seek" || e.state === "charge") {
      const x = e.x,
        y = e.y;
      resolveGarden(e, 0.35, stones);
      if (e.state === "charge" && Math.hypot(e.x - x, e.y - y) > 0.01) {
        e.state = "recover";
        e.timer = 1;
        w.hazards = w.hazards.filter((h) => h.source !== e.id);
      }
    }
  }
}
