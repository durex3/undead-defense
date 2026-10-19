# 美术开发手册（给后续 AI 的落地指南）

更新：2026-10-19。适用于当前四关版本（铁棘围城、赤砂虫巢、雷铸机庭、苍棘猎原）。本文是美术工作的入口；规则冲突时，以 `assets/scripts/battle/` 的实际代码和本文“几何真值”一节为准。

## 0. 协作分工

当前工作区允许多个 AI 并行开发，建议按以下边界交接：

2026-10-19补充：用户在其他AI完成后，明确授权本助手按此风格重构美术，并追加武器/敌人特效。本轮可修改 `presentation/`；长期职责仍按下列边界交接。不要把旧分工解释为阻止用户最新授权。

- **前端/美术 AI（本手册）**：`assets/scripts/presentation/`，包括 `art/`、`BattlePainter.ts`、`HeroPainter.ts`、`SpellPainter.ts`、`ExtraSpellArt.ts`、`HazardPainter.ts`、`PickupPainter.ts`、美术预览工具与美术测试。
- **关卡 AI**：`assets/scripts/battle/` 的关卡/导演/敌人状态/危险创建与命中/地图数据，以及对应关卡文档。不要为了视觉效果直接改 `presentation/` 的绘制代码；先确认 `Enemy`/`Hazard` 字段是否足够。
- **交接契约**：`ENEMY_KINDS`/`ENEMIES`（kind、config）、`Enemy` 状态字段、`Hazard` 几何字段、`CATALOG_STAGE_KINDS`、`tests/art-catalog.test.mjs`。关卡 AI 新增 kind 后，美术 AI 补 catalog/Art/预览；反过来，美术 AI 不新增 kind、不改数值。
- **修改前先看 `git status`**：当前工作区可能有其他 AI 的未提交改动；不要回滚或覆盖不属于本任务的 `battle/`、`docs/`、`tests/` 文件。只提交/汇报自己改动的文件。

## 1. 先读什么

按顺序读这三个文件即可开始：

1. `assets/scripts/presentation/art/EnemyCatalog.ts`：每种敌人的身高、投影、缩放、调色板、体型参数。
2. `assets/scripts/presentation/art/EnemyPainter.ts`：绘制层级、裁剪、Y 排序、血条/Boss/状态叠加。
3. `assets/scripts/presentation/art/Brush.ts`：轮廓合并、明暗图元、局部坐标转换。

改颜色通常只动 `EnemyCatalog.ts`；改剪影或动作动 `art/enemies/*Art.ts`；改法术动 `art/SpellPainter.ts` 与 `art/spells/ExtraSpellArt.ts`；改预警动 `art/HazardPainter.ts`。

## 2. 硬规则

- **不改命中几何**：敌人碰撞、危险半径/角度/宽、伤害、时序、AI、存档都在 `assets/scripts/battle/`。美术层只读，不写。
- **世界坐标固定为 48 像素/单位**；所有实体以“脚底”为锚点，向上绘制。
- **敌人和主角不再使用 Sprite**：全部画在同一个 `Graphics`（`Effects` 节点）。禁止为单个敌人创建节点或文字。
- **所有颜色走 `ink(hex, alpha)`**（`presentation/art/Ink.ts`）。绘制路径里禁止 `new Color()`；禁止直接修改 `ink()` 返回的颜色对象。
- **动画使用 `world.time + enemy.id` 的正弦**，不使用 `Math.random()`。
- **敌方预警始终绘制在友方弹体/粒子之上**；省电模式只减少装饰，不能删除边界、方向、缺口、序号、HP 条。
- **飞行中的武器读施放时的快照** `p.stats.mods` / `a.stats.mods`，不读 `w.mods`。
- **不要用视觉近似替代几何函数**：月刃继续用 `moonCurve`/`moonPose`/`moonEnd`；雷墙/雷线/雷扇区继续用 `ThunderGeometry` 的公式；冲锋胶囊继续用 `h.radius`/`h.width`/`h.angle`。

## 3. 渲染架构与层级

```
BattlePainter.draw
  1. spawnParticles(events)                       # 只复制事件字段，固定容量池
  2. drawGroundFields                             # 友方地面领域（火海/圣水）
  3. drawExtraArmory(ground=true)                 # 地雷/冰环/黑洞/圣剑落点/骨棘
  4. drawActorLayer                               # 投影 -> Y 排序身体（敌人 + 主角）
  5. drawPickups                                  # 经验结晶、药水
  6. drawProjectiles                              # 飞刀/火球/圣水
  7. drawExtraArmory(ground=false)                # 幽灵/骨矛/闪电/圣剑
  8. updateParticles                              # 命中/死亡/爆炸/冻结反馈
  9. drawEnemyWarnings                            # 血条/精英冠/Boss侧标/冻结/减速/护盾/蓄力符号
 10. drawHazards                                  # 敌方预警；月/雷/围城专属预警在此调用
```

