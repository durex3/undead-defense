import type { GameBootstrap } from "../GameBootstrap";
import type { StageId } from "../battle/ProgressionConfig";
import { STAGE_IDS, stageNumber } from "../battle/ProgressionConfig";
import { STAGES, STAGE_GUIDES } from "../battle/StageRules";
import { CLEAR_COINS } from "../battle/UnlockConfig";
import { SurvivalWorld } from "../battle/SurvivalWorld";
import { drawStageMap } from "./StageMapPainter";
import { drawActorLayer } from "./art/EnemyPainter";
import { stageMapBackdrop } from "./art/MapArt";
import { Graphics } from "cc";
import { ink } from "./art/Ink";
/** Rendering owns no selection state or persistence. Navigation remains with its controller. */
export function renderStageSelection(
  h: ReturnType<GameBootstrap["menuContext"]>,
  preview: StageId,
  actions: { move(direction: number): void; start(): void },
) {
  h.started = false;
  h.clearInput();
  h.overlay.destroyAllChildren();
  h.panel(h.overlay, 0, 0, 1280, 720, "#131821");
  h.panel(h.overlay, 0, 0, 1100, 650, "#191e2d");
  const index = STAGE_IDS.indexOf(preview);
  const unlocked = h.progress.unlockedStage(preview);
  const best = h.progress.data.stageBest?.[preview];
  h.text(
    h.overlay,
    `账户金币 ${h.progress.coins}`,
    420,
    283,
    20,
    "#f3d798",
    230,
  );
  h.text(
    h.overlay,
    `选择战场 · ${index + 1} / ${STAGE_IDS.length}`,
    0,
    283,
    18,
    "#a9bac4",
  );
  h.text(h.overlay, STAGES[preview].name, 0, 237, 32, "#f3deac", 800);

  // One themed image, using the actual complete map and the stage's own boss art.
  const image = h.panel(h.overlay, 0, 38, 790, 310, stageMapBackdrop(preview));
  image.name = "StageThemePreview";
  const map = h.make("StageMapThumbnail", image);
  map.setPosition(-185, 0);
  map.setScale(0.095, 0.095, 1);
  drawStageMap(map.addComponent(Graphics), preview);
  h.text(image, "战场全貌", -185, -139, 14, "#c4d4d2", 260);
  const portrait = h.make("StageBossPortrait", image);
  portrait.setPosition(165, -62);
  portrait.setScale(1.15, 1.15, 1);
  const study = new SurvivalWorld(19, "ranger", preview);
  study.player = { x: 0, y: -8 };
  study.camera = { x: 0, y: 0 };
  study.time = 0.5;
  const boss = study.addEnemy("boss", 0, 0)!;
  boss.state = "seek";
  if(study.stageStrategy.encounter){boss.x=-1.6;const partner=study.addEnemy("boss",1.6,0)!;partner.state="seek";}
  drawActorLayer(portrait.addComponent(Graphics), study, false, false);
  h.text(image, "首领", 165, 119, 14, "#b5c4cd", 300);
  h.text(image, STAGES[preview].boss, 165, -111, 22, "#f3deac", 340);

  for (const direction of [-1, 1]) {
    const enabled = direction < 0 ? index > 0 : index < STAGE_IDS.length - 1;
    const x = direction * 475;
    if (enabled) {
      const label = h.button(
        h.overlay,
        direction < 0 ? "‹" : "›",
        x,
        38,
        84,
        104,
        () => actions.move(direction),
      );
      label.fontSize = 56;
      label.lineHeight = 70;
    } else {
      const edge = h.panel(h.overlay, x, 38, 84, 104, "#222a36");
      h.text(edge, direction < 0 ? "‹" : "›", 0, 0, 56, "#53606d", 68);
    }
  }
  h.text(h.overlay, STAGE_GUIDES[preview].threat, 0, -144, 16, "#c4d4d2", 940);
  const status = !unlocked
    ? `通关第${stageNumber(preview) - 1}关解锁`
    : best?.won || h.progress.data.stages.includes(preview)
      ? "已通关"
      : "已解锁";
  h.text(
    h.overlay,
    `${status} · 胜利奖励 ${CLEAR_COINS[preview]}金币 · 6分钟迎战首领`,
    0,
    -181,
    17,
    unlocked ? "#b8d4bc" : "#b5b5c3",
    940,
  );
  const dots = h.make("StageCarouselPosition", h.overlay);
  dots.setPosition(0, -212);
  const g = dots.addComponent(Graphics);
  for (let i = 0; i < STAGE_IDS.length; i++) {
    g.fillColor = ink(i === index ? "#f3deac" : "#53606d");
    g.circle((i - (STAGE_IDS.length - 1) / 2) * 18, 0, i === index ? 4.5 : 2.5);
    g.fill();
  }
  h.button(h.overlay, "返回菜单", -175, -263, 270, 54, () => h.showStart());
  if (unlocked)
    h.button(h.overlay, "开始本关", 175, -263, 310, 54, () => actions.start());
  else {
    const locked = h.panel(h.overlay, 175, -263, 310, 54, "#2b313e");
    h.text(locked, "尚未解锁", 0, 0, 20, "#8795a6", 290);
  }
  h.text(
    h.overlay,
    h.touchMode
      ? "点击左右箭头切换关卡"
      : "← → / A D 切换关卡 · Enter 开始 · Esc 返回",
    0,
    -307,
    14,
    "#8fa1b1",
    940,
  );
}
