import {drawTwingateBody} from "./enemies/TwingateArt";
import {drawCounterbeatBody} from "./enemies/CounterbeatArt";
import {drawTraceBody} from "./enemies/TraceCourtArt";
import {drawGraveBody} from "./enemies/EchoGraveArt";
import {drawLeadBody} from "./enemies/LeadFoundryArt";
import {drawEclipseBody} from "./enemies/EclipseArt";
import {drawEdgeBody} from "./enemies/EdgeCourtArt";
import {drawKilnBody} from "./enemies/KilnArt";
import {drawLoomBody} from "./enemies/LoomArt";
import {drawLibraryBody} from "./enemies/LibraryArt";
import {drawWindBody} from "./enemies/WindArt";
import {drawRootBody} from "./enemies/RootArt";
import {drawPrismBody} from "./enemies/PrismArt";
import { drawTideBody } from "./enemies/TideArt";
import { drawBellBody } from "./enemies/BellArt";
import { Graphics } from "cc";
import {STAGE_IDS} from "../../battle/ProgressionConfig";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import type { Enemy } from "../../battle/SurvivalTypes";
import { isElite, isLarge } from "../../battle/SurvivalConfig";
import { bossExposed } from "../../battle/BossSystem";
import { createPose, updatePose, torsoOffset, type Pose } from "./Actor";
import { enemyArt, isDeviceKind, type EnemyArt } from "./EnemyCatalog";
import { detailPoly, groundShadow } from "./Brush";
import { ink as inkColor } from "./Ink";
import { drawSiegeBody } from "./enemies/SiegeArt";
import { drawSandBody } from "./enemies/SandArt";
import { drawThunderBody } from "./enemies/ThunderArt";
import { drawMoonBody } from "./enemies/MoonArt";
import { drawHeroBody, drawHeroShadow } from "./HeroPainter";
import { warningGlyph } from "./VfxBrush";

/** Stages whose bodies/overlays are fully owned by the new art layer. */
const CONVERTED = new Set<number>(STAGE_IDS);

const visible: Enemy[] = [];
const pose = createPose();

function collect(w: SurvivalWorld) {
  visible.length = 0;
  for (const enemy of w.enemies)
    if (enemy.hp > 0 && w.visible(enemy, 1.5)) visible.push(enemy);
  visible.sort((a, b) => b.y - a.y || a.id - b.id);
  return visible;
}

function bodyFor(g: Graphics, w: SurvivalWorld, enemy: Enemy, art: EnemyArt) {
  switch (w.stageId) {
    case 19: drawTwingateBody(g,w,enemy,art,pose); break;
    case 18: drawCounterbeatBody(g,w,enemy,art,pose); break;
    case 17: drawTraceBody(g,w,enemy,art,pose); break;
    case 16: drawGraveBody(g,w,enemy,art,pose); break;
    case 15: drawLeadBody(g,w,enemy,art,pose); break;
    case 14: drawEclipseBody(g,w,enemy,art,pose); break;
    case 13: drawEdgeBody(g,w,enemy,art,pose); break;
    case 12: drawKilnBody(g,w,enemy,art,pose); break;
    case 11: drawLoomBody(g,w,enemy,art,pose); break;
    case 10: drawLibraryBody(g,w,enemy,art,pose); break;
    case 9: drawWindBody(g,w,enemy,art,pose); break;
    case 8: drawRootBody(g,w,enemy,art,pose); break;
    case 7: drawPrismBody(g,w,enemy,art,pose); break;
    case 6: drawTideBody(g,w,enemy,art,pose); break;
    case 5: drawBellBody(g,w,enemy,art,pose); break;
    case 2:
      drawSandBody(g, w, enemy, art, pose);
      break;
    case 3:
      drawThunderBody(g, w, enemy, art, pose);
      break;
    case 4:
      drawMoonBody(g, w, enemy, art, pose);
      break;
    case 1:
      drawSiegeBody(g, w, enemy, art, pose);
      break;
    default: {const missing:never=w.stageId;throw Error(`Missing stage body renderer: ${missing}`);}
  }
}