- 地图是独立的 `StageMap` Graphics，由 `StageMapPainter.ts -> art/MapArt.ts` 静态绘制，遵守同一墨线、光源和装饰退让规范。
- HUD 是独立节点；本手册不修改布局。
- 绘制顺序的代码入口是 `BattlePainter.ts`；不要在里面重新堆敌人/法术分支。

### 文件职责

| 文件 | 职责 |
|---|---|
| `presentation/art/Ink.ts` | 颜色缓存，alpha 量化到 16 级 |
| `presentation/art/Brush.ts` | `Silhouette` 轮廓合并器、plate/orb/limb/horn/arc/eye/shadow 等 |
| `presentation/art/Contour.ts` | 相交部件暴露边界裁切、最多512条局部坐标轮廓缓存 |
| `presentation/art/VfxBrush.ts` | 方向性拖迹、短促迸射、攻击类型预警符号 |
| `presentation/art/VisualDensity.ts` | 友方装饰拥挤判断、固定容量命中火花合并 |
| `presentation/art/MapArt.ts` | 四关静态地形材质，读取原地图碰撞数组 |
| `presentation/art/Actor.ts` | `Pose`（脚底原点、朝向、scale、lift、stride、bob、状态） |
| `presentation/art/EnemyCatalog.ts` | kind -> 关卡/身高/投影/调色板/原型/武器参数 |
| `presentation/art/Archetypes.ts` | humanoid / quadruped / insect / mech / float / device / egg / grub 原型 |
| `presentation/art/EnemyPainter.ts` | 裁剪、投影、Y 排序、血条/精英/Boss/状态、主角插入 |
| `presentation/art/enemies/*Art.ts` | 四关各自的身体细节与关节动作 |
| `presentation/art/HeroPainter.ts` | 游侠/炼金术士/亡灵使者矢量主角 |
| `presentation/art/SpellPainter.ts` | 基础三武器、地面领域、粒子系统 |
| `presentation/art/spells/ExtraSpellArt.ts` | 七种改造武器 |
| `presentation/art/spells/LightningMotion.ts` | 按实际落雷节点/回击阶段计算亮度、宽度和触点衰减 |
| `presentation/art/HazardPainter.ts` | 通用危险预警调度与几何 |
| `presentation/art/PickupPainter.ts` | 经验结晶与药水 |

旧的 `SiegePainter.ts` / `SandPainter.ts` / `ThunderPainter.ts` / `MoonPainter.ts` 保留专属预警及历史地图函数；运行时地图入口现已改为 `MapArt`，不要再接回历史地图。旧敌人函数已删除；`ExtraArmoryPainter.ts` 只是 `ExtraSpellArt` 的薄封装。

### 导入方向

- 美术层可以导入：`battle/SurvivalConfig`、`battle/SurvivalTypes`、`battle/ProgressionConfig`、`battle/BossSystem.bossExposed`、`battle/MoonGeometry`、`battle/ThunderGeometry` 和地图只读数组。
- 美术层**不要**导入 `SiegeSystem` / `SandSystem` / `ThunderSystem` / `MoonSystem` 的行为逻辑；关卡归属写在 `EnemyCatalog.CATALOG_STAGE_KINDS`，由 `tests/art-catalog.test.mjs` 对齐。
- `BattlePainter -> art`；旧 Painter -> art；不要让 art 反向依赖旧 Painter 的敌人函数。预警函数例外：月/雷/围城的专属预警仍从旧 Painter 导出，由 `HazardPainter` 调用。

## 4. 矢量墨线规范

### 轮廓

- `Silhouette` 对躯干、头、四肢等统一填充，`Contour.exposedEdges` 切掉被其他部件覆盖的线段后统一描边。仅将独立子路径直接stroke会保留接缝，不能代替这一步；随后绘制内部明暗。
- 轮廓局部坐标量化到1/8像素，缓存最多512条；平移/镜像不进入缓存键。不要改为每帧在世界坐标做整套裁切或无上限缓存。
- 所有子路径统一绕向（`Silhouette.poly` 会自动修正），避免并集出现空洞。
- 描边宽度：普通 2–2.6px，精英 2.6px，Boss 3.4px（再乘 `pose.scale`）。
- 四肢、角、爪优先用填充多边形 + 关节圆点，不依赖 `lineCap/lineJoin` 的默认值。
- 圆/椭圆在轮廓合并器里用 8–12 点多边形近似；内部细节可以用 `detailEllipse`（默认 10 点）。

### 明暗

- 三段：`shade`（暗部）、`base`（主体）、`light`（受光边）；`accent` 只给眼睛、能量、金属亮边。
- 光源固定在左上；只在左上缘加一条细高光（`rim`），不逐面高光。
- 内部细节用 `detailPoly/detailEllipse/detailLine/detailArc`，它们只填充/描线，不再加外轮廓。

### 动作

