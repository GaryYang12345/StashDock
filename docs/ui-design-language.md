# StashDock 设计语言：Arc baseline

Arc 是控件和语义规范的基础，不是把整个产品变成其演示站。Desktop、ChatGPT MCP App 和
浏览器扩展共用同一套语义 token、文案和交互含义；可以有不同密度，不能各自发明颜色、
圆角和成功状态。整体形态见 [design.md](../design.md)，强制规则以 `AGENTS.md` 为准。

## 产品原则

用户在一个轻量入口里找到参考、选择、复制或交给 AI。主界面不是分析 dashboard，不增加
KPI、图表、账号系统或 AI 对话功能来填满页面。

视觉方向：白色中性表面、清晰黑白品牌、克制层级。文件夹是唯一主要拟物品牌元素；
普通控件保持 Arc 的安静、清晰和可预测。

## 1. 颜色和表面

沿用 Arc 语义层：background、surface、surface-raised、surface-muted；foreground、
text-secondary、text-muted；border、border-subtle、border-strong；accent、
accent-subtle、accent-foreground；success、warning、danger。产品专属角色集中在
`src/styles/product-tokens.css`（如 `--favorite-star`、tooltip、类型封面色调）。

- 浅色、深色、跟随系统三种外观均已实现；截图保留真实颜色。
- 主动作与选中态使用中性强调；红色只表示删除、错误等真实语义。
- 卡片以一像素边界和留白分组，不给每张卡片加漂浮阴影。菜单、弹窗、浮动操作条使用浮层阴影。
- Desktop 外壳为灰色导航/chrome 包裹白色圆角内容区，内容区只有轻微中性阴影，不用分区线。
- 不加紫蓝渐变、发光、每个图标的圆形底座。文件夹材质及其投影
  （`--folder-elevation`，文件夹搜索共用）是品牌例外，不扩散到普通控件。

