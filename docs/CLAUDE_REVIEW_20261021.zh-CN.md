# Claude 接手审查（2026-10-21）

基线：`main` @ `f1995cf`，另有 88 个未提交修改文件（+3059/−1131）。本报告基于当前工作区。

## 1. 产品与架构速览

| 入口 | 位置 | 角色 |
| --- | --- | --- |
| Windows 桌面端 | `src/` (React) + `src-tauri/` (Rust, Tauri 2) | 可视化管理、原始文件、Copy for AI / 原生拖拽、悬浮文件夹 |
| Codex/ChatGPT 插件 | `plugins/stashdock/server/` (Node MCP + MCP Apps) + `src/features/mcp-app/` | 模型检索/保存、内嵌 shelf 面板 |
| 浏览器扩展 | `extension/` (MV3, Chrome/Edge/Firefox) | 只做 Save page，经本地 HTTP 桥写入 |

三个入口共用同一个 SQLite 库（`stashdock.sqlite3` + `assets/`），schema 共享 `plugins/stashdock/server/schema.sql`。
**但数据层有两套独立实现**：Rust（`library.rs` 等）和 Node（`local-library.mjs` 等）各自实现读写、FTS、备注同步、截图队列、浏览器桥。
这是当前最大的结构性风险：每条业务规则都要写两遍，行为已经开始分叉（见 P0-2/P0-3）。

## 2. 健康度

- TypeScript `tsc -b`：通过。
- 前端测试 `node --test`：Node 24 下 405/405 通过；Node 22 下 1 项（`local-library.test.mjs` 桥接接管）被取消——依赖 unref 定时器的行为，测试本身偏脆。
- Rust：云端无法下载 Windows 目标，未编译；Codex 记录 198 项原生测试通过，需在本机 `npm run desktop:test` 复核。
- 测试质量：2313 个断言中约 860 个（37%）是 `assert.match` 对源码文本做正则匹配，锁定的是写法而不是行为，重构时会大量误报、也挡不住真实 bug。
- 生成产物入库：`plugins/stashdock/web/shelf.html` 1.7 MB、`dist/mcp-server.mjs` 1.2 MB、`extension/ui/popup.js` 0.5 MB。已核对 dist 与源码重建结果一致。

## 3. 问题清单

### P0 — 用户直接可见的功能错误

1. **首次安装桌面端会写入 6 条演示数据。** `src/lib/storage.ts:16-18` 在 localStorage 为空时返回 `seedItems`，`initialize_library`（`library.rs:737`）在库未初始化时把它们写进真实库（含一条没有文件的 “Local PDF”）。只有先装过插件（会写 `library_initialized_v1`）才能避开。违反 AGENTS “never seed demonstration files into the user's library”。
2. **桌面端中文搜索基本失效，且结果会“闪一下再消失”。** FTS5 用 `unicode61`（`library.rs:133`），连续汉字被当成一个词：已用 sqlite 验证 “深度学习入门教程” 搜 “学习”“教程” 均无结果，“如何使用React构建应用” 搜 “React” 也无结果。前端先用本地子串过滤显示结果，140 ms 后 FTS 返回空集，`selectors.ts:24` 用 FTS 结果整体替换，卡片消失。
3. **MCP 搜索按整句子串匹配。** `plugins/stashdock/server/library.mjs:35` 把整个 query 作为一个子串：已验证 “react hooks” 命中、“react state”“hooks react” 不命中。模型通常发多关键词查询，这直接削弱“AI 推荐已有收藏”这一核心价值；且与桌面端（分词 AND + 前缀）结果不一致。插件也没用已维护的 FTS 表，每次搜索把全库正文读进内存。
4. **切到 Claude 的安全前提：管理/删除工具只靠宿主隐藏。** `create-server.mjs:149` 的 `appOnly` 只是 `_meta.ui.visibility:['app']`，`delete_stashdock_references`（最多 1 万条）、`move_stashdock_storage`、`open_stashdock_file` 等都注册在同一个 server 上。不支持 MCP Apps visibility 的宿主（如 Claude Code CLI）会把它们直接暴露给模型。应按客户端初始化时声明的 Apps 能力决定是否注册，或拆分为模型 server / app server。

### P1 — 数据、性能、稳定性