- `Pose` 的 `stride/bob/lean/crouch/windup/recover` 由 `updatePose` 统一计算。
- `windup/recover` 是0～1的视觉权重；蓄力接近出手时加强，恢复末段逐渐归零。不要把它们当作新增技能时钟。人形主体、武器与挂件统一用 `torsoOffset` 对齐，冻结时stride/bob归零。
- 行走：四肢交替；飞行单位用 bob；机械用小幅 piston 位移。
- 蓄力：下蹲/后仰/抬武器；恢复：下沉/武器下垂；精英/Boss 在恢复期显示可反击标记。
- 冻结：冰蓝外壳 + 冰晶；减速：脚下霜环；燃烧：火舌（当前 `burnUntil` 没有生产者，保留但不要依赖）。
- 跳跃：`updatePose` 已按旧 `MoonPainter` 的 50px 世界高度换算到 `pose.lift`，月兽的投影留在地面。
- 入场：`arriving` 半透明 + 收缩光环。

### 调色板

| 关卡 | outline | base | shade | light | accent |
|---|---|---|---|---|---|
| 铁棘围城 | #121820 | #87959a | #46535d | #d5dfd8 | #d8b273 |
| 赤砂虫巢 | #1b1317 | #b57952 | #6d4436 | #e8c18f | #ffd27f |
| 雷铸机庭 | #0b151b | #668083 | #2c3f47 | #b7c9c2 | #c39a63 |
| 苍棘猎原 | #131a14 | #7e8f70 | #46543f | #c3cfae | #d5b6f0 |

改色只改 `EnemyCatalog.ts` 里的调色板；不要在每个 Art 函数里散落硬编码颜色。

### 细节等级

`EnemyArt.detail`：

- `0` 普通杂兵（最多 100 个）：剪影 + 少量内部填充；目标 ≤15 次提交、≤240 顶点（含一个状态叠加）。
- `1` 特殊/远程：加肩甲、眼睛、武器细节；≤22 次、≤360 顶点。
- `2` 精英：加披风、更多关节/装饰；≤27 次、≤540 顶点。
- `3` Boss：完整轮廓、披风、王冠、阶段装饰；≤38 次、≤950 顶点。

省电模式（`reduced=true`）会降低内部细节和粒子数量；不要减少危险边界、方向、缺口、序号、HP 条。

## 5. 敌人目录

| kind | 关卡 | 原型 | 剪影关键词 | 本地身高 | 主要动作/状态 |
|---|---|---|---:|---|
| siegebone | 1 | humanoid | 短矛、破盔、红布 | 54 | 行走、刺击 |
| thornshield | 1 | humanoid | 巨棘盾、斧 | 56 | 举盾（金色盾框）、压身 |
| siegebow | 1 | humanoid | 横弩、三格装填 | 52 | 装填、后坐 |
| flanker | 1 | quadruped | 低身长吻、尾 | 34 | 奔跑、突袭 |
| siegeflag | 1 | humanoid | 高旗、披风 | 62 | 旗摆、挥砍 |
| siegerider | 1 | rider | 马+骑手+长枪 | 66 | 冲锋、勒马 |
| boss（1） | 1 | humanoid | 重甲、长戟、塔盾、王冠、披风 | 92 | 阶段 2 肩刺/红核 |
| sandworker | 2 | insect | 六足、镰肢 | 40 | 爬行、挥镰 |
| sandlarva | 2 | grub | 环节小虫 | 18 | 蠕动；孵化前显示卵 |
| sandegg | 2 | egg | 沙丘卵、裂纹 | 26 | 脉动、孵化 |
| shellroller | 2 | insect | 球形甲壳 | 34 | 滚动、缩腿 |
| sandspitter | 2 | insect | 大腹囊、喷管 | 46 | 膨胀、喷射 |
| sandstalker | 2 | insect | 背鳍、掘爪 | 38 | 潜沙（沙丘+轨迹）、出土 |
| broodelite | 2 | insect | 巨腹、卵囊 | 62 | 产卵、践踏；精英冠 |
| breakerelite | 2 | insect | 巨钳、重甲 | 64 | 抬臂、砸地；精英冠 |
| boss（2） | 2 | insect | 巨腹、冠角、卵囊、四臂 | 92 | 阶段 2 卵囊发光 |
| rivetwalker | 3 | mech | 活塞腿、烟囱 | 42 | 行走、冲撞 |
| anchorweaver | 3 | mech | 蛛足、吊锚 | 48 | 投锚、拉索 |
| arclantern | 3 | float | 双杆灯笼、电弧 | 46 | 漂浮、放电 |
| railsaw | 3 | mech | 履带、圆锯 | 40 | 旋转锯、冲锋 |
| gridwarden | 3 | mech | 双球、天线 | 54 | 展开、接地；精英冠 |
| railreaper | 3 | mech | 双锯臂 | 56 | 交叉、切割；精英冠 |
| thunderanchor | 3 | device | 三脚架、锚链 | 46 | 待机、放电；独立倒计时 |
| gridelectrode | 3 | device | 电柱、线圈 | 48 | 脉动、放电；独立倒计时 |
| boss（3） | 3 | float | 四臂、电翼、核心 | 92 | 阶段 2 电弧增强 |
| thornrunner | 4 | quadruped | 背刺、低身 | 38 | 奔跑、冲撞 |
| crescentmantis | 4 | mantis | 双月刃 | 52 | 挥刃、回刃 |
| vaultlynx | 4 | quadruped | 长尾、跃姿 | 40 | 蹲伏、跃扑 |
| antlerprowler | 4 | quadruped | 宽角 | 46 | 摆角、冲撞 |
| moonreaver | 4 | mantis | 巨刃、披风 | 56 | 连斩、回刃；精英冠 |
| hornwarden | 4 | quadruped | 巨角、月环 | 60 | 角撞、月环；精英冠 |
| boss（4） | 4 | quadruped | 巨角、月盘 | 94 | 阶段 2 月盘增强、跃扑 |
| minion | 通用 | humanoid | 破甲骷髅 | 50 | 行走、抓击 |

