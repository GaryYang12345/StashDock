# Mac 同步：把已有的 Mac 版本跟上现行 main

这份文档写给已经基于旧 GitHub 版本做出 Mac Desktop / ChatGPT 插件的 AI。从零开始的迁移看
[MAC_START_HERE](MAC_START_HERE.zh-CN.md)；产品、架构和全部规则仍以 `AGENTS.md`、
`docs/product-principles.md`、`docs/architecture.md`、`docs/WINDOW_LIFECYCLE.md` 为准，
本文只说明**变了什么、Mac 要做什么、哪些地方该用 Apple 的做法**。

旧 GitHub 基线是 `f1995cf`（2026-10-19，"Preserve upstream license bytes across clean
checkouts"）。此后 main 上有 80 多个提交，约 460 个文件变化。你的分支可能基于更早的提交，
先用 `git merge-base` 确认。

## 1. 原则：样式和功能一致，实现按 Apple 的方式

两套产品对用户来说是同一个产品：

- **必须一致：** 共享 React 界面（同一份源码，不分叉）、文案和中英翻译、交互顺序和反馈
  （黑 → 绿 → 黑的 Copy/Add）、动画的视觉意图和时长、数据库结构、SQL、搜索规则、MCP 工具契约、
  AI 上下文格式、文件引用规则。
- **按 Apple 的方式做：** 窗口机制、空间动画的实现、拖拽和剪贴板、网页渲染、开机启动、
  系统代理、菜单栏、Dock 行为、打包签名。用公开 API 和 macOS 用户熟悉的行为，不要把
  Windows 的 DWM / OLE / 注册表 / Job Object / 任务栏方案翻译成 Mac 上的等价物。

`AGENTS.md` 里写着 Windows 实现细节的规则（例如 `window_morph.rs` 的 DWM 缩略图、
预渲染阴影、`ShowWindow`、Tao 的 VISIBLE 缓存、任务栏），对 Mac 来说约束的是**用户看到的
结果**，不是实现方式。遇到"Windows 这样做"和"Mac 原生更合适"冲突时，保留用户看到的行为，
实现选 Mac 原生的，并在 PR 里写明理由。

不要因为 Mac 的需要去改共享界面的样式或行为。如果确实需要共享代码改动（例如 WebKit 兼容），
改成两边都对的写法，并让 Windows 测试继续通过。

## 2. 怎么同步

```bash
git fetch origin
git switch feat/macos-arm64              # 你的 Mac 分支
git tag mac-before-sync-20261023         # 先留一个可回退点
git merge-base HEAD origin/main          # 确认旧基线
git merge origin/main                    # 用 merge，保留你的历史，方便我审查
```

解决冲突的规则：

1. **共享文件以 main 为准**：`src/`、`plugins/stashdock/server/`、所有 `.sql`、`tests/`、
   `tests/fixtures/`、`extension/` 的源码、`AGENTS.md`、`docs/`。先取 main 的版本，再把你
   为 Mac 做的必要改动重新放进平台适配层（`#[cfg(target_os = "macos")]` 模块、Mac 专属
   脚本），而不是放回共享代码里。
2. **你的 Mac 专属文件保留**，但要对照下面第 4 节的新契约逐项检查。
3. main 里删掉的文件（第 4.11 节）不要恢复；如果你在那些文件里改过东西，把意图移到替代者上。
4. `plugins/stashdock/dist/` 和 `plugins/stashdock/web/shelf.html` 是生成物，冲突时不要手工
   合并，合并后在 Mac 上重新 `npm run plugin:build`。
5. 合并后先跑 `npx tsc -b`、`node --test tests/*.test.mjs`、`cd src-tauri && cargo test`，
   全部通过再开始做第 4 节的原生工作。

## 3. Windows 实现 → Apple 建议做法

下表的 Mac 做法是建议，选用前请在真机验证；最终以"用户看到的结果与 Windows 一致、符合 macOS
习惯、不需要额外系统权限"为准。