export function drawActorLayer(g: Graphics, w: SurvivalWorld, reduced: boolean, drawHero = true) {
  const list = collect(w);

  // Shadows first so overlapping bodies never stamp a shadow on top.
  for (const enemy of list) {
    const art = enemyArt(w.stageId, enemy.kind);
    updatePose(pose, w, enemy, art, reduced);
    const converted = CONVERTED.has(w.stageId);
    const halfWidth = converted ? art.halfWidth : isLarge(enemy.kind) ? 27 : 17;
    groundShadow(g, pose, halfWidth, enemy.state === "arriving" ? 0.8 : 1, 62, art.detail < 3);
  }

  if (drawHero) drawHeroShadow(g, w);

  // Bodies, sorted by feet Y; the hero is inserted at its own depth.
  let heroDrawn = !drawHero;
  for (const enemy of list) {
    if (!heroDrawn && enemy.y < w.player.y) {
      drawHeroBody(g, w);
      heroDrawn = true;
    }
    const art = enemyArt(w.stageId, enemy.kind);
    updatePose(pose, w, enemy, art, reduced);
    bodyFor(g, w, enemy, art);
  }
  if (!heroDrawn) drawHeroBody(g, w);
}

/* ---------------- overlays / warnings (top layer) ---------------- */

function hpBar(g: Graphics, x: number, y: number, width: number, ratio: number, color: string, elite: boolean) {
  g.fillColor = inkColor("#160f15", 220);
  g.rect(x - width / 2, y, width, 5);
  g.fill();
  g.fillColor = inkColor(color);
  g.rect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 5);
  g.fill();
  g.strokeColor = inkColor("#080b10", 190);
  g.lineWidth = 1;
  g.rect(x - width / 2, y, width, 5);
  g.stroke();
}

function diamond(g: Graphics, x: number, y: number, r: number, color: string, alpha = 230) {
  g.fillColor = inkColor(color, alpha);
  g.moveTo(x, y + r);
  g.lineTo(x + r * 0.7, y);
  g.lineTo(x, y - r);
  g.lineTo(x - r * 0.7, y);
  g.close();
  g.fill();
}

function iceShell(g: Graphics, pose: Pose, art: EnemyArt, time: number) {
  const h = art.height,
    hw = art.halfWidth;
  g.strokeColor = inkColor("#c9f6ff", 170);
  g.lineWidth = Math.max(1, 1.6 * pose.scale);
  for (let i = 0; i <= 8; i++) {
    const a = i * Math.PI / 4;
    const x = pose.x + Math.cos(a) * (hw + 5) * pose.scale;
    const y = pose.y + (h * .48 + pose.lift + Math.sin(a) * h * .42) * pose.scale;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const shards = art.detail >= 3 ? 6 : art.detail >= 1 ? 4 : 2;
  for (let i = 0; i < shards; i++) {
    const a = (i * Math.PI * 2) / shards + 0.2;
    const u = Math.cos(a) * (hw + 5),
      v = h * 0.48 + Math.sin(a) * h * 0.42;
    detailPoly(
      g,
      pose,
      [
        [u - 2.4, v],
        [u + 2.4, v + 1.5],
        [u + 0.2, v + 6 + Math.sin(time * 4 + i) * 1.2],
      ],
      "#bff4ff",
      190,
    );
  }
}

function burnRing(g: Graphics, pose: Pose, art: EnemyArt, time: number) {
  const h = art.height,
    hw = art.halfWidth;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.35 + time * 2.2;
    const u = Math.cos(a) * hw * 0.9,
      v = h * 0.45 + Math.sin(a) * h * 0.32;
    detailPoly(
      g,
      pose,
      [
        [u - 3, v - 3],
        [u, v + 8 + Math.sin(time * 12 + i) * 2],
        [u + 3, v - 3],
      ],
      i % 2 ? "#ff7435" : "#ffb455",
      190,
    );
  }
}

function slowRing(g: Graphics, pose: Pose, art: EnemyArt) {
  g.strokeColor = inkColor("#8fe8ff", 120);
  g.lineWidth = Math.max(1, 1.4 * pose.scale);
  g.ellipse(pose.x, pose.y - 2 * pose.scale, art.halfWidth * pose.scale * 1.25, 5 * pose.scale);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.4;
    detailPoly(
      g,
      pose,
      [
        [Math.cos(a) * art.halfWidth * 1.1 - 1.4, 1],
        [Math.cos(a) * art.halfWidth * 1.1 + 1.4, 1],
        [Math.cos(a) * art.halfWidth * 1.1, 5],
      ],
      "#bff4ff",
      150,
    );
  }
}