说明：

- `art/EnemyCatalog.ts` 的 `height/halfWidth` 是本地像素（脚底为 0），最终显示尺寸还会乘 `scale`。
- 血条、精英冠、Boss 环、冻结外壳的位置只读 `EnemyArt`，不要在 Art 函数里另行硬编码。
- 每种敌人的绘制入口在 `art/enemies/<Stage>Art.ts`；共享原型在 `art/Archetypes.ts`。

## 6. 法术目录

所有法术颜色、形状和阶段语义都在 `SpellPainter.ts` / `ExtraSpellArt.ts`。关键约束：

| 武器 | 视觉要点 | 改造差异 |
|---|---|---|
| 飞刀 | 旋转月牙刃 + 残影 + 金色切边 | `hunt` 橙色环；`return` 绿色回旋弧；`shards` 更小的子刃 |
| 火球 | 泪滴形火焰 + 内焰 + 余烬拖尾 + 烟 | `heavy` 更大、落地预警光；`salvo` 分批到达；`embers` 小子火球；`flame` 留下火海 |
| 圣水瓶 | 旋转瓶身 + 高光 + 水滴尾迹 | `spring` 初始小圈；`wave` 前向弧；`recall` 回拉线；`pulse` 每秒脉冲环 |
| 寒霜脉环 | 冰晶环 + 雪片 + 外扩边 | `outward` 外缘延迟；`sectors` 三相扇区；`aftershock` 复震环；`brittle` 只减速 |
| 连锁闪电 | 天降墨边雷柱 + 金白内芯 + 短促落地闪光 | 从可视区上方进入、终点为原锁点，揭示数严格跟 `a.index`；`storm` 定点雷击；`echo` 真实回击；仅`bridge`显示明显地面电弧 |
| 幽灵伙伴 | 幽体 + 尾迹 + 双眼 | `execution` 猎手环；`swarm` 多只；`haunt` 围绕锁定点；回收点固定在 `a.end` |
| 贯阵骨矛 | 骨矛 + 肋骨倒刺 + 拖尾 | `lance` 更长；`fan` 扇射；`marrow` 红色贯穿尾迹；`ridge` 终点骨棘严格画 `start→end` |
| 符印地雷 | 菱形符印 + 呼吸光 + 绊线 + 引信环 | 触发圈严格 `((burrow?.6:.8)*radius)/1.8`；`trip` 连线；`ambush` 延迟武装；`fuse` 二次爆 |
| 坍缩黑洞 | 黑核 + 紫色视界 + 向内旋涡 | `drift` 随攻击位置移动；`collapse` 缩短寿命；`binary` 双核；`repel` 用 `1.6r` 外径和 `0.55r` 空心内径 |
| 裁决圣剑 | 落点十字/圆 + 下落巨剑 + 光柱 | 逐剑 `a.next` 决定高度；`execution` 更大；`rain` 多剑错峰；`cross` 十字判定带；`brand` 二次落剑 |

### 法术实现约束

- 弹体/领域绘制使用快照 `p.stats.mods` / `a.stats.mods`，不要读 `w.mods`。
- `a.age` 在寒霜错峰施放时可能为负；负值不绘制。
- 闪电的揭示数量用 `a.index`，不要用 `age` 重新推算。
- 幽灵回收点、圣剑落点、骨棘端点都是锁定值；不要追踪移动目标。
- `phase` 是当前阶段真相；`a.next` 是当前阶段的绝对年龄阈值。
- 粒子只复制事件字段（`x/y/type/skill/radius/form/value/angle`），不保留 `Effect` 对象引用；容量 128，省电 64。
- 固定槽分普通80、重击32、重要提示16；省电显示32＋16＋16。普通命中按32px格和武器合并，每批最多8组（省电4组）。所有槽持续更新寿命，重要槽不被普通洪峰覆盖。
- `crowdedEffects` 只影响友方装饰，不传给敌方预警；同源领域重叠降低内部色层，但保留范围边界和改造标记。

