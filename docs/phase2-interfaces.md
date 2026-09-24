# 第二阶段：规则、数据与接口

本文件描述已实现的第二阶段接口。第一阶段的 `DisplaySceneConfig` 仍只服务于 `/showcase.html`，不作为关卡文件使用。

## 坐标与规则

- 一格为 1 个世界单位。`x` 向东增加，`z` 向南增加，`terrain[z][x]` 是地表的绝对高度；`null` 是虚空。水不沿对角线传播。
- 地形高度为 0–12 的整数。箱子高度为 1，有效地表 = 地形高度 + 当前格箱子的高度，最大为 13。装饰与主角不改变有效地表。
- 无限水源每次结算直接达到稳定水位，无注水量、累积时间或残留水。被水源断开的低洼地立即干燥。
- 稳定水面等于有效地表时为 `sheet`（平流层，深度 0）；高于有效地表时为 `deep`（深水，保留实际深度）。箱顶可以形成平流层，也可以处于深水之中。
- 所有到虚空的实际流动边均为出口；同一个角落格可贡献两条出口边。地图内部平台之间的落水不计为出口。
- 主角上下一格台阶，不能进入虚空。推箱要求主角、箱子、目标三格的地形同高，目标无箱子；不连推、堆叠或推入虚空。
- 胜利条件：恰好一条出口边，并且主角站在该边的上游格。不要求踏入虚空。已经通关的状态停止接受移动／等待，仍可撤销、重做和重开。

## 数据格式

`src/core/types.ts` 是类型的唯一来源；数据本身没有 Three.js 依赖。

| 类型 | 内容 |
| --- | --- |
| `Cell` | `{ x, z }`，整数坐标 |
| `LevelDataV1` | `version: 1`、`name`、`width`、`depth`、`terrain`、`source`、`spawn`、`boxes`、`decorations` |
| `Box` | `{ id, x, z }`，ID 在箱子列表中唯一 |
| `Decoration` | `{ id, kind: 'plant' \| 'arch', x, z }`，仅装饰 |
| `GameState` | `player`、当前 `boxes`、`turn`、`status: 'playing' \| 'won'` |
| `GameCommand` | `{ type: 'move', direction: 'north' \| 'east' \| 'south' \| 'west' }` 或 `{ type: 'wait' }` |
| `WaterCell` | `x, z, ground, level, depth, kind`；`ground` 包含箱子高度；干燥格 `level = ground`、`depth = 0` |
| `WaterEdge` | `id, x, z, direction, from, to, kind`；坐标为上游格，`from/to` 为绝对高度 |
| `WaterSolution` | `cells[z][x]`、`falls`、`outlets`；虚空格为 `null` |

允许不完整草稿：`source` 和 `spawn` 可以为 `null`。只有进入试玩时才要求二者齐全。水源是单一对象，不能同时定义多个。箱子不能重复占格，也不能与出生点重叠。水源可与箱子同格，水会落在箱顶。

完整 JSON 示例位于 `levels/`：`homecoming.json`、`rising.json`、`isolation.json`、`cascade.json`。名称最多 60 字符，ID 最多 80 字符；文件上限 1 MB。导入会重建已知字段，不传播额外字段。

## 纯逻辑 API

| API | 行为 |
| --- | --- |
| `solveWater(level, boxes = level.boxes)` | 返回新的 `WaterSolution`；不修改输入，不读取时钟或上回合水量 |
| `createGame(level)` | 校验后生成初始 `state` 和 `water`，并检查初始胜利条件 |
| `applyAction(level, state, command)` | 返回 `{ state, water, accepted, message }`；有效行动推进一回合，无效行动不推进；移动、箱位、水流和胜利一次结算 |
| `validateLevel(value: unknown)` | 返回具体错误列表；检查结构、范围和占位，允许不完整草稿 |
| `validatePlayable(level)` | 在结构检查之外要求水源和出生点齐全；不证明谜题有解 |
| `parseLevel(text)` | 解析和校验 JSON，失败抛出中文错误，成功返回新的关卡对象 |
| `serializeLevel(level)` | 返回可读 JSON；不会自动将草稿升级为可试玩关卡 |
| `createLevel(width = 12, depth = 12)` | 创建全 0 高度、无水源与出生点的草稿 |

