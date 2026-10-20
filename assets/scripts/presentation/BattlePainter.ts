import { drawSupportSpells } from "./art/SupportSpellArt";
import { drawUnlockedSpells } from "./art/UnlockedSpellArt";
import { drawExtraArmory } from "./ExtraArmoryPainter";
import { Graphics } from "cc";
import { SurvivalWorld, Effect } from "../battle/SurvivalWorld";
import { drawActorLayer, drawEnemyWarnings } from "./art/EnemyPainter";
import { drawHazards, drawBossCastSignals } from "./art/HazardPainter";
import { drawPickups } from "./art/PickupPainter";
import { crowdedEffects } from "./art/VisualDensity";
import { drawHeroReadability } from "./art/HeroPainter";
import {
  drawGroundFields,
  drawProjectiles,
  spawnParticles,
  updateParticles,
  resetParticles,
} from "./art/SpellPainter";
export class BattlePainter {
 constructor(private g:Graphics, private options: { noHero?: boolean } = {}){}
 reset(){resetParticles();}
 draw(w:SurvivalWorld,dt:number,events:Effect[],reduced=false){const g=this.g;g.clear();
 const boss=w.enemies.find(e=>e.kind==='boss'&&e.hp>0);
 const casting=!!boss&&w.hazards.some(h=>h.source===boss.id&&h.created<=w.time&&h.until>w.time);
 const crowded=crowdedEffects(w)||casting;
 spawnParticles(events, reduced, w.stageId);
 drawGroundFields(g,w,reduced,crowded);
 drawExtraArmory(g,w,true,reduced,crowded);
    drawActorLayer(g, w, reduced, !this.options.noHero);
    drawPickups(g, w);
    drawProjectiles(g, w, reduced,crowded);
    drawExtraArmory(g,w,false,reduced,crowded);
    drawUnlockedSpells(g,w,reduced,crowded);
    drawSupportSpells(g,w);
    updateParticles(g, dt, reduced);
    if (crowded && !this.options.noHero) drawHeroReadability(g, w);
    drawEnemyWarnings(g, w, reduced);
    drawHazards(g, w, reduced);
    drawBossCastSignals(g, w);
  }

}
