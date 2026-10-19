# StashDock Mac mini M4 迁移交接

当前基线为 GitHub 的 Windows 首发 `v0.2.5`。轻量交接包的 `BASELINE.json`
记录精确 source commit。Windows Desktop 0.2.5、ChatGPT local plugin 0.4.27、
浏览器扩展 0.4.13 共用这一份源码；Mac 尚未构建或验证。

## 阅读顺序

1. `AGENTS.md`、`design.md`。
2. `docs/product-principles.md`、`docs/architecture.md`、`docs/product-surfaces.md`。
3. `docs/windows-runtime-release.md` 和本文件。
4. 界面改动前读 `.agents/skills/arc/SKILL.md` 及其要求的参考文件。
5. 产品 Skill：`plugins/stashdock/skills/use-stashdock/SKILL.md`。

规范、Arc Skill 及原许可证均已纳入源码。不需要 Windows 个人配置、凭证、
Computer Use Skill、聊天历史或原始收藏库。

## 当前实现及迁移边界

共享 React 19 / TypeScript / Arc / Motion UI；Tauri 2 + Rust 原生层；SQLite
权威库；Node MCP stdio 服务；Chrome/Edge/Firefox 共享 Save-page 扩展。
一个用户、同一机器的入口共享一个权威库，不做 Windows/Mac 云同步。

| 部位 | 当前 Windows 实现 | Mac 需要完成 |
| --- | --- | --- |
| 构建 | PowerShell 品牌脚本、MSVC 包装、NSIS | 平台化命令及 ARM64 app/dmg，保留 Windows 命令 |
| PDF 输入 | `scripts/sync-pdf-assets.mjs` 生成 Cargo 嵌入资源 | npm ci 后、Cargo 前生成，不能删掉功能 |
| 原始文件剪贴板 | Shell 文件组和 Markdown sidecar | 使用公开 macOS 文件 URL/剪贴板机制，交付实际原件 |
| 原始文件拖拽 | `reference_drag_windows.rs` / OLE | 复用 `reference_transfer.rs`，实现原生 Mac adapter |
| 公共网页截图 | `preview_webview.rs` / 系统 Evergreen WebView2 | 独立的系统 WebKit 等合适原生适配；不是下载旧 Chromium |
| 插件运行时 | 固定版本官方 Node，Windows native helpers | 校验固定 darwin-arm64 Node、完整许可证、本机构建 helpers |
| 窗口/托盘 | `desktop_windows.rs` / `folder_window.rs` / `window_frame.rs` | 窗口、菜单栏、阴影、快捷键、DPI/monitor、失败恢复实测 |
| 生命周期 | `independent_startup.rs` Windows shell/job | Mac 原生生命周期独立，退出 AI 宿主不能带走 Desktop |
| 数据与检测 | 权威 anchor + SQLite；部分 Windows 安装证据 | 同一用户共享路径、移动后重读、真实启用证据，不用历史握手代替 |

现已删除旧 Chromium 准备路线。不要寻找 `preview-runtime-lock.json` 或
`prepare-preview-runtime.ps1`，也不要将 Windows EXE 或 WebView2 搬到 Mac。
截图不读取正常浏览器 profile，安全边界仍须保留：只访问公开网络、限制大小/
并发/期限、拒绝下载和弹窗、清理自有资源，不启动或杀掉用户日常浏览器。

独立 AI plugin 必须含本系统完整 Node/helpers，不能要求用户另装开发工具，
不能把 source checkout 冒充可安装插件。原始文件交付与 MCP 文本上下文是两条
明确能力边界，路径不等于上传、resolve 不等于 AI 已经读过。

## 最新已确认的 Windows 行为

- 文件夹为 144px，即原 160px 构图的 90%；没有提示黑框或已退休的 tooltip spacer。
- Desktop 的 Floating window 默认 On。Off 时正常任务栏最小化，Close 退出，
  托盘/快捷键/单实例不得重新叫出文件夹。
- 面板/文件夹采用直接原生显隐，不引入新动效、截图、定时握手；只有文件夹置顶。
- 边缘展开不改变返回锚点；实际移动面板后才按面板中心收回。保持搜索、选择和滚动。
- 窄面板为紧凑三行 header，不把完整左导航堆在卡片上方。Content/Preview 是共享分段控件。
- Note 是普通 managed TXT；Open/外部编辑/复制/拖拽使用同一权威原件路径。
- AI 可检索、读取、显式保存 note/link，并在准确请求或批准计划后按 revision 整理标签。
  其他管理留在可视化面板，不能因为迁移退回旧工具能力。
- 扩展只做 Save 当前页，始终打开的侧栏自动换页和恢复；不新增设置/收藏库页。

Windows 上次阶段验收为前端 349 项通过、原生 150 项通过 / 1 项系统剪贴板测试
按设计忽略。新发布配置修改后的结果见 Release 说明。历史报告只证明当时基线，
不是 Mac 验收；Windows 机器也没有完成全新系统/所有 DPI 组合验收。

## 环境、分支和验收

使用 ARM64 Node 24、稳定 Rust 和 Xcode Command Line Tools，保留 npm/Cargo 锁文件。
先审查平台脚本，再 npm ci、生成 UI/品牌/PDF 输入、适配本地构建与 helpers。
Mac migration 分支从指定 source commit 建立，不重写发布标签，不推送用户收藏。

变更先限定平台边界，再跑共享和本地测试。实际 production app 必须在开发服务器
停止时启动；测试明暗/中英/窄屏、10 次窗口切换、移动/锚点、最小化开关、导入/
编辑/Open、原始文件复制/拖拽、截图、存储移动、多个入口、MCP 及浏览器 Save。
所有修改数据的验收使用临时库；不要直接运行带 Windows 真实数据路径的历史维护脚本。

先交付可本机运行 `.app`，再做 `.dmg`。签名/公证需要身份时请用户手动提供，
不要禁用 Gatekeeper/SIP 或提交私钥。用 PR 交回源码、产物路径、可复现命令、
真实验收结果和未完成项。Windows 行为须在 Windows 再做回归。