| 部分 | Windows 现行实现 | Mac 建议 |
| --- | --- | --- |
| 悬浮文件夹窗口 | 透明、置顶、无任务栏项的 Tauri 窗口 | `NSPanel`（`.nonactivatingPanel`），`level = .floating`，`collectionBehavior` 含 `.canJoinAllSpaces`、`.fullScreenAuxiliary`、`.ignoresCycle`；不进 Cmd-Tab |
| 文件夹搜索窗口 `search` | 不激活窗口样式 + 原生 region 只让可见部分接收点击 + 关闭后交还前台焦点 | 同样用 non-activating `NSPanel`：按下输入框才 `makeKey`；透明区域用 hit-test 切换 `ignoresMouseEvents`（或按可见内容调整窗口尺寸）；non-activating panel 本身不抢前台应用，关闭时无需手工交还焦点 |
| 文件夹 ↔ 面板空间动画 | 透明叠加窗口里画 DWM 实时缩略图 + 预渲染的面板阴影，一帧内切换真窗口 | 见第 5 节。不要用需要"屏幕录制"权限的截屏（ScreenCaptureKit / `CGWindowListCreateImage`），不要用私有 CGS API；阴影交给系统或 Core Animation，验收标准是"阴影不突然出现或消失" |
| 收起后的面板（Folder 模式） | 真窗口最小化，保留任务栏图标；任务栏还原 = 重新打开面板；系统最小化 = 收起到文件夹 | 用 `orderOut` 隐藏面板（不要 `miniaturize`，那会走飞向 Dock 的动画）；应用保留 Dock 图标，点 Dock 图标（`applicationShouldHandleReopen`）= 重新打开面板；Floating window On 时黄色按钮也走收起到文件夹（把标准最小化按钮的 action 指向同一个 Minimize 意图）。全部经过同一个生命周期策略 |
| 托盘 | Windows 通知区图标 | 菜单栏 `NSStatusItem`（Tauri tray），菜单项与 Windows 相同 |
| Floating window Off | 普通最小化到任务栏，Close 退出 | 黄色按钮正常最小化到 Dock，关闭最后一个窗口即退出（`applicationShouldTerminateAfterLastWindowClosed`）；Cmd-Q 永远退出 |
| 原始文件 Copy for AI | Shell 数据对象：Markdown + 原始文件组，物化后退出也能粘贴 | 复用 `reference_transfer.rs` 生成的不可变文件组；`NSPasteboard` 写入文件 URL（`writeObjects:` NSURL 数组）。文件放在 StashDock 自己的导出目录（Caches / Application Support），保持有界清理，保证退出后仍可粘贴 |
| 原生拖拽 | OLE `DoDragDrop`，卡片图或同步绘制的选择栏图 | `NSDraggingSource` + 文件 URL 的 `NSPasteboardItem`（或 `NSFilePromiseProvider`）；拖拽图像用卡片图或当前选择栏，同步生成，不做 DOM 截图 |
| 选择导入文件 | 系统对话框返回短期 token，界面不传路径 | `NSOpenPanel`，同样只返回 token；单文件 30 MB，一次最多 10 个；目标区域不接受拖放 |
| 网页渲染（封面 + 文本） | 隔离的系统 Evergreen WebView2（`stashdock-preview`） | 用 `WKWebView` 的隔离实例：`WKWebsiteDataStore.nonPersistent()`，拒绝下载/弹窗/权限请求，`takeSnapshot` 取封面，在同一次渲染里取文本；私网拒绝、两条 lane、全局最多两个渲染器、超时和清理规则不变 |
| 系统代理 | 读注册表的 WinINET 代理和绕过列表 | `CFNetworkCopySystemProxySettings`（SystemConfiguration）。`WKWebView` 默认遵循系统代理；Rust 的直接读取要按同一份设置走代理或直连，私网拒绝不变 |
| 开机启动 | `HKCU\...\Run` | `SMAppService.mainApp`（macOS 13+），失败时如实报错 |
| 独立生命周期 | 交给 Windows shell 启动，脱离启动器的 Job Object | 用 `open -a` / `NSWorkspace.openApplication` 启动 `.app`，让 launchd 拥有进程；退出 ChatGPT / 终端不能带走 Desktop |
| 检测浏览器扩展 / ChatGPT 插件 | 读各浏览器 profile 的 Secure Preferences、`~/.codex` 配置 | 路径换成 `~/Library/Application Support/Google/Chrome`、`.../Microsoft Edge`、`.../Firefox/Profiles`（`browser-presence.mjs` 已含）；规则不变：只认当前启用的 StashDock 注册，不认握手历史或缓存 |
| 打开应用 / 文件 | `rundll32` / `explorer.exe` | `open`（Node 侧已有），Rust 侧用 `NSWorkspace` |
| 应用图标 | `icon.ico`、Windows 磁贴 | `assets/app-icon/` 的 Apple 分层源（`apple/`）→ Icon Composer `.icon`；静态 `.icns` 只是兼容 |
| 打包 | NSIS 安装包；插件 `stashdock-plugin-X.Y.Z-win32-x64.zip` | `.app` → `.dmg`；插件包命名 `stashdock-plugin-X.Y.Z-darwin-arm64.zip`（插件的检查更新按 `平台-架构` 找包，见 4.9） |