5. **删除引用不删托管文件。** 两端删除只删数据库行（`library.rs:661`、`local-library.mjs:337`），`assets/` 里的副本永久残留：磁盘泄漏，也违背用户“已删除”的预期；搬迁库时还会一起拷走。
6. **UI 线程上拿全局数据库锁。** `capture_platforms.rs:58/66` 是同步 command，在主线程 `lock()` 全局连接；若后台 4 个 worker 之一正持锁做导入/读取，窗口会卡住。AGENTS 明确要求不要这样做。
7. **桌面端全量传输整个库。** `list_items`、`search_items`、`edit_item`、`edit_item_content`、`change_library_tag` 都返回全部条目，包括正文和最大 750 KB 的 base64 封面（`library.rs:311`）。库规模上来后，每次刷新/编辑/搜索都是数十到数百 MB 的 IPC + JSON。MCP 端已做“分页 + 仅当页封面”，桌面端没有。
8. **每次读取都重读全部备注文件。** `note_files.rs:29` 对每个 note 读取整份 `.txt`（每个最多 5 MB）来判断是否变化；两端的每次列表/搜索都会触发。可改为比对 mtime + size。
9. **工作区有 88 个未提交文件。** 包含 Rust、插件、扩展、测试的大量改动，没有提交也没有分支。开始新工作前应先落盘。

### P2 — 一致性与健壮性

10. 桌面桥（`bridge.rs`）没有 Host 头校验，插件桥有（防 DNS rebinding）；目前靠 Origin 注册兜底，但两端不一致。
11. 桌面桥 `Server::http` 绑定失败直接退出线程（`bridge.rs:559`），不会重试；插件桥会每 5 秒重试接管。
12. 桌面桥单线程串行处理请求，一个慢请求会阻塞所有扩展请求；每个请求还额外打开 1–2 个 SQLite 连接。
13. 标签长度：JS 用 `.length`（UTF-16），Rust 用 `chars().count()`，含 emoji 的标签两端判定不同。
14. 桌面多文件导入中途失败时，已拷贝的文件不会清理（`prepare_file_imports`）。
15. 全局 `Mutex<Connection>` 一旦 panic 中毒，整个会话都报 “library is busy”。
16. 托管文件以绝对路径存库；两端目录结构也不同（`assets/<uuid>/<name>` vs `assets/<uuid>-<name>`）。对 Mac 迁移、同步盘、改盘符都是隐患。
17. 版本号硬编码散落：插件 `0.4.27` 出现在 5 处，扩展 manifest 0.4.15，README 写 0.4.13。插件代码变了但版本未变，宿主缓存可能不更新。
18. 脚本里有个人路径 `C:/Users/86137/...`（4 个脚本 + 3 篇文档）。
19. Rust 依赖：`windows` 0.52 与 0.62 两个版本并存；Windows 下 reqwest 同时启用 rustls 和 native-tls，增加体积与编译时间。

## 4. 工程债

- `AGENTS.md` 43 KB，大量是单次 UI 决策的细节，作为每次会话的上下文成本很高，也难以区分“原则”和“某次验收记录”。
- `scripts/` 158 个文件，112 个没有被 package.json / 测试 / 其他脚本引用（一次性 verify/diagnose/backup 脚本）。`docs/` 122 篇，绝大多数是带日期的验收记录。
- 代码风格高度压缩（多语句单行、单字母变量），审查与 diff 成本高。
- 已知未做：卡片列表无虚拟化（`architecture.md` 已记录）。

## 5. 建议路线

1. **先落盘**：把当前 88 个改动提交到分支（或确认后提交到 main），作为 Claude 接手基线。
2. **修 P0**：去掉生产环境演示数据；FTS 改用 `trigram` 分词（已验证 3 字及以上的中文/英文子串可命中），不足 3 字的词回退 `LIKE`（trigram 表下 LIKE 仍可用；已验证“学习”需走 LIKE）；MCP 搜索复用同一 FTS 与同一分词规则；按客户端能力注册 app-only 工具。
3. **修 P1**：删除时清理托管文件（事务提交后删除，失败保留并记日志）；同步 command 改 async；桌面端改成“紧凑元数据 + 按需封面/正文”；note 同步改 mtime。
4. **为 Claude 适配**：新增简短的 `CLAUDE.md`（原则 + 命令 + 引用 AGENTS 中仍有效的规则），评估 Claude Code 插件 / Claude Desktop 扩展打包形式。
5. **长期**：收敛两套数据层（例如由 Rust `stashdock-storage` helper 作为唯一写入方，Node 只做 MCP 协议层），把源码正则测试逐步替换为行为测试，清理一次性脚本与历史文档到 `archive/`。
