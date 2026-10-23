# 给 Mac 上 GPT 的交接提示词

将下面整段发送给能够访问本机仓库和终端工具的 GPT/Codex。源码从 GitHub 拉取，轻量交接包只补充规范和精确提交号；无需继承 Windows 聊天历史。先按 `MAC_START_HERE.zh-CN.md` 建立迁移分支。

---

你现在接手 StashDock 的 macOS Apple Silicon 迁移。源码仓库是 https://github.com/GaryYang12345/StashDock 。从交接包 `BASELINE.json` 的 sourceCommit 创建 `feat/macos-arm64` 分支；未收到交接包时从当前 `main` 创建并记录提交号（已发布的 v0.2.5 早于文件夹快速搜索和空间交接，不能作为完整基线）。请在这台 Mac 上直接完成适配、构建、运行、修复和验证。先检查实际环境，再按依赖顺序推进；不要停留在方案或仅仅让项目编译成功。

先阅读项目根目录 `AGENTS.md`、`design.md`、`docs/product-principles.md`、`docs/architecture.md`、`docs/product-surfaces.md`、`docs/WINDOW_LIFECYCLE.md` 和 `docs/MAC_MIGRATION_HANDOFF.zh-CN.md`。做界面相关工作前，阅读 `.agents/skills/arc/SKILL.md` 及其指定的参考文档和 `docs/ui-design-language.md`；如果宿主没有自动发现 Skill，直接从该路径读取。StashDock 的使用 Skill 位于 `plugins/stashdock/skills/use-stashdock/SKILL.md`。项目明确规范优先于通用设计建议。`docs/history/` 是历史记录，不是现行规则。

产品是 AI-native 的本地 context 资产库：网页、链接、原始文件、Note TXT、prompt、规则、项目资料和可复用成果都可以保存，用于不同 AI 对话。共享 React/Tauri 前端、原生桌面入口、ChatGPT MCP App、Chrome/Edge/Firefox Save-page 扩展已经在 Windows 实现；Claude、Safari 仍是计划，不得因迁移顺手开发或宣称已支持。

迁移目标：在 Mac 上交付可安装、可独立运行的 ARM64 Desktop；同一份源码保留 Windows 支持，macOS 专属实现放在平台适配层。不要复制第二套界面、数据库或业务逻辑。一个 macOS 用户的 Desktop/MCP/浏览器保存入口必须使用同一个权威本地收藏库，缺失已登记数据时明确报错，不能静默创建新库。这里的共享是同一台机器上的共享，不要求跨 Windows/Mac 同步。

请先完成：

1. 只读检查 macOS、架构、磁盘、Node/npm、Rust/Cargo、Xcode Command Line Tools。安装开发依赖和下载公开构建资源在本任务范围内；如遇管理员密码、Apple 登录或系统权限，由我手动完成，不能绕过。优先使用 ARM64 Node 24 和稳定 Rust，保留 npm/Cargo 锁文件。完整 Xcode、Homebrew、付费开发者账号不是开始工作的前置条件。
2. 核对 Git 当前提交，在迁移分支上建立清楚的变更记录。保持同一仓库和共享模块，不另建复制仓库、不覆盖 Windows 发布标签、不直接推 main；验收后通过 PR 合入。
3. 修正构建链路：目前 `npm run build` 的 `prebuild` 会调用 Windows PowerShell 品牌脚本，`desktop:*` 是 MSVC 包装；Tauri 配置只有 NSIS 和 win32-x64 资源。增加清晰的 Mac 构建/检查入口及平台配置，保持 Windows 入口可用。`src-tauri/pdf-runtime` 不在 Git 中，Cargo 编译前通过 `node scripts/sync-pdf-assets.mjs` 从已安装依赖生成。生成 `.icns` 时沿用同一品牌，不重画图标。
4. 在 Mac 本机构建、启动并解决真实平台问题：两个独立窗口（不透明可调整的面板 + 透明置顶的小文件夹）、文件夹快速搜索窗口、窗口生命周期、菜单栏/托盘、快捷键、单实例、系统打开文件、应用检测、数据目录、资源路径、WebKit 差异等。
5. 实现文件夹与面板的空间交接：面板从文件夹长出（约 340ms）、缩回文件夹（约 230ms，面板在缩到最小前淡出），保持比例，真实窗口与动画副本不同时出现，系统减少动态效果时直接切换。用 macOS 原生能力实现；系统自己绘制窗口阴影，不要照搬 Windows 的 DWM 缩略图与预渲染阴影方案，也不要用逐帧移动真实窗口代替。
6. 实现文件夹快速搜索的 Mac 适配：非激活浮动窗口（点击输入框前不抢焦点，关闭后交还焦点）、只在可见搜索框和卡片上接收点击、对齐文件夹视觉中轴且不移动文件夹、只在文件夹可见时存在。共享前端 `FolderSearch` 不重写。
7. 重点实现真实原始文件的 Copy for AI 和拖拽交付。当前 Windows 使用 Shell/OLE，Mac 尚未支持。请用 macOS 公开原生能力适配并复用 `reference_transfer.rs` 的不可变文件组。每次交付是 Markdown context + 原始文件组，Note 也是普通 TXT；保持原字节、最新外部编辑、同名消歧和总大小边界。不能把文件路径、文本、资源 URI 当成真实文件附件，也不能在未实际验证时宣称目标 AI 收到了文件。
8. 适配 Mac ARM64 截图/封面辅助程序及独立运行时。当前 Windows 使用隔离的系统 Evergreen WebView2，旧 Chromium 路线已删除；Mac 采用合适的系统原生实现，不把 Windows EXE/WebView2 搬到 Mac，不要求用户另装 Chrome。MCP 打包入口当前只支持 win32-x64，需准备校验固定版本的官方 darwin-arm64 Node、完整许可证和本机 helpers，保留受控并发及自有资源清理。
9. Desktop 基础可用后，验证 Mac 的 ChatGPT MCP package 和三浏览器扩展对本地 provider 的连接。复用同一 MCP 工具与 Skill；AI 保存 note/link 和经批准的标签整理已经实现，不要退回旧能力。宿主没有安装或不提供能力时如实记录限制，不要伪造 Detected、已附加、已保存等成功状态。

