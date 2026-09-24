# 技术选型与结构

> 本文保留第一阶段美术样板的技术记录。第二阶段已经增加正式关卡格式、游戏规则与编辑器；当前接口见 [第二阶段接口说明](phase2-interfaces.md)，运行入口和阶段范围以 [README](../README.md) 为准。下文“后续阶段”指第一阶段完成时的安排。

## 决定

采用 Three.js 0.186.0、TypeScript 7.0.2、Vite 8.3.0，依赖由 package-lock.json 固定。浏览器为首发平台，第一阶段使用原生 HTML/CSS 界面，不需要后端或账号服务。

| 方案 | 与本项目相关的能力 | 本次决定 |
| --- | --- | --- |
| Three.js | 提供场景、相机、材质、阴影及扩展控制器；可在独立代码中组织自定义规则 | 已选择，适合小型程序化场景与后续独立水流逻辑 |
| Babylon.js | 提供完整场景系统、动画、物理接入与检查器等游戏工具 | 可行，但本次不需要引入这些额外系统 |

Three.js 是渲染库，本工程还不是完整游戏框架。选择它不会自动提供推箱子逻辑、撤销或关卡编辑器；这些部分应在第二、三阶段按实际玩法设计。

资料：[Three.js 场景基础](https://threejs.org/manual/pages/creating-a-scene.html)、[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)、[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[阴影参数](https://threejs.org/docs/pages/LightShadow.html)、[Vite](https://vite.dev/guide/)、[Babylon.js 功能表](https://www.babylonjs.com/specifications/)。

## 组织与数据流

```text
main.ts → 展示生命周期 + 界面绑定
              │
       GardenDisplay
       ├─ 渲染器、光照、窗口适配、资源释放
       ├─ GardenCamera → 正交相机 / OrbitControls
       └─ Garden
          ├─ Modules + materials → 石材 / 地砖 / 植物 / 栏杆
          ├─ WaterVisual → 时间驱动的水面与瀑布
          └─ 辅助网格

config.ts → 展示配置、相机范围、调色板
ui.ts     → 暂停 / 网格 / 视角 / 可访问操作
```

`src/scene/config.ts` 集中定义样板配置与调色板，`garden.ts` 负责这一个庭院的具体构图，几何复用和模块生成由 `modules.ts` 负责。展示布局中的部分尺寸是专门为此场景确定的，不是可任意编辑的通用关卡布局。

每帧只推进水体视觉时间、更新相机并渲染。暂停只冻结水面和瀑布，相机仍能操作。切换后台时跳过更新，恢复时不累计后台时间。

## 当前接口

- `DisplaySceneConfig`：样板的格子基准、水面尺寸与位置、瀑布尺寸、相机约束；纯展示用途。
- `GardenDisplay(container, config, onFailure)`：创建场景并开始渲染。
- `setPaused(boolean)` / `setGridVisible(boolean)` / `resetView()`：基础展示交互。
- `snapshot()`：返回展示状态与性能信息，供界面和验收使用。
- `dispose()`：停止渲染，解除监听，释放几何体、材质、纹理与阴影资源。
- `?qa`：显式启用 `window.__gardenQA`，用于验收状态读取、指定观察角度和模拟图形连接中断。普通访问不暴露此入口；它不是游戏 API。

不新增任何外部 HTTP API，也不建立正式关卡、求解器或玩家操作数据类型。第二阶段应先确定水的传播、阻挡、垂直关系、步进方式和胜利条件，再设计独立于 Three.js 的规则与状态接口。

## 性能与稳定性

- 地砖与植物使用实例化绘制，重复石块共享几何体，所有模型由代码生成。
- 像素密度上限 1.75；采用 WebGL 2，无 WebGPU 依赖。
- 本阶段建筑与灯光不动，阴影只生成一次；后续动态机关必须主动使阴影失效或重新开启更新。
- 水面、瀑布、护栏明确排序并关闭透明面的深度写入；不堆叠多层玻璃。
- 不加载外部模型、图像、字体或 CDN 脚本。参考图位于 docs，生产构建不包含它。
- 初始化失败与图形上下文丢失提供中文提示和重新打开按钮。热更新和页面离开时释放资源。
- 当前单个 JS 包约 615 kB，gzip 约 157 kB，构建工具有超过 500 kB 的体积提示；主要来自三维库，属于非阻断提示。后续编辑器按需加载，不随第一屏一起打包。

## 阶段承接

第二阶段：独立水流规则、游戏状态、命令与渲染适配接口，再用本场景的视觉模块显示求解结果。

第三阶段：主角、可交互物品、关卡编辑器、完整游戏测试和部署。第一阶段不预设唯一出水点的计算方式，也不把这座样板庭院视为可通关关卡。
