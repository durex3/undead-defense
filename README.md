# 余烬幸存者

Cocos Creator 3.8.8，横屏2D生存小游戏。场景入口 `assets/scenes/Main.scene`。

当前工作区已重构为四关：铁棘围城、赤砂虫巢、雷铸机庭、苍棘猎原，ID与显示编号均为1～4，按顺序通关解锁。四关均为360秒进入Boss战，Boss战另算。

十种武器随机三选一开局，每局最多持有四种武器、四种被动；武器最高8级，4/8级各选一次专属改造，玩家最高64级。WASD/方向键或触摸拖动移动，1～3选择升级卡，空格全收经验，Esc暂停。

## 现行文档

- [当前项目基线、存档与验证状态](docs/current-baseline.md)
- [四关统一美术规范](docs/art-direction.md)
- [美术开发手册（给后续 AI 的落地指南）](docs/art-development-guide.md)
- [后续关卡设计规则](docs/level-design-rules.md)
- [第1关：铁棘围城](docs/stage-01-siege.md)与[敌人设计](docs/stage-01-enemies.md)
- [第2关：赤砂虫巢](docs/stage-02-sandnest.md)
- [第3关：雷铸机庭](docs/stage-03-thunderworks.md)
- [第4关：苍棘猎原](docs/stage-04-moonhunt.md)
- [十武器与专属改造](docs/weapon-armory-0.23.md)
- [四十项改造与五十种搭配对照](docs/weapon-modifications-guide.md)（玩法、独有特效、代价、互斥及组合边界）
- [十武器玩法与特效重新设计](docs/weapon-identity-redesign.md)（基础机制与改造已接入，平衡待试玩）
- [武器分批开放与关卡成长设计](docs/weapon-unlocks-design.md)（设计稿，按实际关卡需求逐步规划）
- [朋友试玩反馈与协作分工](docs/playtest-feedback.md)
- [前两关地图与武器适配](docs/maps-armory-0.22.1.md)

旧关卡、旧武器及旧系统设计文档已删除。后续关卡按当前四关美术基线重新设计，尚未完成第5关方案。

## 本地检查与构建

Windows构建脚本可自动找到桌面 `.local-tools/CocosCreator/3.8.8/CocosCreator.exe`，同时保留macOS路径支持。其他安装位置可通过 `COCOS_CREATOR` 指定可执行文件。

```sh
npm run dev
```

此命令先构建Web版，再启动 `http://127.0.0.1:8128`。仅重新构建用 `npm run build:web`，已有构建仅启动服务用 `npm run serve:web`。

```sh
npm test
npm run art:preview
npm run art:review
npm run art:motion
npm run art:builds
npm run art:combat
npx tsc --noEmit
node tools/build.mjs web-mobile
python3 -m http.server 8128 --directory build/web-mobile
node tools/build.mjs wechatgame
```

构建脚本使用本机Creator路径，微信输出为 `build/wechatgame`。2026-10-19：200项测试和TypeScript检查通过，微信构建通过；0.26.0已上传后台开发版本，包大小2,556,155字节，见[上传记录](artifacts/wechat-upload-0.26.0.json)。未提审或正式发布，真人平衡及真机性能待验收。

2026-10-19后续美术整改：四关场景、角色及十武器按矢量墨线规范更新；第四轮通过三四关完整逻辑回放精修机械、兽类、螳猎及落雷余电。第五轮加强普通怪头肩与受光面、攻击接触强调，并按距离降低经验结晶亮度。详情见[美术复查及整改](docs/art-review-2026-10-19.md)。最新246项回归中245通过、1项归档跳过，完整TypeScript和绘制预算通过。`art:review` 输出合成图，`art:motion` 输出受控动图，`art:builds` 采样100种武器配置，`art:combat` 输出4段完整逻辑离线回放。均不替代浏览器/微信真机验收。

本地前后对照页：[三四关战斗层回放](http://127.0.0.1:8128/qa-combat/)。重新构建后如需恢复此诊断页，先生成 `npm run art:combat`，再执行 `node tools/art-combat.mjs --copy-local`；不接入游戏菜单或微信包。

第六轮加强主角头肩与披风辨识、拥挤时定位墨线，以及重击破片/精英死亡冠标。`npm run art:feedback` 生成离线反馈小样；`node tools/art-combat.mjs --copy-local`同时暂存已生成的小样。


2026-10-19十武器重实现：按用户追加决定，飞刀默认绕身，原环绕改造成为扩阵；幽灵驻队追猎双爪、寒霜结霜爆冰、骨矛选线蓄力贯穿。其余六把保留独立基础规则并校对攻击阶段、特效及改造。见[重实现记录](docs/weapon-reimplementation.md)。最新253项回归中252通过、1归档跳过；TypeScript通过，十武器动态预览及数值隔离样本不替代真人验收。

2026-10-20：飞刀四把实体刀持续等距环绕、升级数量及幽灵成长已适配；四十改造与五十搭配详见[对照文档](docs/weapon-modifications-guide.md)。最新255项回归中254通过、1跳过；本地[改造采样页](http://127.0.0.1:8128/qa-weapons/mods.html)。

美术预览PNG/SVG/GIF与Web构建为可复现本地产物，不提交仓库；保留生成工具与JSON报告。文档中的本地图片链接需先运行对应 `art:*` 命令生成，再打开查看。