function shieldArc(g: Graphics, w: SurvivalWorld, enemy: Enemy, pose: Pose, art: EnemyArt) {
  if (enemy.kind !== "thornshield") return;
  const raised =
    enemy.hp > 0 &&
    enemy.state !== "arriving" &&
    enemy.freezeUntil <= w.time &&
    (enemy.shieldClock ?? 0) < 3;
  const thorn = art.look.shield === "thorn";
  const headR = art.height * 0.115;
  const s = headR * (thorn ? 1.9 : 1.45) * pose.scale;
  const shoulderW = art.height * 0.17 * art.look.bulk;
  const x = pose.x + shoulderW * (thorn ? 1.3 : 1.1) * pose.scale * pose.face;
  const y = pose.y + (art.height * 0.4 + (thorn ? 14 : 10) + torsoOffset(pose)) * pose.scale;
  g.strokeColor = inkColor(raised ? "#ffd887" : "#8993a0", raised ? 245 : 100);
  g.lineWidth = raised ? 4 : 1.5;
  g.moveTo(x - s * 0.7, y + s * 1.02);
  g.lineTo(x + s * 0.7, y + s * 1.02);
  g.lineTo(x + s * 0.7, y - s * 0.88);
  g.lineTo(x, y - s * 1.12);
  g.lineTo(x - s * 0.7, y - s * 0.88);
  g.close();
  g.stroke();
  if (raised && enemy.shieldPartner) {
    const partner = w.enemies.find((other) => other.id === enemy.shieldPartner && other.hp > 0);
    if (partner && Math.hypot(partner.x - enemy.x, partner.y - enemy.y) <= 2) {
      g.strokeColor = inkColor("#ffd887", 150);
      g.lineWidth = 1.5;
      g.moveTo(x, y);
      g.lineTo(partner.x * 48, partner.y * 48 + 18);
      g.stroke();
    }
  }
  if ((enemy.siegeShield ?? 0) > 0 && (enemy.siegeShieldUntil ?? 0) > w.time) {
    const yBar = pose.y + (enemyArt(w.stageId, enemy.kind).height + 15) * pose.scale;
    hpBar(g, x, yBar, 40 * pose.scale, enemy.siegeShield! / Math.max(1, enemy.maxHp * 0.15), "#ffe29b", false);
  }
}

function bossOverlay(g: Graphics, w: SurvivalWorld, enemy: Enemy, pose: Pose, art: EnemyArt) {
  if (enemy.kind !== "boss") return;
  const exposed = bossExposed(w, enemy);
  const phase = enemy.bossPhase;
  if(w.stageId>=10){
    const y=pose.y+(art.height+22)*pose.scale;
    g.strokeColor=inkColor("#f2dfb6");g.lineWidth=3;
    for(let i=0;i<phase;i++){const x=pose.x+(i-(phase-1)/2)*9;g.moveTo(x,y);g.lineTo(x,y+13);}g.stroke();
  }
  const r = (art.halfWidth + 9) * pose.scale + (enemy.state === "windup" ? Math.sin(w.time * 8) * 4 : 0);
  g.strokeColor = inkColor(exposed ? "#f6d886" : phase >= 2 ? "#ef8096" : "#b8a3db", 210);
  g.lineWidth = exposed ? 4 : 2;
  const cy = pose.y + (art.height * .6 + pose.lift) * pose.scale;
  for (const side of [-1, 1]) {
    g.moveTo(pose.x+side*r*.92,cy+r*.4);
    g.lineTo(pose.x+side*r*1.08,cy);
    g.lineTo(pose.x+side*r*.92,cy-r*.4);
  }
  g.stroke();
  if (exposed) {
    const y = pose.y + (art.height + 16) * pose.scale;
    g.strokeColor = inkColor("#f6d886", 240);
    g.lineWidth = 3;
    g.moveTo(pose.x - 14, y);
    g.lineTo(pose.x, y + 9);
    g.lineTo(pose.x + 14, y);
    g.stroke();
  } else if (enemy.state === "windup") {
    const y = pose.y + (art.height + 14) * pose.scale;
    g.strokeColor = inkColor("#ff9a8a", 220);
    g.lineWidth = 2;
    g.moveTo(pose.x - 18, y);
    g.lineTo(pose.x, y + 10);
    g.lineTo(pose.x + 18, y);
    g.stroke();
  }
}