## 7. 危险预警：几何真值

`HazardPainter.ts` 只做视觉；命中判定仍在 `battle/`。必须保持以下对应关系：

| 类型 | 判定公式（真值） | 绘制要点 | 已知问题 |
|---|---|---|---|
| circle / siegeGround | `distance(player,h) < h.radius` | 圆心 `h.x/h.y`，半径 `h.radius`；落点/持续 tick 不改半径 | — |
| line / 冲锋 | 移动体 `segmentDistance < h.width`；长 `h.radius`，方向 `h.angle` | 胶囊半宽 `h.width`、长 `h.radius` | — |
| sector | `distance < h.radius && |angleDelta| < h.width/2` | 扇形半径 `h.radius`、半角 `h.width/2` | — |
| arrow | 沿 `h.angle` 的 swept segment，走廊半宽 `h.width`，最大行程 `h.radius`，速度 `h.projectileSpeed` | 射前走廊线、弓光、飞行箭头 | — |
| bellRing | `h.width <= distance < h.radius` | 内径 `h.width`、外径 `h.radius`；外波动画只是表现 | 伤害在 `due` 一次结算 |
| frontierLane | **`distance(h, player) < h.radius`**（径向） | 目前仍画胶囊 `x,y→endX,endY` | **历史画/判定不一致，本轮保留**；不要单方面改画面 |
| frontierImpact | `distance < h.radius` | 同上 | 无当前生产者 |
| burst | 8 条射线，命中半径 0.38 世界单位 | 8 个 9px 圆点 | **视觉半径与判定不一致，legacy** |
| pool / flame / flameLine / starTrace / starLeap | legacy | 保留可运行分支 | 当前无生产者 |
| Thunder wall | `front=min(travel,max(0,time-due)*speed)`；`|u-front|<=width/2+r`、`|v|<=radius/2+r`、`|v-gap|>1.8-r` | 前沿 `front ± width/2`、侧向 `±radius/2`、缺口 `±1.8` | 缺口必须保持空白 + 边界标记 |
| Thunder line | `|u|<=radius/2+r && |v|<=width+r` | 盒体 `radius × 2*width` | — |
| Thunder sector | `hypot<radius+r && |atan2(v,u)|<width/2` | 弧半径/半角一致 | — |
| Thunder zone | `hypot<radius+r` | 圆半径一致；tick 重复伤害 | — |
| Moon blade | `moonSwept` / `moonPose` 真实曲线，圆半径 `m.radius` | 必须调用 `moonCurve/moonPose/moonEnd` | 不得用整条亮线冒充弹体 |
| Moon sweep | `inner→tip` 线段，半宽 `m.width` | 只强化真实旋转刃，扫过区域变暗 | 不要把整个扇形画成持续伤害 |
| Moon landing | 落点圆，半径 `m.radius`，锁定 `m.end` | 落点环 + 跳跃弧 | — |
| Moon claw | `angle→angle+turn` 锥形，半径 `m.radius` | 锥形边界与真实扫掠一致 | — |

### 预警视觉语言

- 未生效：低透明填充、虚线/进度弧、方向箭头、序号点；生效：高对比边界、实线脉动。
- 不要只靠红绿区分；使用形状、虚线、缺口、序号。
- 敌方预警绘制在友方特效之上；不要为了“好看”把边界移出真实命中区域。
- 省电模式减少装饰粒子，但保留边界、方向、缺口、序号、进度。

## 8. 共享 API 速查

### `Ink.ts`

```ts
ink(hex: string, alpha = 255): Color
```

alpha 量化到 16 级并缓存。禁止修改返回值。不要用 `new Color()` 画每帧图形。

### `Actor.ts`

```ts
createPose(): Pose
updatePose(pose, world, enemy, art, reduced, flashUntil?)
```

`Pose` 字段：`x/y`（世界像素）、`scale`、`face`、`lift`（局部像素，会乘 scale）、`alpha`、`detail`、`frozen/slowed/burning`、`moving`、`windup/recover`、`crouch/lean/stride/bob`、`time/id`、`flash`。整个绘制批次复用一个 Pose；不要为每个敌人 new 一个。

### `Brush.ts`

```ts
new Silhouette(g, pose, fill, outline, lineWidth)
  .poly(points) .ellipse(u,v,ru,rv,segments) .plate(u,v,w,h,r)
  .limb(a,b,wa,wb) .curveLimb(a,c,b,wa,wb) .wedge(...)
  .commit()

detailEllipse(g, pose, u, v, ru, rv, color, alpha?, segments?)
detailPoly(g, pose, points, color, alpha?)
detailLine(g, pose, a, b, color, width?, alpha?)
detailArc(g, pose, cx, cy, r, a0, a1, color, width?, alpha?, segments?)
eye(...), rim(...), groundShadow(...), ring(...)
```