`GameController` 负责历史记录：构造时复制关卡；`act / undo / redo / restart` 更新 `state` 与 `water`。撤销和重做保存角色、箱子、回合快照，然后重新求解水；历史上限 200 次，新行动清空重做分支。视觉过渡不是逻辑历史。

## 求解过程与边界

1. 构建地形与箱子合成后的有效高度数组。
2. 把地图边界以及内部虚空的实体邻格放入最小堆。向内传播 `spill[next] = min(spill[next], max(spill[current], ground[next]))`，得到每格排到外部所需的最低水位。
3. 从唯一水源开始，只向 `spill[next] <= spill[current]` 的邻格扩展。相同水位全部展开，较低水位继续下泄，未到达的区域保持干燥。
4. 对实际湿润格分类；相邻湿格的水面降低产生内部瀑布；邻接虚空产生最终出口边。出口 `to = from - 4` 是显示终点，不是一个隐藏的蓄水层。

最小堆以水位、格子序号稳定排序；邻格固定按北、东、南、西遍历。相同输入会得到相同格子、边顺序与胜利状态。时间复杂度 `O(N log N)`，空间复杂度 `O(N)`，N 最大 1024。

地形填洼参考 [Priority-Flood 原论文](https://arxiv.org/abs/1511.04463)。水源可达筛选、即刻消水、平流层分类与逐边出口计数是本游戏约定。它是确定性的高度场规则，没有连续流体压力、惯性、流速或体积守恒模拟。

## 编辑器与渲染边界

`EditorSession` 保存初始布局和编辑历史，`beginStroke → paint → commitStroke` 将一次拖动合为一个操作；同一拖动内一个格子只处理一次。挖空同步清除该格的水源、出生点、箱子与装饰。试玩创建 `GameController(editor.level)` 副本，不回写编辑状态。

`saveDraft / loadDraft` 使用 `water-paradise:editor:v1` 存储键。保存失败保留内存草稿，显示导出提示；坏存储不会被自动删除。JSON 导入先解析，成功后才替换编辑稿。

`BoardView` 是 Three.js 边界：

- `setState(level, boxes, player, water, { animate, fit })` 接收完整结果，不推导规则。
- `setEditor` 隔离左键绘制和右键环绕；试玩允许左键环绕。
- `setDebug / resetView / pick / project / stats / dispose` 管理辅助显示、相机、选格和资源生命周期。
- `BoardScene` 按高度实例化石柱，复用箱子、出口和水深标签；地形或装饰改变时才重建静态部分。
- `WaterLayer` 将水面和瀑布分别合为几何体。相邻同水位格无内部泡沫线；薄水保留地砖，深水加强水色；所有落水止于下层承接水面，虚空瀑布长 4 格。
- 规则提交后以约 300 ms 过渡水面。系统减少动态效果时直接切换。暂停动画只冻结水纹／瀑布纹理的时间，不冻结规则或状态过渡。
- 像素密度上限 1.75，阴影仅在场景／角色改变时更新；替换几何、实例缓冲和材质时释放资源。

相机使用官方 [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)。试玩初始方位角 36°、俯视角 50°，以提高低处水路可见性；环绕 360°、俯视 20°–70°、缩放 0.55–2.4，不平移。美术样板维持原来的 33° 初始俯视与缩放范围。

`?qa` 显式开启 `window.__waterQA`，用于验收只读快照、投影选格、指定相机、加载测试草稿、求解计时及模拟图形连接中断；不是公开游戏或关卡 API。

## 后续扩展

第三阶段的特殊物品、能力及编辑器完善可通过扩展关卡版本、命令检查和有效地表构造接入。当前版本只承诺高度场与普通箱子的规则。音效、正式角色美术、公开发布仍未加入。
