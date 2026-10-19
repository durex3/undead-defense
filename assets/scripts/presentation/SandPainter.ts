import { Graphics } from "cc";
import { SAND_ROCKS, SAND_NESTS, SAND_TRAIL } from "../battle/SandMap";
import { ink } from "./StagePalette";
export function drawSandMap(g: Graphics) {
  g.clear();
  g.fillColor = ink("#594034");
  g.rect(-1152, -1344, 2304, 2688);
  g.fill();
  for (let y = -27; y < 28; y++)
    for (let x = -23; x < 24; x++) {
      g.fillColor = ink((x * 7 + y * 3) % 5 ? "#775240" : "#835b42");
      g.rect(x * 48 + 1, y * 48 + 1, 46, 46);
      g.fill();
      if ((x + y) % 4 === 0) {
        g.strokeColor = ink("#a27350", 120);
        g.lineWidth = 2;
        g.moveTo(x * 48 + 6, y * 48 + 12);
        g.lineTo(x * 48 + 31, y * 48 + 16);
        g.stroke();
      }
    }
  g.strokeColor=ink('#b88e59',100);g.lineWidth=18;
  SAND_TRAIL.forEach((p,i)=>{if(i===0)g.moveTo(p.x*48,p.y*48);else g.lineTo(p.x*48,p.y*48);});g.stroke();
  for(const p of SAND_NESTS){const x=p.x*48,y=p.y*48;
    g.fillColor=ink('#392d35',120);g.ellipse(x,y,100,65);g.fill();
    g.strokeColor=ink('#b89b66',150);g.lineWidth=3;g.ellipse(x,y,100,65);g.stroke();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;g.moveTo(x+Math.cos(a)*85,y+Math.sin(a)*50);g.lineTo(x+Math.cos(a)*115,y+Math.sin(a)*75);}g.stroke();
  }
  for (const p of SAND_ROCKS) {
    const x = (p.x - p.halfWidth) * 48,
      y = (p.y - p.halfHeight) * 48,
      ww = p.halfWidth * 96,
      hh = p.halfHeight * 96;
    g.fillColor = ink("#342e37");
    g.rect(x - 5, y - 7, ww + 10, hh + 14);
    g.fill();
    g.fillColor = ink("#62535a");
    g.rect(x, y, ww, hh);
    g.fill();
    g.fillColor = ink("#8d7270");
    g.rect(x + 7, y + hh - 15, ww - 14, 12);
    g.fill();
    g.strokeColor = ink("#403340");
    g.lineWidth = 5;
    g.moveTo(x + ww * 0.3, y);
    g.lineTo(x + ww * 0.5, y + hh * 0.5);
    g.lineTo(x + ww * 0.2, y + hh);
    g.moveTo(x + ww * 0.7, y + hh * 0.2);
    g.lineTo(x + ww * 0.5, y + hh * 0.5);
    g.lineTo(x + ww, y + hh * 0.7);
    g.stroke();
  }
}