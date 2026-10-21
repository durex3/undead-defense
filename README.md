# 余烬幸存者

Cocos Creator 3.8.8，横屏2D生存小游戏。场景入口 `assets/scenes/Main.scene`。

当前工作区开发版0.33.2开放十关：铁棘围城、赤砂虫巢、雷铸机庭、苍棘猎原、灰烛钟庭、锈潮船坞、折晶矿窟、蚀根温室、断羽风廊、缄页禁库，ID1～10按顺序通关解锁，均360秒进入Boss战。第五至十关不要求指定武器。

0.33.2调整火球命中速度、圣水回流、落雷升级收益与描述、追猎飞刀分叉动画，见[试玩反馈记录](docs/weapon-feedback-0.33.2.md)；选关改为左右箭头切换的单关主题图，见[轮播选关记录](docs/stage-carousel-0.33.2.md)。

2026-10-21：0.33.2已上传微信后台开发版本，包大小2,888,632字节，见[上传回执](artifacts/wechat-upload-0.33.2.json)。488项测试、TypeScript、Web/微信构建与三种尺寸的浏览器选关检查通过；未提审或正式发布。

0.33.1加强十关首领预警、缩短Boss战并加入阶段血瓶和武器满级后的可选生命药剂。480项测试、TypeScript检查与Web/微信构建通过；已上传微信后台开发版本，包大小2,886,889字节，见[上传回执](artifacts/wechat-upload-0.33.1.json)及[调整记录](docs/boss-readability-and-supplies.md)。未提审或正式发布。

十四个武器系列，前十种默认开放。精良重锤360金币购买、精良飞轮由第三关成就解锁；稀有引魂灯1,440金币购买、史诗缚影缝针由高难「解签留路」解锁。飞刀和重锤已开放金币进阶，其他系列后续补齐；同系列不增加随机池位置。开局从已解锁池随机三选一，升级同样随机，每局最多持有四种武器、四种被动；武器最高8级，4/8级各选一次专属改造，玩家最高64级。WASD/方向键或触摸拖动移动，1～3选择升级卡，空格全收经验，Esc暂停。

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

旧关卡、旧武器及旧系统设计文档已删除。后续关卡按当前四关美术基线重新设计，第五关与首批武器、图鉴已接入，详见实现记录。

## 第五关与解锁

- [第五关：灰烛钟庭](docs/stage-05-bellcourt.md)
- [实现与验证记录](docs/stage-05-implementation.md)
- [武器图鉴、成就图鉴与首批解锁](docs/catalogs-and-unlocks.md)

## 第六关

- [第六关：锈潮船坞](docs/stage-06-tideworks.md)：四类独立小怪、两精英与船骸Boss，潮墙、飞叉、拖锚和二阶段移泊已接入。
- [实现、对照和待调优项](docs/stage-06-implementation.md)：功能及本地构建已完成，实际难度递增仍待验收。

## 第七关

- [第七关：折晶矿窟](docs/stage-07-prismvault.md)：一次反射弹、可击碎晶核、临时棱镜，独立四类小怪、两精英与裂冠岩母；已接入反射几何、可拆晶核与棱镜、Boss三技能及二阶段。
- [第七关实现与验证](docs/stage-07-implementation.md)：自动检查及本地Web/微信构建通过，真人/真机待验收。

## 第八关

- [第八关：蚀根温室](docs/stage-08-rootglass.md)：固定支点持续摆藤、环刺与实心花床，独立四类主力、三精英和垂冠根母，已接入运行时。
- [第八关实现与精修](docs/stage-08-implementation.md)：持续摆藤、花床与两阶段Boss，通关7开放。
- [全八关三轮精英与第九关并存规则](docs/elite-rounds.md)：前七关复用现有种类，第八关三种各一轮；第九关起允许多精英并存。

## 第九关

- [第九关：断羽风廊](docs/stage-09-windcloister.md)：定向风推、曲线羽弹与折步近袭；第三批两名满血精英错峰同场，共享两危险槽，Boss等待精英交接。已接入运行时。
- [实现与验证](docs/stage-09-implementation.md)：通关8解锁、胜利260金币，保留十二武器；全部精英轮次采用100%正常生命。
- [实际横屏截图](artifacts/wind-stage/browser-dual-active.png)、[造型表](artifacts/wind-stage/actors.png)。

## 第十关

- [第十关：缄页禁库](docs/stage-10-sealedlibrary.md)：踏签撤招、矩形烙页、移动页刃、双夹页；Boss从70%/35%血量进入第二/三阶段。
- [地图白盒](artifacts/sealedlibrary-design/layout.png)与[静态检查](artifacts/sealedlibrary-design/whitebox.json)：玩家/Boss半径下双内庭及巡回大环连通，六类空场样例均有纯躲与踩签后存活路线。已接入运行版；[实现与验证](docs/stage-10-implementation.md)包含真实踩签与三阶段浏览器检查。

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

## 武器品阶与成长

[设计文档](docs/ten-stage-progression-design.md)与[开发验证记录](docs/weapon-progression-implementation.md)：普通、精良、稀有、史诗四品阶；十四系列、十六成就、五个新进阶形态。缝针需6种不同实际起手分别完成第十关Boss来源无伤与三阶段踩签挑战；第五至十关恢复时间逐关乘0.9，危险预警和危险槽上限保持。


2026-10-20：0.33.0已上传微信后台开发版本，包大小2,866,980字节，见[上传回执](artifacts/wechat-upload-0.33.0.json)。包含当前十关、十四武器、十六成就与首批五个进阶形态；未提审或正式发布。


0.33.3修复存档重启丢失：保留通关、金币和购买，新增「存档检查」及补回码入口；原因、兼容策略和真实重启验证见[恢复记录](docs/save-recovery-0.33.3.md)。

0.33.4完成[十关精英/Boss判伤复查](docs/damage-audit-0.33.4.md)：修复第二关直线/沙裂误判大圆和第二、三关扇形预警。补回码改为可手动输入的真实输入框；512项测试中511通过、1项历史跳过，TypeScript、Web/微信构建与实际浏览器验证通过，已上传微信后台开发版本。

0.33.5新增[最多3个手动存档与角色重构](docs/manual-saves-and-characters-0.33.5.md)：主菜单「存档管理」可保存、读取、覆盖、删除，自动保存独立；第一关三类小怪改为露骨亡灵，三主角使用独立新造型。518项测试中517通过、1项历史跳过，真实Cocos冷重载验证和Web/微信构建通过，已上传微信后台开发版本。
