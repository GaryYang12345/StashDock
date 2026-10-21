# 书签完整性与链接草稿读取

## 本次改动

- Chrome / Edge 每个配置同时读取 `Bookmarks` 和 `AccountBookmarks`；仅有账号书签的配置也能发现。读取所有根目录及其子目录，不读取 `.bak`。合并后仍通过现有 canonical URL 逻辑去重。
- 支持 `Local State` 已登记的非标准名称 Chromium 配置目录；继续限制在浏览器已知根目录内，拒绝越界重定向。
- Firefox 继续使用只读 SQLite 事务，覆盖工具栏、菜单、其他、移动书签；读取已提交 WAL，排除标签的虚拟副本和历史记录。没有增加磁盘轮询。
- 链接身份改变立即作废旧请求、旧自动结果和旧编辑标记；当前链接上的手动编辑不会被异步结果覆盖。重复检查返回时同样验证请求代次。
- 标题与正文使用既有 Arc 输入框原生 placeholder，显示 Reading title / Reading content 和同步动态省略号。不增加 tooltip、状态行或额外高度；屏幕阅读器只收到一次读取状态，减少动态效果模式使用静态省略号。定时器仅在打开且读取中存在。

## 只读本机核对

| 浏览器 | 有效 HTTP(S) 书签行 | 规范化去重后 |
| --- | ---: | ---: |
| Chrome | 131 | 127 |
| Edge | 176 | 175 |
| Firefox | 191 | 145 |

Chrome 之前只读取到本地存储的 66 行，遗漏账号存储的 65 行。以上是读取时的快照，不包含浏览器内部页面、非网页协议、未落盘的远端收藏。没有修改浏览器文件或向用户库导入测试卡片。

## 验收

- 原生单元测试覆盖两类 Chromium 存储、账号单独存在、Edge 共用路径、登记配置名、备份排除和 Firefox 四类根目录/WAL/标签副本排除。
- 隔离浏览器回归：旧请求晚返回不得填入新链接或停止其读取提示；换链接清空旧编辑内容；同一链接保留手动编辑；立即 Save 等待最新读取。
- Arc 检查：继续使用既有 Input / Textarea；字号、间距、圆角和焦点规则不变；窄屏无横向溢出；明暗主题、减少动态效果已截图检查。
- 截图：`output/playwright/link-reading-light.png`、`output/playwright/link-reading-dark-narrow.png`。
- 变更前文件和应用备份：`artifacts/bookmark-drafts-20261021/`。本次未修改收藏数据库结构或内容。

## 交付核验

- TypeScript、405 项前端测试、198 项原生测试通过（另有 1 项原有测试忽略）。
- 桌面端已替换并经 Windows Shell 独立启动，安装文件与构建产物 SHA-256 一致，确认包含 `LibraryView-CU2ZXAbH.js`，本地健康接口正常。
- 插件已更新本机缓存；188 项包文件校验通过，清空 PATH 后仍能用捆绑 Node 启动并完成原生读取验证。视觉资源更新至 `ui://stashdock/shelf-v60.html`。
- 插件压缩包：`output/releases/stashdock-plugin-0.4.27-bookmark-drafts-20261021.zip`，42,570,823 字节。
- 全量旧版 `verify-desktop-link-import.js` 中的“菜单仅 3 项”断言已过时（实际还包含 Platforms），没有据此修改产品或宣称该旧脚本全量通过。本次另外检查 Chrome 多配置合并、展开 100 条以外的项及已有网址禁选，均通过。
