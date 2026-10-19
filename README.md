# 余烬幸存者

Cocos Creator 3.8.8，横屏2D生存小游戏。场景入口 `assets/scenes/Main.scene`。

当前工作区已重构为四关：铁棘围城、赤砂虫巢、雷铸机庭、苍棘猎原，ID与显示编号均为1～4，按顺序通关解锁。第1关360秒、其他关480秒进入Boss战。

十种武器随机三选一开局，最多六武器、四种被动；武器最高8级，4/8级各选一次专属改造，玩家最高64级。WASD/方向键或触摸拖动移动，1～3选择升级卡，空格全收经验，Esc暂停。

## 现行文档

- [当前项目基线、存档与验证状态](docs/current-baseline.md)
- [四关统一美术规范](docs/art-direction.md)
- [后续关卡设计规则](docs/level-design-rules.md)
- [第1关：铁棘围城](docs/stage-01-siege.md)与[敌人设计](docs/stage-01-enemies.md)
- [第2关：赤砂虫巢](docs/stage-02-sandnest.md)
- [第3关：雷铸机庭](docs/stage-03-thunderworks.md)
- [第4关：苍棘猎原](docs/stage-04-moonhunt.md)
- [十武器与专属改造](docs/weapon-armory-0.23.md)
- [前两关地图与武器适配](docs/maps-armory-0.22.1.md)

旧关卡、旧武器及旧系统设计文档已删除。后续关卡按当前四关美术基线重新设计，尚未完成第5关方案。

## 本地检查与构建

```sh
npm test
npx tsc --noEmit
node tools/build.mjs web-mobile
python3 -m http.server 8128 --directory build/web-mobile
node tools/build.mjs wechatgame
```

构建脚本使用本机Creator路径，微信输出为 `build/wechatgame`。2026-10-19：200项测试和TypeScript检查通过，微信构建通过；0.26.0已上传后台开发版本，包大小2,556,155字节，见[上传记录](artifacts/wechat-upload-0.26.0.json)。未提审或正式发布，真人平衡及真机性能待验收。
