# 给 Mac 上 GPT 的交接提示词

将下面整段发送给能够访问本机仓库和终端工具的 GPT/Codex。源码从 GitHub 拉取，轻量交接包只补充规范和精确提交号；无需继承 Windows 聊天历史。先按 `MAC_START_HERE.zh-CN.md` 建立迁移分支。

---

你现在接手 StashDock 的 macOS Apple Silicon 迁移。源码仓库是 https://github.com/GaryYang12345/StashDock 。从交接包 `BASELINE.json` 的 sourceCommit（未收到包则用 v0.2.5）创建 `feat/macos-arm64` 分支。请在这台 Mac mini M4 上直接完成适配、构建、运行、修复和验证。先检查实际环境，再按依赖顺序推进；不要停留在方案或仅仅让项目编译成功。

先阅读项目根目录 `AGENTS.md`、`design.md`、`docs/product-principles.md`、`docs/architecture.md` 和 `docs/MAC_MIGRATION_HANDOFF.zh-CN.md`。做界面相关工作前，阅读 `.agents/skills/arc/SKILL.md` 及其指定的相关参考文档；如果宿主没有自动发现 Skill，直接从该路径读取即可。StashDock 的使用 Skill 位于 `plugins/stashdock/skills/use-stashdock/SKILL.md`。项目明确规范优先于通用设计建议。

产品是 AI-native 的本地 context 资产库：网页、链接、原始文件、Note TXT、prompt、规则、项目资料和可复用成果都可以保存，用于不同 AI 对话。共享 React/Tauri 前端、原生桌面入口、ChatGPT MCP App、Chrome/Edge/Firefox Save-page 扩展已经在 Windows 跑通；Claude、Safari 仍是计划，不得因迁移顺手开发或宣称已支持。

迁移目标：在 Mac 上交付可安装、可独立运行的 ARM64 Desktop；同一份源码保留 Windows 支持，macOS 专属实现放在适当的平台适配层。不要复制第二套界面、数据库或业务逻辑。一个 macOS 用户的 Desktop/MCP/浏览器保存入口必须使用同一个权威本地收藏库，缺失已登记数据时明确报错，不能静默创建新库。这里的共享是同一台机器上的共享，不要求跨 Windows/Mac 云同步。

请先完成：

1. 只读检查 macOS、架构、磁盘、Node/npm、Rust/Cargo、Xcode Command Line Tools。安装开发依赖和下载公开构建资源在本任务范围内；如遇管理员密码、Apple 登录或系统权限，由我手动完成，不能绕过。优先使用 ARM64 Node 24 和稳定 Rust，保留 npm/Cargo 锁文件。完整 Xcode、Homebrew、付费开发者账号不是启动工作的一律前置条件。
2. 核对 Git 当前提交并保留 Windows 发布基线，在迁移分支上建立清楚的变更记录。保持同一仓库和共享模块，不要另建复制仓库、覆盖 Windows 发布标签或默认直接推 main；验收后通过 PR 合入。
3. 修正构建链路：目前 `npm run build` 会经过 Windows PowerShell 图标脚本，`desktop:*` 也是 MSVC 包装；Tauri 配置绑定 NSIS 和 win32-x64 资源。增加清晰的 Mac 构建/检查入口及平台配置，保持 Windows 入口可用。`src-tauri/pdf-runtime` 已排除，必须在 Cargo 编译前通过 `node scripts/sync-pdf-assets.mjs` 从已安装依赖生成。品牌输入已包含，生成 `.icns` 时沿用同一品牌，不重画图标。
4. 在 Mac 本机构建、启动并解决真实平台问题：窗口生命周期、阴影、透明文件夹、托盘/菜单栏、快捷键、系统打开文件、应用检测、数据目录、资源路径、WebKit 差异等。
5. 重点实现真实原始文件的 Copy for AI 和拖拽交付。当前 Windows 使用 Shell/OLE，Mac 分支明确不支持。请用 macOS 公开原生能力适配。每次交付是 Markdown context + 原始文件组，Note 也是普通 TXT；保持原字节、最新外部编辑、同名消歧和总大小边界。不能把文件路径、文本、资源 URI 当成真实文件附件，也不能宣称目标 AI 收到了文件而未实际验证。
6. 适配 Mac ARM64 截图/封面辅助程序及独立运行时。当前 Windows 使用系统 Evergreen WebView2，已删除旧 Chromium 路线；Mac 采用合适的系统原生实现，不把 Windows EXE/WebView2 搬到 Mac，不要求用户另装 Chrome。MCP 打包入口当前只支持 win32-x64，需准备校验固定版本的官方 darwin-arm64 Node、完整许可证和本地 helpers，保留受控并发及自有资源清理。
7. 在 Desktop 基础可用后，验证 Mac 的 ChatGPT MCP package 和三浏览器扩展对本地 provider 的连接。复用同一 MCP 工具与 Skill；AI 标签整理已经实现，不要还原成只有只读/新增的旧能力。宿主没有安装或不提供能力时如实记录限制，不要伪造 Detected、已附加、已保存等成功状态。