局部坐标：脚底 `(0,0)`，`+y` 向上，`+x` 为面朝方向；`pose.face=-1` 时 x 自动镜像。`limb` 的 wa/wb 是半宽。

### `EnemyCatalog.ts`

```ts
enemyArt(stageId, kind): EnemyArt
catalogStage(kind): StageId | 0
isDeviceKind(kind): boolean
CATALOG_STAGE_KINDS
BOSS_ART
```

`EnemyArt`：`height`、`halfWidth`、`scale`、`detail`、`palette`、`look`、`archetype`、`motionSpeed/strideAmp/bobAmp`。

### 其他入口

- `drawActorLayer(g,w,reduced,drawHero=true)`
- `drawEnemyWarnings(g,w,reduced)`
- `drawGroundFields(g,w,reduced)`
- `drawProjectiles(g,w,reduced)`
- `spawnParticles(events,reduced)` / `updateParticles(g,dt,reduced)` / `resetParticles()`
- `drawExtraSpell(g,w,ground,reduced)`
- `drawHazards(g,w,reduced)`
- `drawPickups(g,w)`
- `drawHeroBody(g,w)` / `drawHeroShadow(g,w)`

## 9. 新增/修改流程

### 只改颜色

1. 改 `EnemyCatalog.ts` 的 `EnemyPalette`（或 `SpellPainter` / `ExtraSpellArt` 的调色板）。
2. `npm run art:preview`，看对应关卡 sheet 和 50% 缩略图。
3. `npm test`。

### 改敌人剪影/动作

1. 在 `art/enemies/<Stage>Art.ts` 找到对应 kind。
2. 优先用 `Archetypes.ts` 的原型 + `hooks`，不要复制整套四肢代码。
3. 保持 `EnemyCatalog` 的 `height/halfWidth` 与血条/投影一致；如果体型变化，更新这两个值。
4. 在 `art-preview.mjs` 的 `STATE_OPTIONS` 里检查该 kind 是否覆盖 seek/windup/recover/frozen；特殊状态（buried/jump/device/vulnerable/phase2）按需补。
5. 跑预览、`art-smoke`、`art-catalog`，确认预算未超标。

### 新增敌人 kind

1. 关卡 AI 在 `battle/SurvivalConfig.ts` 加 kind/config，在对应 System 加行为/生成。
2. 在 `EnemyCatalog.CATALOG_STAGE_KINDS` 加关卡归属，并在 `COMMON`/`BOSS_ART` 加美术条目。
3. 在 `art/enemies/<Stage>Art.ts` 加分支；没有特殊需求就落到原型默认。
4. 在 `tests/art-catalog.test.mjs` 的覆盖下自动检查；在 `art-preview.mjs` 加状态覆盖。
5. 跑 `npm run art:preview` 与 `npm test`，更新本文敌人目录。

### 新增/修改法术

1. 机制在 `battle/Armory.ts` 或 `battle/ExtraArmory.ts`；不要先改视觉再改机制。
2. 基础三武器改 `SpellPainter.ts`；改造武器改 `ExtraSpellArt.ts`。
3. 严格用快照 `stats.mods` 和 `phase/next/index/age`；不要读实时 `w.mods`。
4. 在 `art-preview.mjs` 的 `basicSpellCells`/`extraCells` 加预览条目。
5. 检查 `npm test` 与预览；必要时加几何测试。

### 新增/修改危险预警

1. 在 `battle/SurvivalTypes.ts` 加 kind/flags（如果确实需要）。
2. 在创建点和命中判定处实现几何；这是唯一真值。
3. 在 `HazardPainter.ts` 加 dispatch 与绘制；不要复制几何公式，直接读 `h.radius/width/angle/endX/endY/due/created`。
4. 在 `tests/art-geometry.test.mjs` 加边界断言；在 `art-preview.mjs` 加 warning/active 两格。
5. 保留敌方预警在友方特效之上。

### 只想调血条高度

改 `EnemyCatalog.ts` 对应条目的 `height`；不要在 `EnemyPainter` 里加 kind 特判。

## 10. 性能预算与反模式

### 预算

- 普通杂兵（cap 100）：≤15 fill/stroke 提交，≤240 顶点（含一个状态叠加）。
- 特殊/远程：≤22 / 360。
- 装置：≤16 / 260。
- 精英：≤27 / 540。
- Boss：≤38 / 950。
- 100 个 siegebone 同屏：<1200 提交、<22000 顶点（`tests/art-smoke.test.mjs`）。
- 粒子：128 正常 / 64 省电；固定数组，不 new 对象。
- 总顶点目标：≤45,000/帧，硬警报 50,000；超过时拆“主角下方/上方”两个 Graphics，而不是拆成每怪一个节点。

### 反模式

