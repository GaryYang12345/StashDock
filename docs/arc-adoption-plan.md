# Arc UI 接入梳理

## 实施进度（2026-10-08）

后续统一：大小面板共用 session、CopyForAI 和官方 ScrollArea，导航采用公开 shared-layout 模式；去掉 Codex 自动唤起和冗余顶部复制。最新验证见 [shared-shelf-ui-verification.md](shared-shelf-ui-verification.md)。第三轮补齐的小 Dock、导入表单、错误重试和扩展记录见 [arc-surfaces-verification.md](arc-surfaces-verification.md)。Codex 插件复用 `/dock?surface=codex`，不维护独立 UI；文件夹品牌材质和原生窗口引擎保留。

已通过官方 shadcn CLI 安装免费 foundation、Button、CopyButton、SearchField、SegmentedControl、Card、Dialog，以及其共享 motion/copy helpers。没有重新配置 MCP 或使用 Pro。

第三轮新增免费 Input、Textarea、Tabs、EmptyState、Skeleton、Alert。批量 shadcn 命令连接超时，按官方手动安装说明从 `https://uiarc.dev/r/<id>.json` 原样取源码；未改官方组件内部。新增 Radix Tabs 依赖。扩展仍为纯 HTML，通过构建脚本同步同一份 foundation、Inter、Lucide、品牌和 context formatter。

- 应用动画导入统一到 motion/react 14.0.0。底层 framer-motion 14.0.0 作为 Motion 内部依赖存在，但没有第二套版本或应用直接依赖。
- 普通 UI 图标迁到 Lucide，统一 1.75 线宽；用户品牌和已批准文件夹几何不变，文件夹里的链接符号改为 Lucide。
- 两种面板头部接同一套 Button/SearchField/SegmentedControl，保留 controller、Ctrl+K、原生顶部拖动和窗口控件顺序。旧全局按压 CSS 不再作用于新 Arc 区域。
- /design 为按需加载的只读样板，通过现有 loopback bridge 读取收藏，不增删改。样板的 dark/blue 仅验证组件主题，不开启产品暗色模式。
- FluidDialog 是平台适配层：使用 Arc Dialog root 和 Radix 的文档化 Portal `container`，原生弹窗挂在可见 Library pane 内，普通浏览器挂在 body。Radix 负责焦点、Escape 和可访问语义；不修改官方 Arc DialogContent 或虚构 props。
- Inter/Geist 打包本地资源；Arc、Motion、Lucide 和字体许可证纳入 public/licenses 与 THIRD_PARTY_NOTICES.md。

下面保留前一轮评估记录，不能把其中“尚未安装”的历史表述理解为当前状态。具体验证见 [arc-baseline-verification.md](arc-baseline-verification.md)。

检查日期：2026-10-08。范围：官方 AI docs、免费 skill、foundation/motion、相关组件 API 与部分源码，以及当前桌面/内嵌/扩展代码。没有修改运行 UI，没有安装应用依赖或购买 Pro。

## 工具状态

- 官方 arc skill 的 13 个 Markdown 文件已从 https://uiarc.dev/r/arc-skill.json 原样安装到 C:/Users/86137/.codex/skills/arc。Codex 的文件夹不是官方 CLI 默认的 .claude/skills；这里按当前 agent 的目录安装，没有为装 skill 运行 shadcn init 或修改 package.json。下一轮可发现。
- 曾添加 Codex MCP 名称 arc、URL https://uiarc.dev/api/mcp；CLI 检测到 OAuth，但没有完成授权。按用户“先只用官方 skill”的选择，已撤回本轮新增的 arc MCP 配置，不保留待登录连接。本轮组件阅读使用公开 Markdown/registry。
- 无需把 Arc MCP 嵌到 StashDock 产品里。它是开发时查找组件的工具，不是最终用户安装要求；打包后的 UI 使用本地组件源码。

## 当前代码的设计缺口

| 位置 | 当前状况 | 需要统一的内容 |
| --- | --- | --- |
| src/index.css | 少量 motion vars、原始 hex、全局 button active transform、自定义 focus | 共享 foundation、semantic tokens；去除会影响 Arc 控件的全局动画/focus 规则 |
| Toolbar / Sidebar | 8至13px 小字、uppercase 眉题、局部 zinc、不同 rounded | 去掉装饰眉题，统一文字、密度、边界和主动作层级 |
| StashCard | 选择、收藏、删除多为 hover-only；每卡全宽复制；多种自制 fallback | 固定内容结构、可访问操作、真实截图/站点 fallback、统一选择态 |
| DockView | 单独实现搜索和 chip、反馈与大面板相似但风格不同 | 相同 primitives，compact layout，而非第二套控件 |
| AddDialog / FluidDialog | 自制 Tabs/field/焦点循环和 Portal | Arc 表单/Tabs，保留面板内 Portal 的平台边界 |
| ContextBar | 多选、拖拽、Copy + open Codex 聚在一起 | 区分复制与打开；保留 Markdown/URI payload；语义清晰的批量操作 |
| extension/sidepanel | 原生 HTML/CSS、品牌手写 S、另一套 input/button/提示 | 同品牌和 tokens；暂不为一致性把整个扩展迁到 React |

