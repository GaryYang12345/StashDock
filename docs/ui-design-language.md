# StashDock 基础设计语言：Arc baseline

> 注意：文中的“小 Dock / Quick Dock / 小面板”已退役。当前桌面只有大面板和悬浮文件夹（含文件夹快速搜索），以 AGENTS.md 为准；本文其余 Arc 基础规范仍有效。

状态：2026-10-08 第三轮已覆盖应用大面板、小 Dock、Codex 内嵌 Dock、导入表单和浏览器扩展。motion/react、Lucide、本地字体和官方 foundation 为统一基础。扩展保持纯 HTML，以共享 assets 适配，不引入第二套 React 应用。验收范围和明确例外见 [arc-surfaces-verification.md](arc-surfaces-verification.md)。Arc 是控件和语义规范的基础，不是把整个产品变成其演示站。

## 收藏卡片规范（2026-10-09）

- 大面板使用图片优先的收藏业务布局，不再套通用 Arc Card 的元信息/quick-look 排版。底层交互继续使用官方 Arc Button，不修改按钮内部样式。
- 卡片 8px 图片内间距、16:9 预览、26px 外圆角与18px 内圆角。网格最小列宽300px；标题保留两行高度，底部操作行对齐。
- 静止时只显示预览、标题、favicon/域名、访问按钮和黑色 Copy for AI。时间、标签、摘要不显示，但数据和搜索能力保留。
- 图片左上角为勾选，右上角为收藏/删除；细指针悬停或操作区键盘 focus-visible 时显示，鼠标点击残留焦点不使其常驻。已选中的勾选保持可见，触屏始终可见且44px触点。
- 选中卡片仅使用 surface-muted，不改变边框。图片操作为独立浅色圆形 Arc Button（36×36px，触屏44×44px），不合并成深色工具条；收藏成功使用黄色实心星，颜色作用域仅限星形。
- SearchField 仅增加 search-border / search-border-active 两个可选语义 token，保留官方默认回退；StashDock 映射到 border / border-strong，不使用黑色前景细线。此处是按用户指定的最小本地扩展，不增加全局控件样式补丁。
- favicon 优先 origin.faviconUrl（浏览器提供），其次请求原站 /favicon.ico。无第三方代理，无登录抓取；失败用站点首字母。书签 HTML 的 ICON 属于 favicon，不能当作网站大截图。
- 动效仅限操作区淡入、按钮原位反馈和1.5%预览 hover。reduced-motion 去掉缩放。原生窗口引擎、悬浮文件夹材质保持不变。

## 产品原则

用户在一个轻量收藏入口里找到参考、选择、复制或拖入 agent。主界面不是分析 dashboard，不增加 KPI、图表、账号系统或 AI 对话功能来填满页面。

视觉方向：白色中性表面、清晰黑白品牌、克制层级。文件夹是唯一主要拟物品牌元素；普通控件保持 Arc 的安静、清晰和可预测。保留已批准的无文字黑白文件夹和 assets/brand/full.png 标题栏品牌。

所有终端共享语义 token、文案和交互含义。桌面大面板、Quick Dock、Codex 内嵌页面和浏览器扩展可以不同密度，不能各自发明颜色、圆角和成功状态。

## 1. 颜色和表面

沿用 Arc 的语义层：background、surface、surface-raised、surface-muted；foreground、text-secondary、text-muted；border、border-subtle、border-strong；accent、accent-subtle、accent-foreground；success、warning、danger。

- 首版 light + neutral。白底、近黑主要文字、可读灰色次要文字；截图保留真实颜色。
- 主动作与选中态使用中性强调；红色仅表示删除、错误等真实语义。
- 常规卡片以一像素边界和留白分组，不给每张卡片加漂浮阴影。菜单、弹窗、浮动操作条使用浮层阴影。
- 不增加紫蓝渐变、发光、每个图标的小圆形底座。文件夹现有材质是品牌例外，不扩散到搜索框和每张卡片。
- dark 的 token 从开始保留，但不宣称暗色模式已经实现；品牌图像、截图容器、透明窗口仍须单独验收。

