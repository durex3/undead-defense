import fs from "node:fs";
import ts from "typescript";
import { SurvivalWorld } from "../temp/tests/battle/SurvivalWorld.mjs";
import {
  ALL_WEAPONS,
  ENEMY_KINDS,
  ENEMIES,
  NAMES,
  COLORS,
  WEAPON_ROLES,
} from "../temp/tests/battle/SurvivalConfig.mjs";
import { STAGE_IDS } from "../temp/tests/battle/ProgressionConfig.mjs";
import { STAGES, STAGE_GUIDES } from "../temp/tests/battle/StageRules.mjs";
import {
  ACHIEVEMENTS,
  CLEAR_COINS,
  STAGE_CLEAR_IDS,
} from "../temp/tests/battle/UnlockConfig.mjs";
import { MODS, weaponStats } from "../temp/tests/battle/ArmoryConfig.mjs";
import { WEAPON_BALANCE } from "../temp/tests/battle/WeaponBalance.mjs";
import {
  validGrade,
  initialGrade,
  weaponName,
} from "../temp/tests/battle/WeaponGrade.mjs";
import { WEAPON_FAMILY_ORDER } from "../temp/tests/battle/WeaponStrategies.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { stageHud } from "../temp/tests/presentation/StageHud.mjs";
import {
  CATALOG_STAGE_KINDS,
  BOSS_ART,
  enemyArt,
  catalogStage,
} from "../temp/tests/presentation/art/EnemyCatalog.mjs";
import { STAGE_MAP_COLORS } from "../temp/tests/presentation/art/MapArt.mjs";
import { drawActorLayer } from "../temp/tests/presentation/art/EnemyPainter.mjs";
import { drawWeaponGlyph } from "../temp/tests/presentation/art/WeaponGlyph.mjs";
import { drawStageMap } from "../temp/tests/presentation/StageMapPainter.mjs";
import {
  drawGroundFields,
  drawProjectiles,
} from "../temp/tests/presentation/art/SpellPainter.mjs";
import { drawExtraSpell } from "../temp/tests/presentation/art/spells/ExtraSpellArt.mjs";
import { drawUnlockedSpells } from "../temp/tests/presentation/art/UnlockedSpellArt.mjs";
import { drawSupportSpells } from "../temp/tests/presentation/art/SupportSpellArt.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
// Check literal rule references without maintaining a second handwritten achievement list.
function settlementReferences() {
  const source = ts.createSourceFile(
    "AchievementRules.ts",
    fs.readFileSync(
      new URL("../assets/scripts/battle/AchievementRules.ts", import.meta.url),
      "utf8",
    ),
    ts.ScriptTarget.Latest,
    true,
  );
  const ids = new Set(STAGE_CLEAR_IDS.filter(Boolean));
  const visit = (node) => {
    if (ts.isStringLiteral(node)) ids.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return ids;
}
/** Runtime cross-registration audit. Overrides support omission tests without changing production data. */
export function auditContent(overrides = {}) {
  const c = {
    stageIds: STAGE_IDS,
    skills: ALL_WEAPONS,
    kinds: ENEMY_KINDS,
    enemies: ENEMIES,
    names: NAMES,
    colors: COLORS,
    roles: WEAPON_ROLES,
    stages: STAGES,
    guides: STAGE_GUIDES,
    stageKinds: CATALOG_STAGE_KINDS,
    bossArt: BOSS_ART,
    mapColors: STAGE_MAP_COLORS,
    mods: MODS,
    budgets: WEAPON_BALANCE,
    achievements: ACHIEVEMENTS,
    clearIds: STAGE_CLEAR_IDS,
    clearCoins: CLEAR_COINS,
    settlementIds: settlementReferences(),
    worldFactory: (stage) => new SurvivalWorld(31, "ranger", stage),
    glyph: drawWeaponGlyph,
    ...overrides,
  };
  const issues = [],
    counts = {
      stages: c.stageIds.length,
      weapons: c.skills.length,
      enemies: c.kinds.length,
      weaponForms: 0,
    };
  const check = (ok, label) => {
    if (!ok) throw Error(label);
  };
  const probe = (label, fn) => {
    try {
      fn();
    } catch (e) {
      issues.push(`${label}: ${e.message}`);
    }
  };
  const nonempty = (v) => typeof v === "string" && v.trim().length > 0;
  const keys = (name, table, expected) =>
    probe(name, () =>
      check(
        JSON.stringify(Object.keys(table).sort()) ===
          JSON.stringify(expected.map(String).sort()),
        "登记键与内容列表不一致",
      ),
    );
  const drawn = (g, label) =>
    check(
      g.commands.length > 0 &&
        !g.commands.some((v) => /NaN|Infinity/.test(v.d)),
      label,
    );
  for (const [name, table] of Object.entries({
    stages: c.stages,
    guides: c.guides,
    stageKinds: c.stageKinds,
    bossArt: c.bossArt,
    mapColors: c.mapColors,
  }))
    keys(name, table, c.stageIds);
  for (const [name, table] of Object.entries({
    mods: c.mods,
    budgets: c.budgets,
    roles: c.roles,
  }))
    keys(name, table, c.skills);
  keys("enemies", c.enemies, c.kinds);
  probe("content IDs", () => {
    for (const ids of [
      c.stageIds,
      c.skills,
      c.kinds,
      c.achievements.map((a) => a.id),
    ])
      check(new Set(ids).size === ids.length, "内容ID重复");
  });
  const members = new Map();
  for (const stage of c.stageIds)
    probe(`stage ${stage}`, () => {
      const config = c.stages[stage],
        guide = c.guides[stage],
        kinds = c.stageKinds[stage],
        id = c.clearIds[stage];
      check(
        config && nonempty(config.name) && nonempty(config.boss),
        "缺少选关名称/Boss名称",
      );
      check(
        ["health", "elite", "bossHealth", "damage", "xp", "medicine"].every(
          (k) => Number.isFinite(config[k]) && config[k] > 0,
        ),
        "关卡数值缺失或无效",
      );
      check(
        guide && nonempty(guide.threat) && nonempty(guide.builds),
        "缺少选关机制/配装提示",
      );
      check(
        Array.isArray(kinds) &&
          kinds.length &&
          new Set(kinds).size === kinds.length,
        "敌人归属为空或重复",
      );
      for (const kind of kinds) {
        check(c.kinds.includes(kind), "美术归属含未知敌人 " + kind);
        check(!members.has(kind), "敌人重复归属 " + kind);
        members.set(kind, stage);
      }
      const w = c.worldFactory(stage);
      w.enemies = [];
      w.player = { x: 0, y: 0 };
      w.camera = { x: 0, y: 0 };
      w.viewport = { x: 100, y: 100 };
      check(
        w.stageId === stage &&
          w.stageStrategy?.combat &&
          typeof w.stageStrategy.combat.incoming === "function",
        "战斗策略未接入",
      );
      for (const kind of c.kinds.filter(
        (k) => k !== "boss" && k !== "minion",
      )) {
        w.enemies = [];
        const e = w.addEnemy(kind, 2, 0);
        e.state = "arriving";
        check(
          w.stageStrategy.stepEnemy(e, 0) === kinds.includes(kind),
          "战斗/美术敌人归属不一致 " + kind,
        );
      }
      w.enemies = [];
      const boss = w.addEnemy("boss", 2, 0);
      boss.state = "seek";
      const hud = stageHud(w, boss);
      check(
        nonempty(hud.advice) && nonempty(hud.bossLabel),
        "HUD/Boss提示缺失",
      );
      check(
        c.bossArt[stage]?.stage === stage &&
          enemyArt(stage, "boss").stage === stage,
        "Boss美术缺失或回退",
      );
      const g = new Graphics();
      drawActorLayer(g, w, false, false);
      drawn(g, "Boss不可绘制");
      drawStageMap(g, stage);
      drawn(g, "地图不可绘制");
      check(
        nonempty(c.mapColors[stage]?.floor) &&
          nonempty(c.mapColors[stage]?.grain),
        "地图配色未登记",
      );
      for (const kind of kinds) {
        const art = enemyArt(stage, kind);
        check(
          art.kind === kind &&
            art.stage === stage &&
            catalogStage(kind) === stage,
          "敌人美术回退 " + kind,
        );
        w.enemies = [];
        const e = w.addEnemy(kind, 2, 0);
        e.state = "seek";
        g.clear();
        drawActorLayer(g, w, false, false);
        drawn(g, "敌人不可绘制 " + kind);
      }
      check(
        id &&
          c.achievements.filter((a) => a.id === id && a.category === "通关记录")
            .length === 1,
        "缺少唯一通关成就",
      );
      check(
        Number.isSafeInteger(c.clearCoins[stage]) && c.clearCoins[stage] >= 0,
        "通关金币未登记",
      );
      w.state = "won";
      const persistence = new Map();
      const progress = new ProgressStore({
        getItem: (k) => persistence.get(k) || null,
        setItem: (k, v) => persistence.set(k, v),
      });
      progress.observe(w);
      const account = progress.data;
      check(
        account.stages.includes(stage) &&
          account.achievements.includes(id) &&
          account.coins === c.clearCoins[stage],
        "通关奖励/解锁未接入",
      );
    });
  for (const kind of c.kinds)
    probe(`enemy ${kind}`, () => {
      check(c.enemies[kind]?.health > 0, "敌人数值缺失");
      const elitePosition=c.enemies[kind]?.elitePosition;
      if(elitePosition)check(c.enemies[kind].elite&&["anchor","flank"].includes(elitePosition),"精英站位配置无效");
      const range=c.enemies[kind]?.tacticalRange;
      if(range)check([range.min,range.preferred,range.max].every(Number.isFinite)&&range.min>0&&range.min<range.preferred&&range.preferred<range.max&&!c.enemies[kind].elite&&c.enemies[kind].speed>0,"远程战术射程配置无效");
      if (!["minion", "boss"].includes(kind))
        check(members.has(kind), "未归属任何关卡");
    });
  const unlocked = new ProgressStore({
    getItem: () => null,
    setItem: () => {},
  });
  unlocked.data.achievements = c.achievements.map((a) => a.id);
  unlocked.data.purchasedWeapons = ["hammer", "lamp"];
  for (const skill of c.skills)
    probe(`weapon ${skill}`, () => {
      check(
        nonempty(c.names[skill]) &&
          nonempty(c.roles[skill]) &&
          nonempty(c.colors[skill]),
        "图鉴名称/简介/颜色缺失",
      );
      check(unlocked.availableWeapons.includes(skill), "无可用解锁路线");
      const budget = c.budgets[skill];
      check(
        budget &&
          budget.min > 0 &&
          budget.max > budget.min &&
          nonempty(budget.role),
        "缺少数值预算",
      );
      const mods = c.mods[skill];
      check(
        Array.isArray(mods) &&
          mods.length === 4 &&
          new Set(mods.map((m) => m.id)).size === 4,
        "四项改造未完整登记",
      );
      for (const mod of mods) {
        check(
          ["id", "name", "effect", "cost"].every((k) => nonempty(mod[k])),
          "改造说明缺失",
        );
        if (mod.excludes)
          check(
            mods.some((m) => m.id === mod.excludes && m.excludes === mod.id),
            "改造互斥未配对",
          );
      }
      const w = c.worldFactory(1);
      w.enemies = [];
      w.player = { x: 0, y: 0 };
      for (const s of c.skills) w.skills[s] = 0;
      w.skills[skill] = 8;
      for (let i = 0; i < 4; i++) {
        const e = w.addEnemy("minion", 1.8 + i * 0.3, 0);
        e.state = "seek";
        e.hp = e.maxHp = 1e7;
      }
      const strategy = w.armory.strategies[skill];
      check(
        strategy &&
          WEAPON_FAMILY_ORDER.includes(strategy.family) &&
          typeof strategy.cast === "function",
        "可执行策略缺失",
      );
      strategy.cast(0);
      check(w.castCounts[skill] > 0, "策略未实际施放");
      for (const attack of w.armory.extra.attacks.filter(
        (a) => a.skill === "mine",
      )) {
        const e = w.addEnemy("minion", attack.x, attack.y);
        e.state = "seek";
        e.hp = e.maxHp = 1e7;
      }
      for (const s of c.skills) w.cooldowns[s] = 100;
      let submitted = 0;
      for (let frame = 0; frame < 90; frame++) {
        w.time += 1 / 60;
        w.armory.step(1 / 60);
        if (frame % 10) continue;
        const g = new Graphics();
        drawGroundFields(g, w, false);
        drawProjectiles(g, w, false);
        drawExtraSpell(g, w, true, false);
        drawExtraSpell(g, w, false, false);
        drawUnlockedSpells(g, w);
        drawSupportSpells(g, w);
        submitted += g.commands.length;
      }
      check(submitted > 0, "攻击没有可绘制特效");
      for (let grade = 1; grade <= 4; grade++)
        if (validGrade(skill, grade)) {
          counts.weaponForms++;
          check(
            nonempty(weaponName(skill, { [skill]: grade })),
            "形态名称缺失",
          );
          const g = new Graphics();
          c.glyph(g, skill, grade);
          drawn(g, "形态图标不可绘制");
          w.weaponGrades[skill] = grade;
          for (const chosen of [[], ...mods.map((m) => [m.id])]) {
            w.mods[skill] = chosen;
            const stats = weaponStats(w, skill);
            check(
              ["damage", "radius", "range", "cooldown", "count"].every(
                (k) => Number.isFinite(stats[k]) && stats[k] > 0,
              ),
              "形态/改造属性无效",
            );
          }
        }
      check(validGrade(skill, initialGrade(skill)), "初始品阶非法");
    });
  for (const achievement of c.achievements)
    probe(`achievement ${achievement.id}`, () => {
      check(
        ["id", "name", "condition", "reward", "category"].every((k) =>
          nonempty(achievement[k]),
        ),
        "图鉴字段缺失",
      );
      check(c.settlementIds.has(achievement.id), "成就没有结算条件登记引用");
      check(
        ["通关记录", "机制挑战", "配装挑战"].includes(achievement.category),
        "未接入成就分类",
      );
      if (achievement.weapon)
        check(c.skills.includes(achievement.weapon), "奖励武器不存在");
    });
  return { ok: issues.length === 0, counts, issues };
}