必须保留的已确认体验：

- Arc 设计体系及共享组件，仅图标按钮为正圆，统一黑底白字 tooltip，中英双语与系统/浅色/深色主题；不要在迁移时重新设计卡片、窗口内容、导入表单或图标。
- 文件夹构图为 144px（原 160px 的 90%），没有黑色提示框；只有文件夹及其搜索置顶，面板为正常窗口层级。
- Desktop 的 Floating window 默认开启；关闭时恢复普通最小化、Close 退出，托盘/菜单栏、快捷键、单实例激活都必须遵守此设置，不复活文件夹。
- 展开靠近屏幕边缘时可夹紧面板，但未移动面板就缩回原文件夹位置；移动过面板则按面板中心收回。选择、搜索、滚动不因切换丢失，面板内容不重新挂载。
- Copy/Add 采用黑色 → 临时绿色成功 → 黑色反馈，不保留灰色“已添加”，允许主动重复添加。
- 浏览器扩展只做原生侧栏 Save current page，切换当前页面自动刷新，Save 后保持打开，不增加收藏库或设置页。Chrome/Edge/Firefox 保持一个共享实现，仅原生侧栏 API/manifest 不同。
- 一个文件收藏指向用户原文件并在库内保留备份；Open 打开原文件，原文件不在时用备份；外部修改在再次打开或交付时可见。不给 Note 做内部编辑器，不以解析文件取代向 AI 交付原件。
- 所有改库测试使用临时合成库，不给真实收藏库填演示数据。不要运行携带 Windows 真实数据路径或安装缓存路径的旧部署/迁移脚本；先检查脚本实际副作用。
- Desktop 与 AI 宿主生命周期独立：退出 ChatGPT/MCP/终端不能连带退出 Desktop。长期打开侧栏、重复切换、失败恢复都要验证。

验收包括：类型检查、共享测试、Rust 测试、真实 production `.app` 在开发服务器停止时启动、至少 10 次文件夹/面板往返（含快速反向和逐帧检查无重影）、窗口移动后收回、Floating window 开关、文件夹搜索的悬停/复制/拖拽/打开/焦点交还、中英文与明暗主题、窄窗口、导入/编辑/打开、原始文件复制/拖拽、截图封面、存储位置移动、多入口一致、MCP 查找/保存/经批准标签整理及浏览器 Save 链路。Windows-only 测试请正确限定平台并保留其 Windows 回归，不为通过测试直接删除。静态检查或模拟成功不能代替目标宿主实测。

开发阶段先做可本机验证的 `.app`，再生成 `.dmg`。公开分发签名/公证在需要时说明并等我提供开发者身份；不要禁用 Gatekeeper/SIP，不要索取或嵌入私钥、账号密码和长期令牌。

最终交付：可运行应用及明确输出路径、源码变更、可复现命令、验收记录、真实尚未解决的问题和可回滚基线。保持源码与产物一致。对 Windows 没有在此机器实测的部分如实说明，以便我带回 Windows 做回归。开始执行。