- 每帧 `new Color()`、每帧 `filter/slice/sort`、每帧创建事件对象引用。
- 每个部件单独 `fill()+stroke()`（会产生“碎片感”和大量提交）。
- 用 `Math.random()` 做动画。
- 在 Graphics 里画文字（用 HUD Label）。
- 为单个敌人/火花创建 Node。
- 为了“更好看”改变危险半径、角度、缺口、时序。
- 省电模式隐藏危险边界。
- 直接改 `ink()` 返回的 Color。
- 在 Art 函数里读 `w.mods` 而不是 `stats.mods`。

## 11. Legacy 与已知限制

### 当前无生产者/不要依赖

- 危险 kind：`pool`、`flame`、`flameLine`、`burst`、`starTrace`、`starLeap`、`frontierImpact`、`bellPulse`。保留可运行分支，但不投入新视觉预算。
- 敌人字段：`burn/burnUntil/burnNext`、`siegeFreezeResist`、`hazardId`；`GameBootstrap.flashes` 已删除。
- 效果类型：`summon`、`lightning`、`ultimate`、`supply` 当前没有生产者。
- `tools/check-weapon-form-render.mjs` 引用已归档模块，已失效；用 `npm run art:preview` 替代。
- 像素图集 `assets/resources/pixel/atlas.png`/`PixelAtlas.ts`/`AssetIndex.ts` 不再用于敌人、主角、药水；主角和药水已是矢量。不要把它们重新接回敌人绘制。

### 已知画/判定不一致（保留）

- `frontierLane` 画胶囊、判定径向 `distance < radius`。
- `burst` 视觉点 9px、判定 0.38 世界单位。
- 这些是历史问题；本轮不单方面改画面或判定。若未来要修，先改 `battle/` 判定并同步测试/文档，再改画面。

### 环境与本地试玩

- Windows已配置Creator 3.8.8并完成Web构建，使用 `npm run dev` 构建并启动本地试玩，地址 `http://127.0.0.1:8128`；已有构建可用 `npm run serve:web`。路径配置与验证状态见[当前项目基线](current-baseline.md)。**最终仍需做844×390横屏、微信真机触控/帧率/发热验收**。
- `tools/art-preview.mjs` 使用 `cc-stub.mjs` 近似 Cocos 路径渲染，用于构图、剪影、预算和可读性检查，不保证逐像素一致。

## 12. 验收清单

### 自动

```sh
npm ci
npm test
npm run art:preview
npm run art:review
npm run art:motion
npm run art:builds
npm run art:combat
```

- `npm ci` 安装 `typescript`/`sharp` 等开发依赖；`art:preview` 需要它们。
- `npm test`：当前工作区全部通过（仅 1 个已归档 Altar 测试跳过）；具体数字以实际运行为准，其他 AI 可能同时改动测试。
- `art:preview`：输出 `artifacts/art-preview/enemies-*.png`、`spells.png`、`hazards.png`、`heroes.png`、`budget.json`；`budget.json` 的 `violations` 应为空。
- `art:review`：运行时地图和战斗Painter合成844×390图，覆盖四关、四武器、双危险、三个时刻与省电模式，并生成100敌人压力样本统计；`artifacts/art-review/combat-budget.json` 的超标项应为空。它不含HUD，不能当成实机截图或帧率测试。
- `art:motion`：生成36帧 `artifacts/art-review/motion-study.gif` 及关键帧PNG；上排放大、下排为游戏比例，覆盖普通兵行走/冻结、精英与Boss受控姿态、雷电衰减/回击。受控姿态图不代表一次真实技能录像。
- `art:builds`：真实Armory向固定高血量目标施放，生成10基础＋40单改＋50双改配置、共300个时刻的对照图及 `artifacts/art-builds/report.json`。固定时刻可落在攻击空档；不含完整敌人AI和HUD，不替代真人验收。
- `art:combat`：完整关卡逻辑60步/秒，生成三四关各遭遇/首领片段共4段、240帧离线回放及前后对照页。固定四级四武器、等级64、高生命和脚本走位，不代表普通成长/胜率或浏览器录屏。构建Web后运行 `node tools/art-combat.mjs --copy-local` 暂存到本地 `/qa-combat/`；只用于本地诊断，不接入游戏或微信包。
- 快速看图：[铁棘围城](../artifacts/art-preview/enemies-siege.png)、[赤砂虫巢](../artifacts/art-preview/enemies-sand.png)、[雷铸机庭](../artifacts/art-preview/enemies-thunder.png)、[苍棘猎原](../artifacts/art-preview/enemies-moon.png)、[法术](../artifacts/art-preview/spells.png)、[危险预警](../artifacts/art-preview/hazards.png)、[主角](../artifacts/art-preview/heroes.png)。
- 新增/修改后至少检查：敌人目录、预警几何、100 敌人预算三项测试。

### 人工（手机横屏 844×390）

