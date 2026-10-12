import { Graphics, Color } from "cc";
import { GARDEN_STONES } from "../battle/GardenMap";
export function drawGarden(g: Graphics) {
  const fill = (hex: string) => (g.fillColor = new Color().fromHEX(hex));
  fill("#243b38");
  g.rect(-1152, -1344, 2304, 2688);
  g.fill();
  for (let y = -27; y < 28; y++)
    for (let x = -23; x < 24; x++) {
      if (Math.abs(x) < 3 || Math.abs(y) < 2) {
        fill((x + y) % 3 ? "#46504b" : "#505951");
        g.rect(x * 48 + 2, y * 48 + 2, 44, 44);
        g.fill();
        if ((x * 13 + y * 7) % 3 === 0) {
          fill("#293b37");
          g.rect(x * 48 + 13, y * 48 + 6, 3, 14);
          g.rect(x * 48 + 16, y * 48 + 17, 14, 3);
          g.rect(x * 48 + 28, y * 48 + 17, 3, 12);
          g.fill();
        }
        fill("#627066");
        g.rect(x * 48 + 5, y * 48 + 42, 30, 2);
        g.fill();
      } else if ((x * 7 + y * 11) % 5 === 0) {
        fill("#344b3d");
        g.rect(x * 48 + 8, y * 48 + 3, 16, 5);
        g.rect(x * 48 + 16, y * 48 + 8, 4, 8);
        g.fill();
      }
    }
  for (const s of GARDEN_STONES) {
    const x = s.x * 48,
      y = s.y * 48;
    fill("#344441");
    g.circle(x, y, 1.05 * 48);
    g.fill();
    g.strokeColor = new Color().fromHEX("#6b7971");
    g.lineWidth = 2;
    g.circle(x, y, 1.05 * 48);
    g.stroke();
    fill("#171f28");
    g.rect(x - 23, y - 10, 49, 13);
    g.fill();
    fill("#748478");
    g.roundRect(x - 18, y - 5, 36, 53, 9);
    g.fill();
    fill("#4a5c54");
    g.rect(x - 3, y + 8, 6, 29);
    g.rect(x - 11, y + 24, 22, 6);
    g.fill();
  }
  for (const x of [-960, 960])
    for (const y of [-1100, -650, 650, 1100]) {
      fill("#262831");
      g.rect(x - 9, y, 18, 100);
      g.rect(x - 38, y + 45, 76, 12);
      g.rect(x - 38, y + 45, 10, 48);
      g.rect(x + 28, y + 45, 10, 65);
      g.fill();
    }
  g.strokeColor = new Color().fromHEX("#76807a");
  g.lineWidth = 3;
  for (let y = -1200; y <= 1200; y += 60)
    for (const x of [-1100, 1100]) {
      g.moveTo(x, y);
      g.lineTo(x, y + 40);
      g.moveTo(x - 10, y + 25);
      g.lineTo(x + 10, y + 25);
      g.stroke();
    }
}