## 组件映射

以下优先候选均为公开免费项。组件是推荐而非已经应用；具体使用前重新检查 registry 和 API。

| 产品区域 | Arc 候选 | 接入方式和注意点 |
| --- | --- | --- |
| 导入、取消、刷新 | [Button](https://uiarc.dev/components/button)、[Action button](https://uiarc.dev/components/action-button) | 普通动作 Button；真正 async 提交可 ActionButton，返回实际 promise，不能吞失败后显示成功 |
| 单卡、多选复制 | [Copy button](https://uiarc.dev/components/copy-button) | value 来自现有 buildContext；确认/失败在原位。Tauri 和 HTTP 内嵌安全上下文下验证 clipboard；不假设有自定义 onCopy prop |
| 两种面板搜索 | [Search field](https://uiarc.dev/components/search-field) | value/onValueChange 接现有 controller；保留 debounce、FTS 和 stale-result guard；Ctrl+K 不改成命令菜单 |
| Grid/List、Dock 集合切换 | [Segmented control](https://uiarc.dev/components/segmented-control) | 同一数据的互斥视图；独立 LayoutGroup 保证各实例的 highlight 不串台 |
| 导入 Bookmarks/Link/Note/File | [Tabs](https://uiarc.dev/components/tabs) | 这是不同表单面板，不用 Segmented 伪造 tabs；form draft 由上层持有，切换不得丢内容 |
| URL/标题/正文/标签 | [Input](https://uiarc.dev/components/input)、[Textarea](https://uiarc.dev/components/textarea)、Tag input 后续评估 | 标签当前只是逗号文本；迁成 chip 后保持存储数组协议。字段级错误由实际校验提供 |
| 导入弹窗 | [Dialog](https://uiarc.dev/components/dialog) | 浏览器可直接用；桌面先解决 Portal container、overlay positioning、focus 和原生 input region |
| 卡片网格 | [Card](https://uiarc.dev/components/card) + Checkbox + Copy | 拖拽根 article 可接原生 DOM props；media/meta/action 组合；不默认 details/quick-look。密度和 h3 标题层级需对照实际业务 |
| 收藏条目 list / Quick Dock 行 | 免费 primitives 的业务组合 | 不强套 table 或 Pro 列表；保留外部多选 drag 和稳定 item key，行为 adapter 与视觉分离 |
| 多选/全选 | [Checkbox](https://uiarc.dev/components/checkbox) | indeterminate 支持部分选择；标注具体收藏标题；避免整行点击和内部按钮冒泡冲突 |
| 过滤标签 | [Chip group](https://uiarc.dev/components/chip-group) | 当前单 tag 可 multiple=false；不能趁样式迁移偷偷改成多标签查询。大量标签 fold，避免每标签 observer 无限扩张 |
| 窗口/卡片图标操作 | [Tooltip](https://uiarc.dev/components/tooltip)、Button ghost | 可读标签、focus；窗口控件固定位置，不用 expanding group 让按钮来回移动 |
| 删除 | [Confirm morph](https://uiarc.dev/components/confirm-morph) 或 Dialog | 窄卡片里 inline confirmation 可能放不下，优先菜单/紧凑确认。现有业务无持久化 Undo，不提供 onUndo 假实现 |
| 书签 HTML 选择 | [File dropzone](https://uiarc.dev/components/file-dropzone) | 只选文件和本地解析；不用示例 upload API，不引入云上传。Tauri managed-file 对话框保留原生 adapter |
| 初始空库/无结果 | [Empty state](https://uiarc.dev/components/empty-state) | 空库提供 Import，无结果提供清除；不把两者和断连混为一谈；官方默认 idle animation 需核查，StashDock 不引入装饰循环 |
| 加载/错误/后台导入 | [Skeleton](https://uiarc.dev/components/skeleton)、[Alert](https://uiarc.dev/components/alert)、Toast 后续评估 | skeleton 只初次 loading、保留媒体位置；错误带重试；background import 用临时通知，copy 不靠 toast |
| 多选工具条 | Button / Copy + StashDock 专有容器 | 保留拖拽负载和完整键盘动作；条出现不压住最后一行，预留滚动底部；不套用带大量 observer 的炫技 toolbar |

## 明确不替换

- FloatingFolder、FolderArtwork、用户品牌 full.png/icon.png：已批准的品牌元素，不被 Arc 默认 logo 取代。
- FloatingShell、floating-motion、原生 floating.rs：同一窗口的三种形态，不是网页 dialog/drawer。
- library store/controller/selectors、SQLite、浏览器/MCP 协议：UI 重构只调用现有动作。
- 暂不加 command-palette、coverflow、web Dock、聊天 composer、图表、KPI、账号 sidebar。它们不是用户当前任务所需。

## 已核查的工程风险

1. 官方 DialogContent 源码内部直接用 Radix Portal，未暴露 container；其文档 props 也不含 portalContainer。不能虚构 prop 后接到透明画布。需要一个受测试的平台 Portal adapter，保留 Radix 可访问性和 Arc motion；最小平台补丁单独记录，不把每个控件都 fork。
2. Card 的 details 会打开类似 Portal，首批不启用以免重现原生居中问题。普通 media/action 组合即可；大库避免为每个静态卡片准备复杂 morph。
3. Arc copy 使用 navigator.clipboard.writeText，无 Tauri clipboard 注入回调；现有环境先实测。复制内容不要在每次 render 为几百卡都重建，缓存每项摘要或在行为 adapter 按需生成。
4. 当前 framer-motion 14；Arc 是 motion/react。迁移前核查版本与依赖树，统一入口与 MotionConfig，不同时让两套 LayoutGroup/CSS 修改 transform。当前已有 Phosphor；采用 Arc 控件后 UI 图标统一 Lucide，品牌专有 SVG 例外。
5. Arc 使用 CSS modules + CSS vars。现有 Tailwind v4 保留布局工具，foundation 必须只引一次；暂不执行会覆盖配置的 shadcn init。
6. 默认 Dialog 的 7px backdrop blur、Card media zoom、逐字 Copy 反馈、observer-heavy chip/expanding toolbar 不自动等于快。真实 Windows WebView 上测再决定，减少装饰而不是全部关闭反馈。
7. fixed-canvas region 只允许当前面板接收输入。Popover/tooltip 超出面板、body Portal、菜单碰撞定位和 background inert 都需要平台测试。
8. 扩展目前不是 React。第一轮共享 token/文案/品牌与 HTML 交互规范；真的需要同一组件代码再评估构建迁移，不平白引入第三套应用。

## 许可和开源

免费组件的官方许可为 MIT，须随相关源码保留版权和许可。Arc Pro 使用不同许可；当前页面允许特定 open-source end product 条件，但要求保留 Pro 标记并排除项目总开源许可覆盖，因此不等同于全仓 MIT。官方 license 当前标为 draft/pending review，正式引入时再次核查，不凭本报告作法律保证。

StashDock 第一轮仅采用免费项，让贡献者无需账号或付费即可构建。MCP 登录只是开发便利，不能成为应用构建或运行依赖。依据：[Arc license](https://uiarc.dev/license)。

## 落地顺序

1. 在隔离样板页接 foundation、字体、motion，确认六类控件和 neutral/light。记录 baseline 与 compact 的差异，再决定 token，而不是直接改全部屏幕。
2. 统一 Button / Copy / Search / Segmented / Checkbox / Tooltip，迁移 Quick Dock 和主面板的同类动作。
3. 导入表单接 Tabs/Input/Textarea；先通过原生 Portal 和焦点测试才替换 FluidDialog。
4. 改 Card/list、选择工具条、空态与错误状态；保持真实数据、复制、外部拖拽和滚动行为。
5. 扩展共享语言/品牌/token；校验 narrow/large surface、长标题、键盘、reduced-motion、DPI、数据量与滚动性能。

完整基础规范见 [ui-design-language.md](ui-design-language.md)。本轮是设计评估与开发工具接入，不宣称 UI 已完成上述迁移或新组件已通过桌面测试。

## 本轮复核

- [x] 按实际工作选择免费组件，核对 API、键盘、动效和性能说明。
- [x] 官方 skill 的 13 个文件与 registry 逐个比对，内容无差异；附 MIT notice。
- [x] 按用户选择撤回未授权 MCP，确认配置中不再存在 arc。
- [x] 仅新增设计/评估文档与开发 skill；没有修改应用 UI 源码、package.json 或安装应用组件依赖。
- [x] TypeScript/Vite 构建通过；当前无独立 lint 脚本。
- [ ] 新设计的实际颜色对比、各宽度/主题、原生 Portal、外部拖拽、键盘和 reduced-motion：本轮未实施 UI，不能宣称通过，作为下一轮必做验收。