## 4. 自旧基线以来的变化，以及 Mac 要做什么

标记：**[自动]** 合并后即获得，只需在 WKWebView / Mac 上验证；**[原生]** 需要 Mac 实现或调整。

### 4.1 共享库与数据契约（先做，关系到同一个库）

- **[自动] 搜索契约统一**：每个空格分隔的词都必须作为不区分大小写的子串出现；三个字符以上的词
  走 trigram FTS5（`search-index.sql`，由触发器维护），更短的走 LIKE；相关度优先再按新旧。
  `reference-search.mjs` / `library/search.rs`，夹具 `tests/fixtures/search-contract.json`。
  Mac 构建要把 `search-index.sql` 带进 Desktop 和插件包。
- **[自动] 封面版本**：`stash_items.preview_version` 列 + `preview-version.sql` 触发器。
  Desktop 的书架列表不再读封面字节，而是读版本标记，经 `stashdock-preview` 协议按版本缓存。
  macOS 上 URL 形如 `stashdock-preview://localhost/<id>?v=...`（Windows 是
  `http://stashdock-preview.localhost/...`，`preview_protocol.rs` 已按平台区分）。请在
  WKWebView 里确认图片能加载、能命中缓存。
- **[自动] 文件引用指向原文件**：文件引用保存用户原文件路径，库里保存备份
  （`originals.rs` / `original-files.mjs`）。Open、交付、MCP 读取前比对大小和修改时间，变了就
  刷新备份和可搜索文本；原文件不在时用备份。删除引用会删掉库里的备份（不会动原文件）。
  Note 是普通 `.txt`。Mac 上要验证路径大小写、iCloud 只在云端的文件、外接盘拔出等情况。
- **[自动] 库搬家后找回备份**：库被复制到别的盘或另一台电脑后，按 `assets` 目录重新定位备份
  （`asset_paths.rs` / `asset-paths.mjs`，夹具 `asset-paths.json`）。
- **[自动] 新库为空**：不再写入演示数据，旧演示数据只清理一次（`library/legacy.rs`）。
- **[原生] 用旧 Mac 版建过的测试库升级**：用你旧版本创建的库（复制一份）打开新版本，确认迁移
  顺利、搜索索引重建、封面正常。不要直接拿真实库试。

### 4.2 Desktop 书架性能

- **[自动]** `read_shelf` 只返回元数据，编辑、复制、AI 上下文再按 ID 读全文（`get_items`）。
- **[自动]** 后台封面更新只重读变化的引用（`reference-preview-updated` 事件带 ID，合并处理）。
- **[自动]** 外部写入（MCP、浏览器 Save）由 `web_preview.rs` 里的 `ExternalChanges` 观察：
  `PRAGMA data_version` + 小摘要，不轮询整库。
- **[自动]** `VirtualShelf`（TanStack Virtual）按行虚拟化；搜索结果按查询整批替换，输入不卡。
  请在 Mac 上用 1000+ 条的临时库验证滚动和输入。

### 4.3 链接读取与后台补全

- **[自动/原生]** 粘贴链接时在隔离渲染器里渲染一次，同时得到标题、正文和封面，直接读取作为
  兜底；批量导入不在前台读页面。截图失败先显示默认封面，后台只重试一次。两条 lane、全局最多
  两个渲染器、退出时交还未完成任务。Mac 的渲染器按第 3 节用 `WKWebView` 实现，契约看
  `preview_browser.rs`、`preview_enrichment.rs`、`web_content.rs`、`preview_ready.js`。
- **[原生] 系统代理**：现在严格按系统代理走（绕过列表直连，其余按主机名经代理）。
  `public_web.rs` 的非 Windows 分支目前返回"无代理"，Mac 要接入系统代理设置。
- 诊断脚本 `scripts/diagnose-link-import.mjs`、`diagnose-public-previews.mjs` 是只读的，
  可以在 Mac 上用来对比。

### 4.4 文件夹快速搜索（新功能）

- **[自动]** 前端 `src/features/folder-search/FolderSearch.tsx`、`FolderSearchCard`：悬停
  180 ms 浮出搜索框，输入后上方 cover flow（上方没空间时在下方），滚轮/上下键切换，只有 Copy
  复制（Enter 不复制），当前卡片可拖出，单击以同一搜索打开收藏库。收起时反向：卡片沉回输入框，
  输入框收回文件夹。
