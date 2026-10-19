import type { Graphics } from "cc";
import { drawInkMap } from "./art/MapArt";
import type { StageId } from "../battle/ProgressionConfig";

/** Single entry point for stage backgrounds; one call redraws the whole floor. */
export function drawStageMap(g: Graphics, stage: StageId) {
  g.clear();
  drawInkMap(g, stage);
}
