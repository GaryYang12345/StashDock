# 等待面板视觉比例修正

本次以用户实际截图为反馈，不把“所有数值相同”当作视觉一致。短状态面板与长表单属于同一系统，但圆角和内部节奏需要适配各自体量。

- 宽度 440 → 400px，圆角 surface 34 → panel 26px，标题行到进度条 24 → 16px。
- 保留既有 18px/500 标题、14px/400 辅助百分比、24px/窄屏 16px 留白、共享表面/遮罩/阴影与官方 Arc 进度条。无额外说明、图标或按钮。
- CSS zoom/transform 验证发现旧测量使用 viewport-space rect，然后将缩放后的数值再次作为 CSS 高度，导致底部额外空白。改读两个 border-box 的 used CSS height，保留小数且不重复缩放。不是在未确认用户截图成因时将其全部归咎于缩放。
- 不改导入/截图流程或原生窗口生命周期。共享表单的动态增长、失败回退、窄窗口、主题与 reduced-motion 仍需验证；仅源码规则通过不能代替实际比例检查。
- 验收：398 项前端通过，TypeScript 与生产构建通过。隔离共享表单验证 CSS 150% 缩放下 CSS 高度 98.1875px 与两个内容盒合计 98.1979px 相符，无重复放大；截图 `output/playwright/progress-balance-final-150.png`。390/768/1024/1440 宽度待布局 settle 后高度均正确；深色/blue/reduced-motion、七条导入完成关闭、失败回到原表单均通过。没有把 CSS 缩放模拟声称为真实 Windows DPI 验收，也未向用户库导入测试收藏。
- Arc 复核：同源 Progress、不改内部，语义字号/颜色与字重，基线和两边对齐，16px 内部成组间距、24px 外边距，短面板使用 panel 圆角而非大 surface 圆角，浮层阴影、单 modal、现有焦点/忙碌边界、等宽计数和 reduced-motion 保留。对比例和 150% 模拟的图片已实际查看。
- 已打包 `output/releases/stashdock-plugin-0.4.27-progress-balance-20261021.zip`、同步插件缓存并重建 NSIS。Desktop 已替换启动，安装副本/release SHA-256 同为 `6BB05B3F9B0CA1240B3EBE953BEC10DAD4041C98EE71371C64408EB897BFE8B4`。ChatGPT 未结束，宿主重开后加载；旧 Desktop 和一致数据库快照在 `artifacts/progress-balance-20261021`。
