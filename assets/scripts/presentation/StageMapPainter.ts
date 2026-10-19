import type { Graphics } from "cc";
import { drawMoonMap } from "./MoonPainter";
import { drawThunderMap } from "./ThunderPainter";
import { drawSandMap } from "./SandPainter";
import { drawSiegeMap } from "./SiegePainter";
import type { StageId } from "../battle/ProgressionConfig";

/** Single entry point for stage backgrounds; one call redraws the whole floor. */
export function drawStageMap(g: Graphics, stage: StageId) {
  g.clear();
  if (stage === 4) drawMoonMap(g);
  else if (stage === 3) drawThunderMap(g);
  else if (stage === 2) drawSandMap(g);
  else drawSiegeMap(g);
}
