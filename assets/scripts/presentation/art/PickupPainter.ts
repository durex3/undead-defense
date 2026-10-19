import { Graphics } from "cc";
import type { SurvivalWorld } from "../../battle/SurvivalWorld";
import { ink } from "./Ink";

function diamond(g: Graphics, x: number, y: number, r: number, fill: string, edge: string, alpha = 255) {
  g.fillColor = ink(fill, alpha);
  g.strokeColor = ink(edge, alpha);
  g.lineWidth = 1.2;
  g.moveTo(x, y + r);
  g.lineTo(x + r * 0.68, y);
  g.lineTo(x, y - r);
  g.lineTo(x - r * 0.68, y);
  g.close();
  g.fill();
  g.stroke();
}

export function drawPickups(g: Graphics, w: SurvivalWorld) {
  for (const gem of w.gems) {
    if (!w.visible(gem, 1)) continue;
    const x = gem.x * 48,
      y = gem.y * 48;
    // Draw-time emphasis only: magnet range and experience values stay simulation-owned.
    const near = Math.max(0, Math.min(1, (3.2 - Math.hypot(gem.x - w.player.x, gem.y - w.player.y)) / 1.8));
    const scale = 1 + Math.min(0.65, Math.log2(1 + Math.max(0, gem.value - 1)) * 0.12);
    const bob = Math.sin(w.time * 4 + gem.id) * 1.2 * near;
    diamond(g, x, y + bob, 7 * scale, near > .5 ? "#56c9aa" : "#488d7b", "#153c32", 180 + Math.round(near * 75));
    if (near > 0) {
      // A single broad facet replaces the distant glow and second outlined jewel.
      g.fillColor = ink("#c5efcc", Math.round(near * 220));
      g.moveTo(x, y + bob + 5 * scale);
      g.lineTo(x - 3 * scale, y + bob);
      g.lineTo(x, y + bob - 2 * scale);
      g.close();
      g.fill();
    }
  }
  for (const potion of w.potions) {
    if (potion.expires !== undefined && potion.expires <= w.time) continue;
    const x = potion.x * 48,
      y = potion.y * 48 + 8;
    const fading = potion.expires !== undefined && potion.expires - w.time < 5;
    const alpha = fading && Math.floor(w.time * 6) % 2 ? 80 : 255;
    const bob = Math.sin(w.time * 3 + potion.id) * 1.8;
    // Ground glow.
    g.fillColor = ink("#ff9a9a", Math.round(alpha * 0.16));
    g.circle(x, y + bob - 2, 10);
    g.fill();
    // Bottle body.
    g.fillColor = ink("#7a2630", alpha);
    g.strokeColor = ink("#2a1014", alpha);
    g.lineWidth = 1.3;
    g.roundRect(x - 6, y - 8 + bob, 12, 14, 4);
    g.fill();
    g.stroke();
    g.fillColor = ink("#e86b72", alpha);
    g.roundRect(x - 4, y - 6 + bob, 8, 9, 2);
    g.fill();
    // Neck and cork.
    g.fillColor = ink("#d8c8b0", alpha);
    g.rect(x - 2.4, y + 5 + bob, 4.8, 4);
    g.fill();
    g.fillColor = ink("#f0e2c8", alpha);
    g.rect(x - 3.2, y + 8 + bob, 6.4, 2);
    g.fill();
    g.fillColor = ink("#ffe9c9", Math.round(alpha * 0.8));
    g.circle(x - 2, y - 1 + bob, 1.2);
    g.fill();
  }
}
