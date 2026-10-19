# 第一阶段代码结构与性能整理

## 结论

之前不是每一处都有问题，但数据同步、持久化触发条件和入口职责确实混在一起。最需要处理的不是再叠加动画补丁，而是避免无意义的读写与重复渲染。本轮保留已批准的视觉和窗口引擎，不启动第二阶段 UI 改版。

## 已整理

| 原问题 | 修改 |
| --- | --- |
| App 同时管理路由、收藏同步、动作与 UI | App 只选 surface；LibraryView、controller、store、selectors 分层 |
| 大小面板各自读取和监听数据 | 共用一个快照、一组监听和刷新生命周期 |
| 读取/扩展刷新后自动写回整个列表 | 移除 autosave effect，只由显式 mutation 持久化 |
| 收藏星标重新提交所有截图、正文并更新索引 | 单条 favorite UPDATE，不修改正文/截图/FTS |
| 每次读列表都发送 legacy seed 并执行初始化检查 | 初始化一次，之后 list_items |
| 快速操作与刷新可能交错；保存失败后 UI 先成功 | 排队、刷新合并、失效重读；持久化成功才发布 |
| 原生文件导入已保存后，前端再保存一遍 | 使用 persisted 分支，不重复写入 |
| 各组件重复搜索/过滤/选择逻辑 | 共享纯 selectors、缓存搜索文本和 ID 查找 |
| 旧通知/复制计时器会关闭新反馈 | 一个可替换、卸载清理的 transient timer |
| 全部主界面和导入 UI 随启动加载 | 拆出 lazy Library / AddDialog chunks |
| 数据刷新重建所有 item 引用 | 保留未变的 canonical item 引用，跳过一致快照 |
| 卡片每次父组件更新都渲染、重复生成拖动文本 | memo + 稳定 actions；Markdown 生成一次 |
| 截图同步解码、原生图片拖动可能抢占 context payload | lazy/async images + draggable=false |
| Dock 的 CSS 与 Motion 都改变 hover transform | 移除 CSS translate，保留一个动画来源 |
| 后端启动无条件重建全文索引 | FTS 迁移标记，初始化后只做增量索引 |
| 部分 upsert 保留数据库正文却抹掉其索引正文 | 索引从最终保存记录读取 |
| HTTP 路由、权限判断和 SQLite 业务混在一文件 | 独立 library/bridge.rs，保留外部接口 |
| MCP 查询 Dock URL 也先读全库 | URL 元信息直接返回，离线也能取得 |
| 开源目录可能包含本地 profile 和运行二进制 | 加入忽略规则，没有删除本地数据 |

## 验证

- 前端 36 项回归通过：旧窗口/品牌/弹窗回归、新共享状态读写、并发失效、失败恢复、去重、FTS 排序、原生已保存分支、MCP URL。
- Rust 17 项回归通过（已在桥接模块拆分后重新执行）。包括单条星标更新、正文索引保留及二次初始化不重建索引。
- TypeScript/Vite 生产构建通过，启用 noUnusedLocals / noUnusedParameters；扩展和 MCP JavaScript 语法检查通过。
- 初始 JS chunk：约 522.87KB → 441.17KB（减少约 15.6%）；另有 Library 64.81KB、AddDialog 22.07KB 按需加载。这里测量的是构建文件大小，不是启动耗时或帧率。
- 最终桌面生产打包通过，已替换根目录运行程序。实际桌面验收：文件夹展开、小面板进入主界面、26 条收藏及缩略图、Ctrl+K 搜索后只显示目标结果、清空恢复列表、Ctrl+N 首次加载导入弹窗、Escape 关闭、返回小面板和收回文件夹。展开状态没有残留文件夹；未对用户收藏做删除/新增测试，数据库 mutation 使用模拟 repository 或一次性 SQLite 测试。
- 根目录与 release 可执行文件 SHA256 一致：`BFEE715860E4ED026E2339B86FB030882688138D0FA15EE76318584ED4C3D30E`。安装包：`artifacts/StashDock_0.2.1_code-cleanup_x64-setup.exe`；旧运行程序保留为 `artifacts/stashdock-before-code-cleanup.exe`，可回退。

## 第二阶段边界

可以开始统一字体、间距、颜色、卡片、标题栏、弹窗与多选操作的视觉体系。重设计改 `LibraryView`、`DockView`、UI components 和样式；不需要重写 store、SQL 或原生拖动。

不能声称所有性能问题已消失：大库分页/虚拟化、HTTP 全量截图传输、混合 DPI、固定画布 GPU 内存与连续拖动帧时间仍需专项测试。扩展脚本的进一步模块化和桥接分页应随明确集成测试一起做，不在本轮盲目更换协议。详见 [architecture.md](architecture.md)。

本轮使用 design-taste-frontend 的职责隔离与性能约束整理结构，没有引入新依赖、循环装饰动效或视觉风格变更。