- 普通怪/精英/Boss 在 50% 缩放下仍能靠剪影区分。
- 当前武器槽位上限（当前为四把）满配时，敌方预警边界、方向、缺口、序号仍清晰；槽位以后续 `SurvivalWorld.weaponSlots` 为准。
- 两个危险并存时，不出现颜色-only 的信息。
- 省电模式下危险信息不丢失。
- 冻结/减速/入场/Boss 恢复期状态可辨。
- 主角与敌人 Y 排序正确，药水/经验不被遮挡。
- 微信真机触控、帧率、发热；浏览器截图不能替代真机。

## 13. 当前完成度与下一轮建议

- 四关敌人、四关 Boss、三主角、药水/经验、基础三武器、七种改造武器、通用危险预警：已切换到新美术层。
- 已完成：共享墨线/轮廓合并、Y 排序、离屏裁剪、暂停不重绘、逐帧 Color 清理、固定容量粒子、离线预览工具、美术测试。
- 建议下一轮：
  1. 在真机上复核 Boss 尺寸/透明度/血条遮挡。
  2. 沙巢外刺、雷庭展开翼、猎原分叉角已补阶段剪影，继续检查实际缩放和动画中的辨认效果。
  3. 地图已接入 `MapArt.ts` 的统一材质；继续核查不同设备上装饰对比与通行路线可读性。
  4. 为 `frontierLane`/`burst` 的历史画/判不一致做玩法决策，先改判定再改画面。
  5. 如果顶点预算在真机压力下仍偏高，把角色层拆成主角上下两个 Graphics（预留方案，不要拆成每怪节点）。

## 14. 本轮资源生成与复现清单

资源源文件就是 `presentation/art/` 下的TypeScript绘制代码，不额外导出栅格图用于运行时。材质与造型为项目程序绘制，无外部素材授权依赖。`EnemyCatalog` 为敌人目录；基础三武器在 `SpellPainter`，七武器在 `spells/ExtraSpellArt`，四地图在 `MapArt`，共享特效笔触在 `VfxBrush`。

`npm run art:preview` 生成单体SVG/PNG；`npm run art:review` 生成战斗SVG/PNG与预算JSON。输出位于 `artifacts/`，仅供审阅，不要当作游戏加载资源。新样式先在敌人普通/蓄力/恢复/冻结及50%缩略图检查，再放进844×390四武器画面；最后由Web和微信真机确认。

2026-10-19第四轮回放精修后回归为242项（241通过、1归档跳过），单体230条目预算超标0；四武器24场景最高13,783个近似顶点，100敌人/四武器/双危险为25,067个近似顶点；4段完整逻辑回放最高17,923个近似顶点。第三关实际回放未覆盖双危险，不能据此关闭混战验收。普通兵曾触及100只提交上限，已减少独立高光提交，保持原预算。记录、动图与前后图见[复查及整改](art-review-2026-10-19.md)。


### 掉落物与攻击生效的视觉层级

经验结晶在玩家3.2单位外使用低亮切面，3.2到1.4单位之间逐步提亮；这是绘制距离，不是吸取半径。保留价值对应的尺寸，不使用常驻光晕或第二层描边，不改变药水的可见性。画外结晶可以裁剪。
敌方瞬时强调只能在真实due之后出现，雷系边线接触强调0.16秒、月系落地碎屑0.2秒；危险结束依旧由模拟控制，短强调结束不表示伤害结束。电墙缺口、方向、序号与真实边界不得被装饰覆盖。普通怪优先头肩、背部受光面与武器大形，继续遵守原有预算。


### 主角与反馈层级

友方效果拥挤时，主角定位线放在友方弹体/粒子之后、敌人状态与危险预警之前；仅保留开放的头肩线，不能描成无敌罩或遮住危险。主角正常身体仍按脚底深度绘制。普通命中、重击、精英死亡分别使用短碎片、角形放射、断裂冠标，不依赖增加全屏闪光和震动区分。重击装饰合并使用呈现时钟，暂停不得推动战斗时间；切换画质仍需更新全部粒子寿命。


### 十武器重实现后的绘制约定

飞刀默认环绕，`orbit` ID现代表扩阵，`hunt`才替换为远射；绘制角度需将环绕的位置角转成切向刀锋，碰撞由模拟沿圆弧采样。寒霜基础0.1秒后单次爆冰，残纹不代表持续伤害，外扩与三相按真实阶段绘制。幽灵phase0追击、phase3第二爪、phase1盘魂、phase2回收；companion为在岗编号，ghostCount在新任务调度时更新；驻队幽灵只有视觉，无仇恨/碰撞/伤害。骨矛phase−1表示0.2秒蓄力，phase0飞行、phase1骨棘。圣水lastTick、圣剑impactAt读取实际模拟事件；地雷爆炸在同一步进入phase2，不能只在phase1画爆发。完整最新规则见[重实现记录](weapon-reimplementation.md)。
