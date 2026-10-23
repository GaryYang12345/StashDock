# 导入进度定稿：C2 / 85%

用户确认 C2、85% 图形浓度。Desktop 与 ChatGPT MCP App 使用同一个 `ImportProgress` 和静态 `ImportIllustration`，不暴露方案或灰阶设置。

- 三张相同材质的文字、图片、链接卡片，没有品牌 logo。固定 .85 的合成透明度与选定 HTML 相同，不将三张卡片分别透明化。
- 360px 面板、26px 圆角、32px 内边距；600px 以下内边距 24px。图形区 96px，图形、标题和进度各相隔 24px。居中 18px 标题，Arc 进度条右侧为 14px 百分比。
- 保留真实工作进度、共享 spring、reduced-motion、单 modal、焦点和 busy 边界。未更改导入解析、存储或截图逻辑。
- A55 独立 HTML 与实验源码移至项目外 `D:/StashDock-Design-References/20261021-import-progress`，不进入发布包。

验证：399 项前端测试通过；TypeScript、生产前端、Windows NSIS 和 MCP App 构建通过。隔离导入表单检查 390/768/1024/1440 宽度下 360px 上限及约 255px 高度、深浅主题、无多余控件、reduced-motion、进度更新、忙碌时 Escape 不退出，以及成功后关闭。未向用户库导入测试数据。截图：`output/playwright/import-c2-85-production.png`、`import-c2-85-dark.png`。

插件包 `output/releases/stashdock-plugin-0.4.27-progress-c2-85-20261021.zip` 已验证全部 185 个发布文件与安装缓存一致，并通过独立 Node/stdio、公开网页与 PDF 检查。未结束 ChatGPT；已运行的宿主模块仍可能使用旧缓存，重开宿主后读取新资源。

本机 Desktop 已替换并经 Windows Shell 启动。安装副本与 release 的 SHA-256 均为 `B23649C48FFF4F6F93B97D81DD557E34919512454EA638875C086357463FA5D4`。旧 Desktop、旧插件页面和 SQLite 一致快照保留在 `artifacts/progress-c2-85-20261021`。本次未修改原生窗口几何，界面验收来自共享组件的隔离真实表单，不声称对用户库执行过完整导入。