依据：[Arc theming](https://uiarc.dev/docs/theming)、[Arc design](https://uiarc.dev/r/skills/arc/design.md)。

## 2. 字体和信息层级

按照 Arc：大标题使用 Geist，正文、控件和小标题使用 Inter，中文 fallback 使用 Windows 系统中文无衬线字体。字体需要真正加载，不能只声明名字后实际全走 Segoe fallback；字体资源与许可一起纳入项目，不依赖运行时联网。

- 基础字号以 Arc scale 为起点：12 / 14 / 16 / 18 / 22 / 28。工具面板优先 14px 正文、12px 元信息。
- 仅常规 400 和中等 500 作为基础。通过间距、字号和对比形成层级，而不是到处 semibold。
- 禁止目前大量 8、9、10、11px 元信息继续成为默认规范。小窗口窄不等于文字要极小。
- 可变数量使用 tabular-nums 和预留宽度，不给每个日期套缩小的等宽字体。
- 移除 Your working memory、Saved context 等装饰性大写眉题；不要修改用户收藏标题、正文中的原文。
- 短文案统一为 Search references、Import references、Copy for AI、Copied、Open website。独立应用和内嵌 Dock 不自动打开 Codex；产品数据标题不翻译。浏览器扩展旧文案另行迁移，不改变捕获协议。

依据：[Arc design](https://uiarc.dev/r/skills/arc/design.md)、[Arc copy](https://uiarc.dev/r/skills/arc/copy.md)。

## 3. 几何和密度

- 4px spacing grid；组内 8 / 12 / 16，区域之间 24，主面板边距 24 / 32。窄面板可以 16px 外边距。
- Arc 默认 control / panel / surface radius 为 18 / 26 / 34px；先在样板页验证，不把 34px 生硬套给 420px 窗口的所有元素。
- 若需要 compact，使用一个明确命名、按 surface 范围生效的 density/token 变体；不是每个按钮写一个任意圆角或压小字号。
- 嵌套圆角遵循 outer radius minus padding；卡片图像、边界、按钮对齐到同一列。
- 普通控件 36px，触屏/主动作可采用 44px；窗口控件保留桌面语义并保证可点区域。
- 图片容器预留固定比例或高度，长标题截断后仍可通过 focus/详情读到完整文本。

依据：[Arc composition](https://uiarc.dev/r/skills/arc/composition.md)。

## 4. 动效

共享 Arc 的 smooth（面板、导航滑块，零 overshoot）、snappy（按压和图标反馈）、morph（内容驱动的宽度变化）语义，常规颜色/透明度采用 fast/standard 时长。官方 spring 默认分别约 0.4s / 0.26s / 0.42s；这是参考，不把原生窗口现有 260ms 流程一键改成 400ms。

- 每次操作一个连贯反馈，可打断且可反向；避免先消失再出现、重复动画或整页反复入场。
- Copy 在按钮原位确认，失败显示实际错误；后台浏览器导入通知可以 Toast，不能拿 Toast 替代所有操作反馈。
- 浏览收藏时不循环漂浮、自动排序、文字滚动、整张截图缩放。只有真实 loading 需要持续状态。
- 外部拖拽 payload 和窗口原生拖动优先，动效不能截获手势或增加等待。
- 同一元素只能一个 transform owner；移除旧 .fluid-ui 全局按压规则后才交给 Arc/Motion。
- 原生面板与悬浮文件夹由 desktop_windows.rs 统一管理，使用独立窗口。Arc 负责窗口内的界面；面板阴影、缩放和窗口边界交给系统，不使用大透明画布与独立阴影层。旧窗口设计记录已由此架构替代。
- reduced-motion 保留完整功能和反馈，移除位移/缩放；不可把无障碍分支仅停留在 CSS 中。

依据：[Arc motion](https://uiarc.dev/r/skills/arc/motion.md)。

## 5. 操作和状态

- 一项动作始终使用同一个控件规范。Import 是进入流程的主动作；多选后复制工具条承接当前任务，不再到处重复主按钮。
- Copy 和打开网站是不同动作；不要标成发送给 Codex，却实际只复制或切换窗口。
- 小/大面板窗口控件同位置、同顺序：收回文件夹、大小切换、关闭显示。整个顶部空白区拖动，交互控件不拖动。文件夹前页右上角圆形 × 与文件夹共用动画层，不嵌套按钮；原生用 hide 隐藏窗口及底部任务栏按钮，托盘保留，只有托盘右键“退出 StashDock”结束进程。启动显示文件夹，再次启动唤醒现有进程。
- 多选使用真实 Checkbox 或等价可访问控件，支持全选 mixed 状态；外部拖拽始终也有复制按钮替代。
- 删除明确只从 StashDock 移除，不修改 Chrome 原书签或原网站。没有持久化恢复逻辑前，不显示假的 Undo。
- 每个区域设计 loading、初始空库、无搜索结果、断连/错误、成功、禁用、长文本状态；静默刷新不把已显示内容替换成骨架。
- 键盘 focus、菜单定位、Escape、Tab 和关闭后的 focus 恢复纳入组件边界；图标按钮有具体 accessible name。hover 不是唯一操作入口。

### 本轮明确的变体

- 当前卡片基线按用户澄清恢复到 quiet-cards 改版之前的 ui-microinteractions 版本，不是最初通用 Arc Card：大面板图片左上选择、右上收藏/删除为独立浅色圆角 Arc Button，hover/focus 显示；下方标题、favicon/网址、访问与黑色 Copy for AI，无日期和标签。小 Dock 恢复同期的纵向圆角选择/黑色复制按钮，hover/focus 显示。大小面板保留最新 controller、favicon、共享选择、异步/重复复制和成功反馈；后续稀疏提示策略保留。Space UI 对比 HTML 未合入应用，不作为实现基线。
- 真实复制成功时用 `--success` 替换按钮作用域的文字角色，主按钮对应填充角色；不改动 Button 内部。同时显示 Check / Copied，不单凭颜色表达。失败清除成功态并显示可操作错误；复制期间选择改变，不给新选择误报成功。
- 小 Dock 只压缩密度（Copy 短标签、隐藏工具条次要说明），不能另存一份选择/搜索/筛选状态。Copy 只在行 hover 或按钮键盘 focus-visible 时显示，鼠标点击的残留 focus 和成功状态不使其常驻；已选中勾选保留。触屏始终可见、44px 命中区。
- 导航使用持久挂载的单一 Motion 滑块组合免费 Arc Button，根据目标行的布局坐标移动。按钮作用域不另画 hover 灰底，避免目标行提前选中；徽标数字保留中性灰底。未复制 Pro Sidebar 代码。减少动态效果时直接切换，并实时订阅 Windows 偏好变化。
- 主内容及 Tags 使用官方免费 ScrollArea，5px 胶囊灰条按滚动/悬停显示；Tags 不再截取前七项。表单等原生滚动区保留 thin 中性回退。不拦截原生滚轮，不对列表每个元素施加 layout 动画。
- 卡片保留拖拽能力，但不显示拖拽图标。只有底部多选工具条显示 GripVertical。小面板选择和复制纵向右对齐；选择为36px圆形，复制为32px高、12px字的紧凑黑色 Copy 图文按钮，成功显示绿色 Check / Copied。仅此紧凑 adapter 作用域映射 Arc 字号、高度和间距 token，触屏仍至少44px。操作列固定预留84px，按钮内部宽度继续使用 Arc spring，不能影响标题列宽或换行。已选勾选常驻，复制成功不覆盖 hover 隐藏规则。大面板和多选条仍使用 Copy for AI。
- 收藏黄色按用户指定映射 `--favorite-star: #E8B931`，只作用于实心星标。Import references 使用官方 Button secondary 灰色描边，不新增按钮体系。
- Codex 嵌入 Dock 在视口宽度≥480px 时采用112×72px横向截图；窄栏和原生小面板保留原密度，不挤压标题或操作。
- CopyForAI 采用 Arc Button 自带的标签宽度 spring，不固定文字按钮宽度。复制立即执行；提交可见 busy 状态后保留一个 fast 反馈节拍，Copied 状态仍可再次复制。卸载会取消反馈计时器。
- 提示只对不熟悉的图标操作明确 opt-in，不因 aria-label 自动生成；标题、网址、标签、已标注按钮及常见关闭/刷新等不重复提示。样式按用户参考为 #0D0D0D、白字、8px圆角，鼠标停留700ms显示；此颜色和圆角为明确产品例外。TooltipLayer 与 HTML 扩展共用委托 adapter 和 Arc motion tokens，保留键盘描述、Escape 和清理。文件夹用 Click to open / Drag to move，放在对象外侧；现有 native region owner 只临时开放小范围提示区域，释放时恢复当前形态，绝不恢复旧文件夹坐标。无空间时不覆盖对象。托盘菜单、Chrome 工具栏等系统 UI 不做网页样式覆盖。详见 quiet-cards-and-hints-verification.md。

## 6. 组件和代码边界

下一阶段拟采用三层：Arc 官方 primitives（局部 CSS modules + foundation）→ StashDock 行为 adapters → 业务视图。保留已整理的 library store、controller、selectors、SQL 和 MCP/浏览器协议。

自定义窗口、收藏列表项、拖拽选择和品牌不是要求 Arc Pro 的理由。没有合适现成项时用免费 primitives 组成 StashDock 专有布局，不能照着 Pro 预览复刻代码。

工程重点：Motion 单一运行时入口；UI 图标统一 Arc 的 Lucide 尺寸/线宽，品牌 logo 独立；局部 CSS 不被旧全局 transition 污染；overlay Portal 在当前可见面板内，不能定位到透明固定画布中心。

Arc 的 CSS modules 与现有 Tailwind v4 可共存。迁移期 Tailwind 用于尚未迁移布局；Arc 表面不继续混写 zinc 颜色和任意字号。不要把组件库接入变成再一次数据层重构。

## 验收与扩展

先做 Button、Copy、Search、选项切换、Card、Dialog 六类样板，确认统一质感后扩展。桌面和内嵌验证窄/宽面板、100% / 150% DPI、长中英文标题、无截图、500+ 合成记录、键盘及 reduced-motion。

暗色与其他强调色属于后续变体验证，不在没有测试时自动对用户上线。组件看起来更 fluid 不代表性能更好，要继续记录 bundle size、滚动与拖动帧时间。

详细映射和接入风险见 [Arc adoption plan](arc-adoption-plan.md)。
