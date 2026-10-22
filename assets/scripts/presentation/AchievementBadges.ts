import { Graphics } from "cc";
import type { GameBootstrap } from "../GameBootstrap";
import { ink } from "./art/Ink";
const BADGES = new Map<string, { name: string; draw: (g: Graphics) => void }>([
  [
    "grave_twelve_paths",
    {
      name: "GraveAchievementBadge",
      draw: (g) => {
        g.strokeColor = ink("#ceb2e8");
        g.lineWidth = 2;
        for (const side of [-1, 1]) {
          g.moveTo(side * 3, -10);
          g.lineTo(side * 16, -4);
          g.lineTo(side * 13, 12);
          g.lineTo(side * 3, 16);
          g.stroke();
        }
      },
    },
  ],
  [
    "lead_twelve_paths",
    {
      name: "LeadAchievementBadge",
      draw: (g) => {
        g.strokeColor = ink("#c8e1d6");
        g.lineWidth = 3;
        g.moveTo(-16, -8);
        g.quadraticCurveTo(0, 22, 16, -8);
        g.stroke();
        g.fillColor = ink("#e8c39b");
        g.circle(0, 9, 5);
        g.fill();
      },
    },
  ],
  [
    "eclipse_twelve_paths",
    {
      name: "EclipseAchievementBadge",
      draw: (g) => {
        g.strokeColor = ink("#ecd092");
        g.lineWidth = 3;
        g.circle(0, 0, 13);
        g.moveTo(-17, 0);
        g.lineTo(17, 0);
        g.moveTo(0, -17);
        g.lineTo(0, 17);
        g.stroke();
        g.fillColor = ink("#fff3cd");
        g.circle(0, 0, 4);
        g.fill();
      },
    },
  ],
  [
    "edge_twelve_paths",
    {
      name: "EdgeAchievementBadge",
      draw: (g) => {
        g.strokeColor = ink("#d4dfcc");
        g.lineWidth = 3;
        g.moveTo(-14, -11);
        g.lineTo(10, 13);
        g.lineTo(14, 8);
        g.lineTo(-10, -14);
        g.moveTo(-12, 10);
        g.lineTo(-1, 0);
        g.moveTo(2, -2);
        g.lineTo(13, -12);
        g.stroke();
      },
    },
  ],
  [
    "kiln_ten_paths",
    {
      name: "KilnAchievementBadge",
      draw: (g) => {
        g.strokeColor = ink("#efbf8e");
        g.lineWidth = 3;
        g.circle(0, 0, 14);
        g.moveTo(-5, -12);
        g.lineTo(1, -4);
        g.lineTo(-4, 2);
        g.lineTo(5, 12);
        g.moveTo(0, -5);
        g.lineTo(9, -2);
        g.stroke();
      },
    },
  ],
  [
    "loom_eight_paths",
    {
      name: "LoomAchievementBadge",
      draw: (g) => {
        g.strokeColor = ink("#d9c0f0");
        g.lineWidth = 3;
        for (let v = -1; v <= 1; v++) {
          g.moveTo(v * 8 - 13, -9);
          g.lineTo(v * 8 + 13, 9);
          g.moveTo(v * 8 - 13, 9);
          g.lineTo(v * 8 + 13, -9);
        }
        g.stroke();
      },
    },
  ],
]);
export function drawAchievementBadge(
  h: ReturnType<GameBootstrap["menuContext"]>,
  id: string,
  y: number,
) {
  const entry = BADGES.get(id);
  if (!entry) return;
  const node = h.make(entry.name, h.overlay);
  node.setPosition(425, y + 29);
  entry.draw(node.addComponent(Graphics));
}