- **[原生]** `folder_search.rs` 的窗口部分按第 3 节用 non-activating `NSPanel`。几何计算在
  `window_geometry.rs`（纯函数，可复用）：搜索框、卡片对齐文件夹的**视觉**中轴
  （`SEARCH_OPTICAL_SHIFT = 4.0`，比几何中心偏左 4 个逻辑像素，因为文件夹图形的视觉重心偏右），
  放置永远不移动文件夹。请用同一个值，在 Retina 和非 Retina 屏上目测确认。

### 4.5 文件夹 ↔ 面板空间交接

见第 5 节。Windows 这一轮反复调过，用户在意的点都写进了验收标准。

### 4.6 窗口生命周期

- **[自动]** `desktop_window_policy.rs` 是与平台无关的策略：Open / Minimize / Toggle / Hide /
  ShowLast → Panel、Folder、Minimized（仅 Floating window Off）、Hidden。Mac 必须走这一套策略，
  按钮、快捷键、菜单栏、Dock 点击、系统最小化都经过同一个执行器。
- **[原生]** `desktop_windows.rs` 的执行部分按第 3 节换成 Mac 的做法（收起用 `orderOut`，
  Dock 重新打开，Floating Off 时最小化到 Dock）。面板收起后再打开，搜索、选择、滚动位置要保持，
  面板内容不重新挂载。展开时靠近屏幕边缘会被夹回可见区域，但没被移动过的面板要收回到原来的
  文件夹位置。

### 4.7 原生交付（Copy for AI / 拖拽）

- **[自动]** 复制出去的文件名改为 `StashDock - {标题}.md`（去掉了 UUID）；同名自动消歧。
- **[原生]** `reference_clipboard.rs`、`reference_drag.rs` 在非 Windows 上目前直接报"仅支持
  Windows"。Mac 要按第 3 节实现，复用 `reference_transfer.rs` 的文件组（Markdown + 每个文件的
  最新原始字节，Note 也交付 `.txt`）。不能用路径文本或长文本代替文件。

### 4.8 界面与文案（全部 [自动]，在 WKWebView 里逐项看）

- 空状态按原因区分：搜索无结果（清除搜索）、Files / Web / Favorites / 标签为空、整库为空。
  切换分类时不能先闪一下空状态。
- 统一叫 "Context library"（可简称 library）；悬浮窗说明为 "quick search and copy"；去掉 MCP
  术语和过时文案；翻译表清理。
- 桌面端底部选择栏改为一行（左侧保留拖拽把手），与插件一致。
- 已保存的链接可替换：重复链接弹出确认框（"Replace saved link?"：Keep existing / Replace
  link），保留卡片身份、创建时间、星标和单独编辑过的 AI 上下文。Desktop 和插件共用。
- 检查更新：Desktop 和插件的 About 里都是 "Check for updates" 按钮（无问号），点开同一个
  `UpdateDialog`。
- 所有对话框在任何宽度都用 24px 边距（窄窗口不再缩到 16px）。
- 插件里 Desktop 指南的 "Open StashDock Desktop" 按钮用白底的应用图标
  （`src-tauri/icons/128x128.png`）。Mac 上如果改用 Mac 版图标，保持同样的白底磁贴观感。
- 批量导入进度（C2 构图）、删除确认对话框、导入对话框高度按内容自适应。
- 导入文件只能点 "Choose files"，单个 30 MB。

### 4.9 ChatGPT 插件

- **[自动]** 新工具：`replace_stashdock_link`（App 专用写入）、`check_stashdock_plugin_updates`
  （只读，查 GitHub Releases，只打开发布页）。模型可见的工具没有增加。
- **[原生] 插件包命名**：检查更新会找名为
  `stashdock-plugin-X.Y.Z-${process.platform}-${process.arch}.zip` 的发布附件，Mac 上就是
  `stashdock-plugin-X.Y.Z-darwin-arm64.zip`。Mac 的打包脚本要按这个名字产出，否则 Mac 插件
  永远看到"尚未公开发布"。
- **[原生] 插件打包**：对照 `scripts/package-windows-plugin.ps1` 的白名单写 Mac 版：
  `.codex-plugin`、`assets`、`dist`、`notices`、`scripts`、`skills`、`web`、`.mcp.json`，
  `server/` 下的三个 SQL（`schema.sql`、`search-index.sql`、`preview-version.sql`），
  `bin/darwin-arm64/` 下校验过哈希的官方 Node 和本机构建的 `stashdock-preview`、
  `stashdock-storage`。不要带 `node_modules`、npm、浏览器引擎、`.sqlite3`、调试符号。
