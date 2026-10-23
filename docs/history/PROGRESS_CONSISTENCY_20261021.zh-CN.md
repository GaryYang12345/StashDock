# 导入等待层一致性复核

随后已依据用户实际截图进行光学比例调整：短面板改用 panel 圆角、收窄宽度及内部行间距，见 `PROGRESS_OPTICAL_BALANCE_20261021.zh-CN.md`。本节表格记录此前参数核对，不代表所有弹窗应强制相同圆角和节距。

用户要求以既有 Import references 等弹窗为基准，而不是仅满足 Arc token 标尺。

| 属性 | 普通共享弹窗 | 原 A 等待层 | 修正后 |
| --- | --- | --- | --- |
| 标题 | Inter 18px/500，1.4 行高、-0.01em 字距 | 桌面一致，窄屏单独变 16px | 始终与共享标题一致 |
| 辅助百分比 | 类似计数用 14px/400 | 18px/400，与标题等大 | 14px/400 |
| 内容留白 | 24px，560px 以下 16px | 32px，600px 以下 24px | 删除专用覆盖，直接继承共享规则 |
| 卡片圆角、边框、阴影与遮罩 | FluidDialog 统一所有 | 相同 | 保留同一所有者 |

- 保留 A 的标题/百分比同基线、下置 Arc 进度条及 440px 宽度。宽度按内容任务决定，不把所有弹窗强设成相同宽度。
- 不改 Arc 内部，不把标题和所有控件无差别缩小；没有修改全局字号、系统缩放或其他已确认弹窗。
- 新增回归比较两个 CSS 标题的字体、字号、字重、行高和字距，并禁止进度专用 gutter/字号 breakpoint。
- TypeScript 与生产构建通过；最终 398 项前端测试通过。首次与 prebuild 同时运行的静态资源 mtime 检查失败，停止重叠生成后整套通过；没有删减或放宽该检查。
- 在真实共享表单的隔离生产构建中，先读取 Import references 标题和 gutter，再启动模拟批量导入，逐属性比较 computed style。宽度 390/768/1024/1440 全部核对标题 18px、百分比 14px、gutter 16/24px，无页面横向溢出。浅色、深色/blue/reduced-motion 已截图；七条模拟链接完成后关闭，未写用户库。
- Arc 复核覆盖语义 token、字号/字重、对齐与辅助层级、统一外层、已有动画与无障碍边界。保留原导入/截图流程，无原生逻辑更改。截图：`output/playwright/progress-consistency-*.png`。
- Desktop 与 NSIS 已重建并替换本地运行版，release/安装副本 SHA-256 同为 `9137C319AFE04CFB1039363C3BED953CEB6ED31596A62226358AF8EC98334E8F`。插件包 `output/releases/stashdock-plugin-0.4.27-progress-consistency-20261021.zip` 与本机缓存同步。替换前一致库快照与旧程序在 `artifacts/progress-consistency-20261021`，未结束 ChatGPT 或浏览器。
