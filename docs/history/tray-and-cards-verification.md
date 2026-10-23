# 托盘生命周期和 Arc 业务视图

2026-10-08。仅免费 Arc skill/源码；没有 MCP 登录或 Pro。保留文件夹 SVG、品牌 PNG、原生窗口动画/移动引擎、SQLite 和浏览器/MCP 协议。

历史记录：下面的 minimize/保留任务栏行为已被同日后续需求取代。当前规范是 hide 隐藏窗口和任务栏按钮、保留托盘，见 [关闭与品牌回归](./close-and-brand-verification.md)。下文测试描述保留为上一版实测记录，不代表当前关闭语义。

## 关闭与退出

- 文件夹前页右上角增加圆形 ×。它是独立的按钮，不嵌在拖拽/打开按钮中。
- 文件夹、Dock、Library 的 × 共用 `hide_stashdock`；OS CloseRequested 也 prevent_close 后 minimize。用户补充要求底部任务栏保留按钮，因此从 hide 改成系统 minimize，名称仅表示关闭显示。窗口状态不卸载，后台 bridge 不关。
- 托盘从用户 icon.png 读取品牌图标。左键/“打开 StashDock”恢复当前形态；只有“退出 StashDock”调用 app.exit。
- 收起后 Ctrl+Shift+Space 只恢复，不触发形态切换。可见且未最小化时沿用原来的 folder/Dock 切换。
- 用户明确要求同时有底部任务栏和右下角托盘。skipTaskbar=false，主窗口也使用品牌 icon.png；真正退出在托盘菜单。
- 官方 single-instance 插件在其他插件之前注册，再次启动只恢复既有窗口。初次启动依然在原生形状准备好后 show，不恢复之前“隐藏”的状态。
- 圆形 × 的共享键盘焦点 token 改为 1px、border-strong、-6px 内偏移，保留细小键盘提示而非外部黑色大圈；没有 fork Arc foundation。

## Arc review

- [x] Find/install/wire：沿用已通过官方 CLI 安装的免费 Card/Button，核对官方 markdown；官方组件源码未 fork，没有猜测 props 或复刻 Pro 侧栏。
- [x] 颜色与字体：新业务 CSS 使用 semantic tokens、Inter 和 400/500；没有 raw hex、任意字号、uppercase、eyebrow 或 em dash。
- [x] 表面：业务卡片不加旧的多层阴影。官方 Card hover 的轻抬升/阴影原样保留；布局 CSS 不重写其内部样式。
- [x] 侧栏：实际数据/计数，pressed 状态，数字稳定槽位与 tabular-nums；移除无功能 Settings 和 ornamental subtitle。
- [x] 动作：选择、收藏、打开、删除、复制均有独立命名，键盘/指针可见；无 hover-only 入口。复制沿用 controller 并在按钮/role=status 确认。
- [x] 媒体：真实截图保留；未截图条目只展示类型，不把假预览冒充已抓取内容。
- [x] 布局：单页 gutter、min-width:0、等高网格边界、可换行列表；长标题原样且允许断行，截断的来源/标签保留完整 title。
- [x] 动效：官方 Motion tokens 和 reduced motion；删除旧卡片逐项入场、重复布局/hover 动效；旧全局拖拽 transition 不再覆盖 Arc 根节点。
- [x] 首屏：新增业务渲染没有 window/localStorage/random，日期固定 en/UTC；稳定 item key，不改变读写和结构化 payload。
- [x] 状态：有复制成功、类型 fallback、真实空态/错误和保留已有加载流程。
- [ ] 初次 loading 尚是预留状态区域，不是 Arc Skeleton；EmptyState/Alert 和后台反馈仍沿用原有业务组件，下一轮统一。
- [x] 可访问性：Button、article、nav、region、h1/h2/h3，keyboard pressed 状态和角色反馈；不加自制 focus ring。
- [ ] 原生 modal 仍为既有 FluidDialog，未完成 Arc Portal adapter。导入表单/选择条/小 Dock 条目/扩展需后续统一。
- [x] 浏览器 320/390/768/1024/1440 网格与 390/768/1024/1440 列表无横向页面溢出和卡片操作越界。
- [x] 新区域 light/neutral 和 dark/blue、reduced-motion 截图检查；暗色品牌使用同一 PNG 反相，不开启全产品 darkmode。
- [ ] Windows pointer/keyboard 为目标；32px 文件夹 close/36px compact controls 不宣称全触摸目标 44px。500+ 记录、全产品对比度、跨 DPI/多屏仍待专门验证。

## 自动测试

- `npm run test:frontend`：56 passed。
- `npm run desktop:test`：19 passed。
- `npm run build`、`npm run desktop:check`：passed；无独立 lint 配置。
- `scripts/verify-arc-cards.js`：隔离浏览器 seed，仅本地测试数据；键盘选择、Copied、两条 Markdown 拖拽负载与所列宽度 passed。真实收藏未增删。
- 缺失 MSVC PDB 的 LNK4099 为既有链接警告，不是构建错误。
- Cargo 下载临时禁用了进程级证书撤销检查以处理本机 CRYPT_E_REVOCATION_OFFLINE；TLS 证书验证仍开启，没有持久修改系统或 Cargo 配置。

## 原生回归

- 新 release 通过普通启动（非 Hidden）立即显示文件夹；在任何自动激活之前，进程主窗口标题为 StashDock，并已从原生截图确认文件夹可见。
- 键盘 Tab 到文件夹 ×：轻量内偏移焦点已检查，没有截图中的外部黑色大圈。Return 后原生工具明确报告窗口 minimized；进程 PID 3620 保持不变，收藏接口仍返回 27 项，没有修改用户收藏。
- 收起状态下再次启动同一路径：仍为 PID 3620，同一窗口句柄恢复文件夹，没有第二个进程。
- 系统 Alt+F4 也明确得到 minimized，随后再次启动恢复原进程。根目录程序已更新并留在可见的文件夹状态。
- `skipTaskbar=false` 和品牌窗口图标已编译启用，收起使用系统 minimize 而非 hide；底部任务栏按钮的指针点击、托盘右键“退出”尚未实机自动点击验证，不把代码检查冒充这些实机结果。
- `scripts/verify-window-controls.js` 浏览器隔离 mock 回归通过：7 次大小切换、36 个窗口按钮/边界检查、3 次共用关闭调用、不触发拖拽。mock 不证明托盘行为。
- 保留旧程序 `artifacts/stashdock-before-tray-cards.exe`；新安装包 `artifacts/StashDock_0.2.1_taskbar-fixes_x64-setup.exe`。根目录 `stashdock.exe` SHA256：`FAD28865FCCD04087DE30DDEFE433B832BAAFBE97FA611D20F6E834DB7980F98`。

## 剩余统一顺序

1. 小 Dock 条目与多选 ContextBar。
2. 导入表单、EmptyState/Skeleton/Alert/删除确认。
3. 扩展共享 token/文案/交互。
4. 原生 Portal adapter、触摸/多 DPI、定量对比度/大库滚动性能；不强行把原生窗口形态引擎换成网页 Dialog。