依据：[Arc theming](https://uiarc.dev/docs/theming)、[Arc design](https://uiarc.dev/r/skills/arc/design.md)。

## 2. 字体和信息层级

大标题使用 Geist，正文、控件和小标题使用 Inter，中文回退到系统中文无衬线字体。
字体随应用本地打包并附许可证，不依赖运行时联网。

- 字号以 Arc scale 为起点：12 / 14 / 16 / 18 / 22 / 28。工具面板优先 14px 正文、12px 元信息。
- 只用常规 400 和中等 500；靠间距、字号和对比形成层级。
- 可变数量使用 tabular-nums。
- 不使用装饰性大写眉题；不修改用户收藏的标题和正文。

依据：[Arc design](https://uiarc.dev/r/skills/arc/design.md)、[Arc copy](https://uiarc.dev/r/skills/arc/copy.md)。

## 3. 几何和密度

- 4px spacing grid；组内 8 / 12 / 16，区域之间 24，主内容边距 24（窄面板 16）。
- Arc 圆角 control / panel / surface 为 18 / 26 / 34px。嵌套圆角为外圆角减内边距。
- 普通控件 36px，触屏/主动作可用 44px。仅图标的按钮宽高相等、50% 圆角，hover/pressed
  填充同形；带文字的按钮保持 Arc 原形。
- 对话框标题区使用共享 24px gutter（窄面 16px），标题与字段左对齐，Close 与首行标题居中对齐。
- 需要 compact 时使用按 surface 生效的命名 token 变体，不为单个按钮写任意圆角或字号。

依据：[Arc composition](https://uiarc.dev/r/skills/arc/composition.md)。

## 4. 收藏卡片

所有宿主共用 `ReferenceCardView`：

- 8px 内边距、16:9 封面、26px 外圆角与 18px 内圆角。
- 封面左上角为选择，右上角为收藏/删除，均为浅色圆形 Arc Button，细指针悬停或键盘
  focus-visible 时显示；已选中保持可见；触屏始终可见、44px 触点。
- 下方为标题（悬停 tooltip 显示全文）和三点菜单（Edit card / Edit content），底部为
  来源标识、打开按钮和主动作：Desktop 为黑色 Copy for AI，MCP App 为 Add to chat。
- 收藏成功为 `--favorite-star` 实心星，颜色只作用于星形。
- 编辑只通过三点菜单，不用右键；标签的右键操作保留。同一界面同时只打开一个卡片菜单。
- 默认封面与来源标识共用同一套类型图标（本地打包的开源彩色图标集），用互补的语义色调区分
  Note、纯文本、Markdown、图片和 Office 格式。
- favicon 优先浏览器提供的图标，其次站点 `/favicon.ico`；失败时重置候选并使用回退，
  不经第三方代理。

## 5. 动效

共享 Arc motion tokens（`src/components/arc/motion-tokens.ts`）：smooth（面板、高度、
导航滑块，零回弹）、snappy（按压和小指示器）、morph（随内容变化的宽度）；颜色/透明度
使用 fast/standard 时长和 enter / exit / standard / inOut 曲线。

- 每次操作一个连贯、可打断、可反向的反馈；不先消失再出现，不重复入场。
- 只动画 transform 与 opacity；同一元素只有一个 transform 来源。
- 浏览时不循环漂浮、不自动排序、不滚动文字。只有真实 loading 才持续显示状态，骨架脉动到
  完成或失败为止。
- 外部拖拽和原生窗口拖动优先，动效不能截获手势或增加等待。
- 窗口形态与交接由原生生命周期统一管理（见 [窗口生命周期](WINDOW_LIFECYCLE.md)）；Arc 负责
  窗口内的界面。面板阴影、缩放和窗口边界交给系统，不使用大透明画布或独立阴影层。
- reduced motion 保留完整功能和反馈，去掉位移和缩放。

依据：[Arc motion](https://uiarc.dev/r/skills/arc/motion.md)。

## 6. 操作和状态

- 一项动作始终使用同一个控件。Import 是进入导入流程的主动作；多选后的单行选择工具条承接
  当前任务。
- Copy for AI / Add to chat：黑色 → 临时绿色 Copied / Added（同时显示 Check，不只靠颜色）→
  黑色；允许重复。失败显示可操作的错误。
- 删除只从 StashDock 移除，不修改原文件、原书签或原网站；删除收藏和移除标签共用同一个
  破坏性操作组件。没有持久化恢复前不显示 Undo。
- 多选使用可访问的选择控件，支持全选 mixed 状态；拖拽始终有复制按钮作为替代。
- 每个区域设计 loading、空库、无结果、断连/错误、成功、禁用和长文本状态；静默刷新不把
  已显示内容换成骨架。
- 键盘 focus、菜单定位、Escape、Tab 和关闭后的焦点恢复属于组件边界；图标按钮有具体的
  accessible name。hover 不是唯一入口。

## 7. 提示

- 所有提示使用同一 tooltip：#0D0D0D 底、白字、8px 圆角，两种主题不变；鼠标停留 700ms
  显示。TooltipLayer 与扩展共用同一委托 adapter，保留键盘描述、Escape 和清理。
- 只为不熟悉的图标操作 opt-in 提示；已标注的按钮、标题、网址和常见关闭/刷新不重复提示。
- 可选说明放在字段或分区标题旁的小问号上，正常指针，只变前景色。
- 系统 UI（托盘菜单、浏览器工具栏）不做网页样式覆盖。

## 8. 组件和代码边界

三层：Arc 官方 primitives（CSS modules + foundation）→ StashDock 行为 adapter → 业务视图。
不修改 Arc 内部；没有合适现成项时用免费 primitives 组成 StashDock 专有布局，不复刻 Pro 代码。
UI 图标统一 Lucide 尺寸/线宽，品牌 logo 独立。弹窗 Portal 挂在当前可见面板内。
扩展保持纯 HTML，通过构建脚本同步同一份 foundation、字体、tooltip 和滚动条样式。

## 验收

在 Desktop 和 MCP App 中检查窄/宽面板、100% / 150% DPI、长中英文标题、无封面、大量合成
记录、两种主题、键盘和 reduced motion，并在实际尺寸下判断光学平衡。组件看起来更流畅
不代表更快，性能以隔离的前后测量为准。

Arc 接入的来源与映射见 [Arc adoption plan](arc-adoption-plan.md)；早期验收记录见
[arc-surfaces-verification.md](history/arc-surfaces-verification.md)（历史，不是现行规则）。