- **[原生] `stashdock-storage`**：插件由 ChatGPT 拉起，没有自己的窗口。选文件、选存储位置的
  系统对话框由这个 helper 弹出；在 Mac 上它需要能作为前台应用显示 `NSOpenPanel`（例如以
  最小的 `.app` 形式或临时把激活策略设为 accessory），请实测从 ChatGPT 里点 Choose files 能
  正常弹出且在最前面。
- 插件版本现在是 0.4.30（`plugin.json` 和 `McpShelf.tsx` 里的 App 版本两处）。

### 4.10 文档

`docs/` 已重写，带日期的记录移到 `docs/history/`（只说明当时，不是规则）。新增
`docs/WINDOW_LIFECYCLE.md`、`docs/APP_ICON_HANDOFF.zh-CN.md`、`CLAUDE.md`。

### 4.11 已删除，不要恢复

`src/components/AddDialog.*`、`DesktopTagPicker.*`、`src/features/mcp-app/TagsDialog.tsx`、
`src/lib/bookmarks.ts`、`plugins/stashdock/server/import-services.mjs`、基于路径的导入、演示
数据种子、一批一次性脚本（旧备份/部署/验证脚本）。插件的 cheerio / undici 等依赖已移除。

### 4.12 只在 Windows 上用的开发工具

`scripts/claude-runner.ps1`、`claude-install.ps1`、`verify-for-claude.ps1`、`probe-proxy.ps1`、
`inspect-webview.mjs`（通过 WebView2 的 CDP 端口检查页面）。这些是我在 Windows 上验收用的，
Mac 不需要照搬。WKWebView 没有 CDP，调试用 Safari 的 Web Inspector（开发构建里打开
`isInspectable`）。

## 5. 空间交接：验收标准与 Mac 实现建议

用户看到的效果（两边一致）：

- 展开：面板从文件夹的位置长出来，340 ms，enter 曲线；文件夹同时淡出并略微放大。
- 收起：面板缩回文件夹，230 ms，in-out 曲线；面板在缩到最小之前已经淡出，最后几帧只剩文件夹
  淡入，**不能看到一个缩小版的面板长方形**。
- 全程保持面板比例；来回各 10 次、快速反向都不重影、不闪、不卡。
- **阴影不能在动画结束时突然出现，也不能在收起结束时突然消失**（这是 Windows 上用户反复指出的
  问题）。阴影要跟着面板一起长出、一起淡掉。
- 真窗口和它的动画副本不能同时出现；切换在同一帧完成。
- 系统"减少动态效果"打开（`NSWorkspace.shared.accessibilityDisplayShouldReduceMotion`）或任何
  失败时，直接切换。

Mac 实现建议（请先做小实验再定）：

- 首选不依赖截屏权限的方案：用一个透明、忽略鼠标的 borderless 叠加窗口，在里面用 Core Animation
  动画一个图层，图层内容是面板自己的画面（例如 `WKWebView.takeSnapshot` 得到的面板内容——这是
  应用自己的内容，不需要"屏幕录制"权限），图层自带圆角和 `shadowPath` 阴影，阴影随图层缩放和
  淡入淡出；动画结束时在同一个 `CATransaction` 里显示真窗口、移除叠加层。
- 也可以评估直接对真窗口做 `NSAnimationContext` 的 frame + `alphaValue` 动画，但要确认 WKWebView
  在每帧缩放时不会重新排版、不会卡顿，且系统阴影不会跳变。
- 不要用 Dock 最小化的精灵动画（它飞向 Dock，不是文件夹），不要逐帧 `setFrame` 移动真窗口，
  不要用私有 API。
- 做一个开发用的逐帧记录（只在开发构建里），像 Windows 的 `handoff` 探针一样用像素差验证交接帧，
  再请用户肉眼确认。

## 6. 交回来的方式

1. 推送你的分支（不要推 main）：`git push origin feat/macos-arm64`，开一个 PR 到 main。
2. PR 描述写清楚：合并的 main 提交号；哪些是 Apple 原生实现、为什么这样选；**所有改动过的共享文件
   和原因**（我会重点审查这些，并回 Windows 回归）；测试结果（tsc、node 测试、cargo test）；
   在 Mac 真机上的验收记录（第 5 节、文件夹搜索、Copy/拖拽、截图封面、插件、浏览器 Save）；
   没做完或有疑问的地方。
3. 附上空间交接和文件夹搜索的录屏或逐帧截图，以及浅色/深色、中英文、窄窗口的截图。
4. 签名、公证需要的身份由用户提供；不要提交证书、私钥或账号信息。

用户在 Mac 上确认后会把分支推到 GitHub，我再拉下来逐项核对并给出修改建议。
