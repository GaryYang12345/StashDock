# StashDock Mac 迁移交接

产品只发布了 Windows x64。Windows Desktop、ChatGPT local plugin 和浏览器扩展共用这一份
源码，各自的版本见 `package.json`、`plugins/stashdock/.codex-plugin/plugin.json` 和
`extension/manifest.json`。轻量交接包的 `BASELINE.json` 记录精确 source commit。
Mac 尚未在 main 上构建或验证。已有 Mac 分支的同步方法、自旧基线以来的变化和 Apple 建议做法见
[MAC_SYNC](MAC_SYNC.zh-CN.md)。

**一致与原生的边界：** 样式、文案、交互、动画的视觉意图、数据库、SQL、搜索、MCP 工具和 AI 上下文
两边必须一致；窗口机制、动画实现、拖拽/剪贴板、网页渲染、代理、开机启动、菜单栏、Dock、打包签名
按 macOS 公开 API 和用户习惯来做，不要硬套 Windows 的做法。`AGENTS.md` 中描述 Windows 实现细节的
规则，对 Mac 约束的是用户看到的结果。

## 阅读顺序

1. `AGENTS.md`、`design.md`。
2. `docs/product-principles.md`、`docs/architecture.md`、`docs/product-surfaces.md`、
   `docs/WINDOW_LIFECYCLE.md`。
3. `docs/windows-runtime-release.md` 和本文件。
4. 界面改动前读 `.agents/skills/arc/SKILL.md` 及其要求的参考文件，以及
   `docs/ui-design-language.md`。
5. 产品 Skill：`plugins/stashdock/skills/use-stashdock/SKILL.md`。

`docs/history/` 是带日期的设计/验收记录，只说明当时的基线，不是现行规则或 Mac 验收。

图标：`assets/app-icon/README.md` 包含方形图标和 Icon Composer 分层说明。SVG 前景保持
原始品牌几何，不含圆角遮罩、高光或阴影。`app-icon.icns` 只是静态兼容图标；在 Mac 创建、
编译并实际接入 `.icon` 后才能声称支持原生 Liquid Glass。

## 需要在 Mac 上重现的产品

共享 React 19 / TypeScript / Arc / Motion UI；Tauri 2 + Rust 原生层；SQLite 权威库；
Node MCP stdio 服务；Chrome/Edge/Firefox 共享 Save-page 扩展。同一用户、同一台机器上的
入口共享一个权威库，不做 Windows/Mac 云同步。

- **面板**：不透明、可调整大小的收藏库窗口，系统边框与阴影，正常 Z 序；窄窗口三行紧凑头部。
- **悬浮文件夹**：144px（160px 构图的 90%）透明、置顶、不进 Dock/任务栏切换列表的小窗口；
  单击打开面板，拖动移动，× 隐藏。只有文件夹（及其搜索）置顶。
- **Floating window** 默认开启；关闭时恢复普通最小化、Close 退出，托盘/菜单栏、快捷键、
  单实例激活都不能再叫出文件夹。
- **文件夹快速搜索**：悬停 180ms 后搜索框从文件夹浮出，输入后结果以 cover flow 显示；
  滚轮/上下键切换，只有 Copy 复制，当前卡片可原生拖出，单击以同一搜索打开收藏库。
  不抢焦点，透明区域不接收点击，始终对齐文件夹视觉中轴且不移动文件夹。
- **文件夹/面板空间交接**：面板从文件夹长出（340ms）、缩回文件夹（230ms），保持比例，
  真实窗口与动画副本不重影；系统减少动态效果时直接切换。
- **窗口形态**：Panel / Folder / Minimized / Hidden 由一个原生生命周期权威决定，按钮、
  快捷键、菜单栏和系统最小化/还原都走同一策略；选择、搜索、滚动在切换中保持。
- 共享界面、卡片、导入、编辑、Settings、中英双语与三种外观在 Mac 上不重新设计。

## Windows 专属实现与 Mac 对应工作