必须保留的已确认体验：

- Arc 设计体系及共享组件，图标按钮圆形 hover，统一黑底白字 tooltip，中英双语与系统/浅色/深色主题；不要迁移时重新设计卡片、窗口内容、Import 表单或图标。
- 文件夹悬浮窗没有可视黑色提示；面板/文件夹切换暂时采用直接原生显隐，不增加动画、定时延迟、截图转场或每帧 IPC。先隐藏旧窗口再显示新窗口，失败可恢复；只有文件夹置顶。Mac 可以采用相应公开平台 API，Windows 的 DWM 实现不是 Mac 的照抄模板。
- 文件夹构图为 144px（原大小的 90%）；Desktop Floating window 默认开启，关闭时恢复正常任务栏最小化、Close 退出。托盘/快捷键/单实例激活都必须遵守此设置，不复活文件夹。
- 展开靠近边缘时可夹紧面板，但未移动面板就应缩回原文件夹位置；移动过面板则按面板中心收回。选择、搜索、滚动不因切换丢失。
- Copy/Add 采用黑色 → 临时绿色成功 → 黑色反馈，不保留灰色“已添加”，允许主动重复添加。
- 浏览器扩展只做 native sidebar Save current page，切换当前页面自动刷新，Save 后保持打开，不增加收藏库或设置页。Chrome/Edge/Firefox 保持一个共享实现，仅原生侧栏 API/manifest 不同。
- 一个原始文件只有一个权威 managed asset；Open 必须打开它，外部修改再次打开或交付可见。不能给 Note 做特殊内部编辑器，不能解析文件来取代向 AI 交付原件。
- 所有改库测试使用临时合成库，不能给真实收藏库填演示数据。不要运行携带 `D:/StashDockData`、Windows 安装缓存路径的旧部署/迁移脚本。先检查脚本实际副作用。
- Desktop 与 AI 宿主生命周期独立：退出 ChatGPT/MCP/终端不能连带退出 Desktop。长期保持侧栏、重复切换、失败恢复要验证。

验收包括：静态检查、共享测试、Rust 测试、真实 production `.app`、开发服务器停止后启动、至少 10 次文件夹/面板往返、窗口移动后收回、中文/英文与明暗主题、窄屏、导入/编辑/打开、原始文件复制/拖拽、截图封面、数据位置迁移、多入口一致、MCP 查找/保存/经批准标签整理及现有浏览器 Save 链路。若某测试是 Windows-only，请正确限定平台并保留其 Windows 回归，不为通过测试直接删除。只有静态检查或模拟成功不能代替目标宿主实测。

开发阶段先做可本机验证的 `.app`，再生成 `.dmg`。公开分发签名/公证在需要时说明并等我提供开发者身份；不要禁用 Gatekeeper/SIP，不要索取或嵌入私钥、账号密码和长期令牌。

最终交付：可运行应用及明确输出路径、源码变更、可复现命令、验收记录、真实尚未解决的问题和可回滚基线。保持源码与产物一致。对 Windows 没有在此机器实测的部分如实说明，以便我带回 Windows 做回归。开始执行。
