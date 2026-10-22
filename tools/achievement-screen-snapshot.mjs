import { GameMenus } from "../temp/tests/presentation/GameMenus.mjs";
import { ProgressStore } from "../temp/tests/platform/ProgressStore.mjs";
import { ACHIEVEMENTS } from "../temp/tests/battle/UnlockConfig.mjs";
import { ALL_WEAPONS } from "../temp/tests/battle/SurvivalConfig.mjs";
import { Graphics } from "../temp/tests/node_modules/cc/index.mjs";
/** Record original menu submissions, badge paths and clamped progress before extracting rendering. */
export function captureAchievementScreens(){
 const original=ACHIEVEMENTS.slice();
 ACHIEVEMENTS.splice(0,ACHIEVEMENTS.length,...original.filter(a=>a.id!=="trace_twelve_paths"&&a.id!=="tracecourt_clear"&&a.id!=="counterbeat_clear"&&a.id!=="counterbeat_mastery"&&a.id!=="twingate_clear"&&a.id!=="twingate_twelve_orders"));
 try{return captureHistoricalScreens();}finally{ACHIEVEMENTS.splice(0,ACHIEVEMENTS.length,...original);}
}
function captureHistoricalScreens() {
  const rows = [];
  for (const done of [false, true]) {
    const progress = new ProgressStore({
      getItem: () => null,
      setItem: () => {},
    });
    progress.data.coins = 1234;
    progress.data.achievements = done ? ACHIEVEMENTS.map((a) => a.id) : [];
    const calls = [],
      overlay = {
        destroyAllChildren() {
          calls.length = 0;
        },
      };
    const host = {
      progress,
      overlay,
      clearInput() {},
      panel(_parent, ...args) {
        calls.push(["panel", ...args]);
      },
      text(_parent, ...args) {
        calls.push(["text", ...args]);
      },
      button(_parent, ...args) {
        calls.push(["button", ...args.slice(0, -1)]);
        return { string: args[0] };
      },
      make(name) {
        const row = ["badge", name];
        calls.push(row);
        return {
          setPosition(...args) {
            row.push(args);
          },
          addComponent() {
            const g = new Graphics();
            row.push(g.commands);
            return g;
          },
        };
      },
    };
    const menu = new GameMenus(host);
    for (const category of ["通关记录", "机制挑战", "配装挑战"])
      for (
        let page = 0;
        page <=
        Math.ceil(
          ACHIEVEMENTS.filter((a) => a.category === category).length / 3,
        );
        page++
      ) {
        menu.showAchievements(page, category);
        rows.push({
          done,
          category,
          page,
          actual: menu.achievementPage,
          calls: JSON.parse(JSON.stringify(calls)),
        });
      }
    for (const count of [0, 2, 4, 7]) {
      for (const field of [
        "eclipseQualified",
        "leadQualified",
        "graveQualified",
      ])
        progress.data[field] = Object.fromEntries(
          ALL_WEAPONS.map((skill) => [
            skill,
            Array.from({ length: count }, (_, i) => "pair" + i),
          ]),
        );
      for (const method of [
        "showEclipsePaths",
        "showLeadPaths",
        "showGravePaths",
      ]) {
        menu[method]();
        rows.push({
          done,
          count,
          method,
          progress: ACHIEVEMENTS.map((a) => [
            a.id,
            progress.achievementProgress(a.id),
          ]),
          calls: JSON.parse(JSON.stringify(calls)),
        });
      }
    }
  }
  return rows;
}