| 部位 | 当前 Windows 实现 | Mac 需要完成 |
| --- | --- | --- |
| 构建 | `prebuild` 调用 PowerShell 品牌脚本，`desktop:*` 为 MSVC 包装，Tauri 只配置 NSIS | 平台化命令及 ARM64 `.app`/`.dmg`，保留 Windows 命令 |
| PDF 输入 | `scripts/sync-pdf-assets.mjs` 生成 Cargo 嵌入资源 | `npm ci` 后、Cargo 前生成，不删除功能 |
| 窗口生命周期 | `desktop_windows.rs`、`window_frame.rs`（DWM cloak、过渡抑制） | 用 macOS 公开 API 实现同一策略，验证多显示器/缩放和失败恢复 |
| 空间交接 | `window_morph.rs`：DWM 缩略图覆盖层 + 预渲染面板阴影；非 Windows 直接切换 | 用 macOS 原生能力实现同样的视觉行为；系统自己绘制窗口阴影，不需要模仿预渲染阴影或 DWM 方案 |
| 文件夹搜索窗口 | `folder_search.rs`：不激活窗口样式、原生 region、前台窗口焦点交还 | 非激活浮动窗口、只在可见内容上接收点击、焦点交还 |
| 文件夹拖动 | `folder_window.rs` 系统拖动循环 | 原生窗口拖动 |
| 原始文件剪贴板/拖拽 | `reference_clipboard.rs`、`reference_drag_windows.rs`（Shell/OLE） | 复用 `reference_transfer.rs` 的不可变文件组，用公开的文件 URL 剪贴板与拖拽能力交付 |
| 公共网页截图 | `preview_webview.rs` / `stashdock-preview`：隔离的系统 Evergreen WebView2；非 Windows 返回不支持 | 合适的系统原生渲染器（如 WebKit），保持隔离、拒绝下载/弹窗、私网拒绝、有界并发和自有资源清理 |
| 插件运行时 | 校验固定版本的官方 win32-x64 Node 与 Windows helpers；包名 `stashdock-plugin-X.Y.Z-win32-x64.zip` | 校验固定的官方 darwin-arm64 Node、完整许可证、本机构建 helpers；包名 `stashdock-plugin-X.Y.Z-darwin-arm64.zip`（插件检查更新按平台-架构找包） |
| 独立生命周期 | `independent_startup.rs`（Windows shell / Job Object） | 退出 AI 宿主、终端或启动器不能带走 Desktop |
| 检测与打开 | 部分安装证据和应用启动为 Windows 路径 | 读取真实启用证据，不用历史握手或缓存代替 |

数据目录解析器已包含 macOS 约定（`~/Library/Application Support/app.stashdock.desktop`），
但未经实测。旧 Chromium/Chrome Headless Shell 准备路线已删除，不要寻找对应锁文件或脚本，
也不要把 Windows EXE 或 WebView2 搬到 Mac。截图不读取正常浏览器 profile，不启动或结束
用户日常浏览器。

独立 AI plugin 必须自带完整 Node/helpers，不能要求用户另装开发工具，也不能把源码 checkout
当作可安装插件。原始文件交付与 MCP 文本上下文是两条能力边界：路径不等于上传，resolve 不等于
AI 已读取。

## 已退休，不要恢复

单窗口固定透明画布、小面板/Quick Dock、浏览器内收藏库（browser shelf）、插件到 Desktop 的
HTTP 适配器、浏览器拖拽 broker、平台登录连接器。

## 环境、分支和验收

使用 ARM64 Node 24、稳定 Rust 和 Xcode Command Line Tools，保留 npm/Cargo 锁文件。先审查
平台脚本的实际副作用，再 `npm ci`、生成 UI/品牌/PDF 输入、适配本地构建与 helpers。迁移分支
从指定 source commit 建立，不重写发布标签，不推送用户收藏。

变更先限定平台边界，再跑共享测试和 Rust 测试；Windows-only 测试正确限定平台并保留，不为
通过而删除。production `.app` 必须在开发服务器停止时启动。验收明暗/中英/窄窗口、至少 10 次
文件夹/面板往返（含快速反向）、移动后收回、Floating window 开关、文件夹搜索（悬停、复制、
拖拽、打开、焦点交还）、导入/编辑/Open、原始文件复制/拖拽、截图封面、存储位置移动、多个入口
一致、MCP 查找/保存/经批准的标签整理及浏览器 Save。所有修改数据的验收使用临时库；不要直接运行
带 Windows 真实数据路径的历史维护脚本。

先交付可本机运行的 `.app`，再做 `.dmg`。签名/公证需要身份时由用户手动提供，不要禁用
Gatekeeper/SIP 或提交私钥。用 PR 交回源码、产物路径、可复现命令、真实验收结果和未完成项。
Windows 行为须回到 Windows 再做回归。
