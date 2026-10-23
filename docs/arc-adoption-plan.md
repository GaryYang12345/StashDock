# Arc UI 接入

StashDock 的控件基础是 [Arc](https://uiarc.dev) 免费组件。本文记录当前接入方式和边界；
设计规范见 [ui-design-language.md](ui-design-language.md)，组件安装说明见
`src/components/arc/README.md`。开发时使用仓库内的 Arc Skill（`.agents/skills/arc/SKILL.md`）。

## 已接入

- 源码位于 `src/components/arc/`：foundation、Button、CopyButton、SearchField、
  SegmentedControl、Card、Dialog、Input、Textarea、Tabs、Checkbox、DropdownMenu、Popover、
  Combobox、TagInput、ScrollArea、Progress、Skeleton、Alert、EmptyState、FileUpload、
  Avatar/AvatarGroup 及共享 motion tokens。只用免费项，不含 Pro 源码。
- 组件按官方源码保留，不修改内部；StashDock 通过文档化 props、语义 token 和外部组合实现
  业务布局。foundation 在 `src/main.tsx` 只引入一次；Geist / Inter 通过 Fontsource 本地打包。
- 动效统一 `motion/react` 与 Arc motion tokens；UI 图标统一 Lucide，类型图标和品牌标识独立。
- `FluidDialog` 组合 Arc Dialog root，并用 Radix 文档化的 Portal `container` 把弹窗挂在当前
  可见面板内，焦点、Escape 和可访问语义由 Radix 负责。
- 浏览器扩展是纯 HTML，不是 React Arc 组件；`scripts/sync-extension-ui.mjs` 同步同一份
  foundation、字体、Lucide 图标、tooltip、滚动条样式和 context formatter（`--check` 只读校验）。
- CSS modules 与 Tailwind v4 共存；Arc 表面不混写任意颜色或字号。

## 组件用法约定

| 区域 | 组件 | 约定 |
| --- | --- | --- |
| 普通动作、窗口控件 | Button | 仅图标按钮为正圆；窗口控件位置固定 |
| 搜索 | SearchField | 接现有 controller 与共享搜索契约；文件夹搜索复用同一组件 |
| Grid/List、Content/Preview | SegmentedControl | 同一数据的互斥视图；各实例 highlight 独立 |
| 导入表单（Link/Note/File/Bookmarks） | Tabs、Input、Textarea、FileUpload | 切换不丢草稿；Choose files 打开系统对话框；Save 是独立动作 |
| 卡片 | 免费 primitives 组合 | 共享 `ReferenceCardView`，不套通用 Card 的 quick-look 结构 |
| 卡片/标签菜单 | DropdownMenu | 与标签筛选共用 Arc hover 高亮；同时只开一个 |
| 书签导入选择 | Checkbox | 支持 mixed 全选状态 |
| 标签输入 | TagInput、Popover | 存储仍为标签数组；离散标签保持不透明 |
| 主内容和标签列表滚动 | ScrollArea | 不拦截原生滚轮 |
| 批量导入 | Progress | 共享居中进度面板，数值跟随实际完成量 |
| 加载、错误、空库 | Skeleton、Alert、EmptyState | 骨架只在首次加载；错误带重试；空库与无结果分开 |

## 明确不替换

- 文件夹图稿（`FolderArtwork`）和品牌资源：已批准的品牌元素，不用 Arc 默认 logo 取代。
- 原生窗口生命周期、文件夹/面板交接和文件夹搜索窗口：由原生层负责，不是网页 dialog/drawer。
- library store/controller/selectors、SQLite、MCP 和浏览器协议：UI 只调用现有动作。
- 不添加 command palette、聊天 composer、图表/KPI 或账号侧栏。

## 许可

免费组件为 MIT，版权与许可随源码保留（`src/components/arc/LICENSE`、
`.agents/skills/arc/LICENSE`、`THIRD_PARTY_NOTICES.md`）。Arc Pro 使用不同许可，未引入。
贡献者无需 Arc 账号即可构建；Arc MCP 只是开发便利，不是构建或运行依赖。

早期评估和逐轮验收记录在 [history](history/README.md)，例如
[shared-shelf-ui-verification.md](history/shared-shelf-ui-verification.md)、
[arc-surfaces-verification.md](history/arc-surfaces-verification.md)、
[arc-baseline-verification.md](history/arc-baseline-verification.md)。