export function drawEnemyWarnings(g: Graphics, w: SurvivalWorld, reduced: boolean) {
  const list = collect(w);
  for (const enemy of list) {
    const art = enemyArt(w.stageId, enemy.kind);
    updatePose(pose, w, enemy, art, reduced);
    const converted = CONVERTED.has(w.stageId);
    const large = isLarge(enemy.kind);
    const elite = isElite(enemy.kind);
    const top = pose.y + (art.height + pose.lift) * pose.scale;
    const barY = top + 7 * pose.scale;

    // The old thunder device body still draws its own bar until stage 3 is converted.
    const oldDeviceBar = w.stageId === 3 && isDeviceKind(enemy.kind) && !CONVERTED.has(3);
    if (!oldDeviceBar && (enemy.hp < enemy.maxHp || large)) {
      const color = large ? "#eac681" : "#f39a80";
      hpBar(g, pose.x, barY, (large ? 44 : 40) * pose.scale, enemy.hp / enemy.maxHp, color, elite);
    }
    if (elite && enemy.kind !== "boss") {
      // One path for all three diamonds keeps the elite marker at one draw call.
      const y = top;
      g.fillColor = inkColor("#f2c66d", 220);
      for (const [dx, dy, r] of [[-9, 14, 4.2], [0, 19, 5.4], [9, 14, 4.2]] as const) {
        const x = pose.x + dx * pose.scale,
          yy = y + dy * pose.scale;
        g.moveTo(x, yy + r);
        g.lineTo(x + r * 0.7, yy);
        g.lineTo(x, yy - r);
        g.lineTo(x - r * 0.7, yy);
        g.close();
      }
      g.fill();
    }
    if (enemy.state === "windup") {
      const weapon = art.look.weapon;
      const symbol = weapon === "claw" ? "claw" : weapon === "sickle" ? "sweep" :
        weapon === "spit" || weapon === "crossbow" ? "line" : "charge";
      warningGlyph(g, pose.x, top + (elite ? 36 : 18), symbol, pose.windup ? "#ffb18f" : "#fff0ce", !pose.windup);
    }
    if (enemy.state === "arriving") {
      g.strokeColor = inkColor("#e2b87f", 170);
      g.lineWidth = 2;
      g.circle(pose.x, pose.y, 24 * pose.scale + Math.sin(w.time * 10) * 4);
      g.stroke();
    }
    if (enemy.freezeUntil > w.time) {
      iceShell(g, pose, art, w.time);
    }
    if (enemy.burnUntil > w.time) burnRing(g, pose, art, w.time);
    if (enemy.slowUntil > w.time && enemy.freezeUntil <= w.time) slowRing(g, pose, art);
    if (converted && enemy.state === "recover" && (enemy.lead?.vulnerable || enemy.eclipse?.vulnerable || enemy.edge?.vulnerable || enemy.kiln?.vulnerable || enemy.loom?.vulnerable || enemy.library?.vulnerable || enemy.wind?.vulnerable || enemy.root?.vulnerable || enemy.prism?.vulnerable || enemy.tide?.vulnerable || enemy.sand?.vulnerable || enemy.thunder?.vulnerable || enemy.moon?.vulnerable || bossExposed(w, enemy))) {
      g.strokeColor = inkColor("#ffe0a5", 235);
      g.lineWidth = 2.5;
      const y = top + 11 * pose.scale;
      g.moveTo(pose.x - 10, y);
      g.lineTo(pose.x, y - 6);
      g.lineTo(pose.x + 10, y);
      g.stroke();
    }
    shieldArc(g, w, enemy, pose, art);
    bossOverlay(g, w, enemy, pose, art);
    if (isDeviceKind(enemy.kind) && CONVERTED.has(3) && enemy.thunder) {
      const remain = Math.max(0, Math.ceil((enemy.thunder.expires ?? w.time) - w.time));
      for (let i = 0; i < Math.min(8, remain); i++) {
        g.fillColor = inkColor("#c8d6cf", 190);
        g.rect(pose.x - 17 + i * 5, barY + 8, 3, 3);
        g.fill();
      }
    }
  }
}
