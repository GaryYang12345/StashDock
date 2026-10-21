# 导入进度与读取流程

## 产品行为

- 浏览器导入点击 Import 后，表单替换为居中的独立等待层，保留共享灰色遮罩，仅显示官方 Arc Progress 的“正在导入 / Importing references”和百分比。不在列表下方展示进度，不叠加第二个 modal。不显示正文是否获取、不显示统计总结；保存成功后关闭。
- 链接无法读取时仍保存链接，不为此添加提示。真正的持久化失败保留原有导入错误与重试入口，不伪装成功。
- 单链接和批量都用 `link_metadata::fetch_content`。单链接自动预填与 Save 共用请求，立即点击 Save 不会另发一份请求，也不会在读取未结束时提前保存。
- 用户编辑过的标题、内容、标签及自选封面保持优先。截图不在普通 HTML 导入的等待路径上，保存后由原队列独立获取。

## 实现边界

- 两个并发读取，每批最多八条后提交，限制完整正文与 PDF 预览同时留存和单次 IPC 大小。原有原生下载/渲染超时仍有效。
- 临时原生执行容量不足按有界预算等待，而不把 Busy 错当成该网页无内容。关闭/切换使旧任务失效，不再调度新读取或提交该批。
- 已提交批次在后续批次失败或宿主关闭后保留；重试走已有 URL 去重，不覆盖已存在引用。未提交的当前批次不会被伪装成成功。
- 完成的结果内部标记 `contentSettled`。空结果同样最终确定；旧版遗留引用仍可走原有后台文本队列，但不得更新新的 settled 引用，包括已在途的旧任务。
- 通用 HTML 提取优先 article/main/常见内容根，回退普通 body，支持表格、div 和直接文字；按文本节点一次读取，避免嵌套重复。过滤导航、评论、表单、编辑区、隐藏内容及脚本。输出仍限制 50,000 字符，不声称能读取登录或纯动态页面的全部内容。

## 验收

- 前端 395 项通过，原生 180 项通过，1 项显式联网测试默认忽略。日志 `output/import-progress-*-final.log`。
- 隔离 UI 使用真实共享 DesktopImportDialog、Arc Progress 和两主机共用逻辑。7 条链接含 1 条模拟不可读：进度中途 14% 时保存数为 0；结束保存 7 条且不等待截图，无提示总结。
- 保存失败时弹窗保留，未显示成功，Import 恢复可用；窄宽 390px 深色及 reduced-motion 已检查，最终按钮完整可见，无横向页面溢出。
- 单链接立即 Save：读取结束前不写入，结束后保存实际结果，查询次数为 1。上述是隔离模拟服务，不是用户网站或真实 ChatGPT UI 的签入验收。
- UI 图像位于 `output/playwright/import-progress-*.png`。回滚与一致数据库快照位于 `artifacts/import-progress-20261020`；不写测试收藏到用户库。

## 发布注意

旧 ChatGPT 的 Node 模块不会因替换文件而自动更新。必须区分源文件/缓存一致、Desktop 新版已启动，以及 AI 宿主是否已重载。不得从文件哈希或后台服务存活推断旧宿主已执行新流程，也不得强杀 ChatGPT。

## 本机交付验收

- Desktop 已替换并启动，运行文件与 release 文件 SHA-256 一致；`/v1/health` 返回 200。使用 computer-use 打开并关闭真实导入弹窗，未提交测试收藏。
- 完整插件包位于 `output/releases/stashdock-plugin-0.4.27-import-progress-20261020.zip`。安装缓存与包内 185 个文件校验一致；在空 PATH、隔离收藏库中验证 stdio、面板资源、普通链接和 PDF 读取通过。
- Arc 使用官方 Progress，保留既有 token 文件；复核共享组件、浅/深色、390px 窄屏、reduced-motion、对齐间距、可访问进度及保存失败状态。进度运行的视觉检查来自隔离生产构建，不是对真实用户库执行批量导入。
- 前端最终重跑 395/395 通过，`git diff --check` 通过；ChatGPT 当前旧进程仍需宿主退出重开后加载新版。

## 独立等待层与性能复核（后续修改）

- 共享 FluidDialog 保持一个 Radix modal、灰色遮罩与焦点所有者。等待时移除表单交互，保留可访问标题和实时进度；不允许 Escape/点击遮罩中断正在提交的批次。失败回到保留原选择的表单；完成关闭并返回触发按钮。
- 实际隔离生产构建验收：等待时 1 个 dialog、0 个表单控件、焦点在 dialog；高度约 84.6px，不沿用旧表单高度。390px 深色/蓝色 accent/reduced-motion 无横向溢出。7 条混合结果全部保存，其中 1 条模拟读取失败，无额外总结；实际保存失败显示原错误并恢复 Import。截图 `output/playwright/import-overlay-*.png`。
- 前端最终 396/396 通过；TypeScript 与生产构建通过。Arc 审核覆盖文案/字号、semantic tokens、浅/深色和 neutral/blue、单层表面、可访问标题/实时进度/焦点返回、无多余控件及失败恢复。官方 Progress 内部未修改，窄屏和 reduced-motion 已渲染检查；其他宽度沿用居中 max-width 布局。
- 当前 HTML 详情提取两路并发，HTTP 读取不等待 JS/截图；后台图像单消费者，短时复用一个隔离 WebView2。保留两类任务不同的资源策略，不为表面吞吐增加常驻池或无界并发。
- 本轮公开小样本实测：Example Domain 2,749ms/156 字符、Rust learn 947ms/2,147 字符，并发总计 2,749ms；三页真实截图分别 2,968/3,438/3,840ms，渲染器创建 1 次、复用 2 次，正文双入口结果严格一致。记录 `output/import-overlay-content-check.log` 与 `output/import-overlay-preview-check.log`。这是当时网络下的小样本功能证据，不是 60 站点吞吐、成功率、CPU 或内存收益证明。
- 复用 WebView2 而非反复创建也符合 [Microsoft 性能建议](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)。进一步并行渲染可能降低队列等待，但会增加活跃页面、内存与网络争抢；更早截图会增加未完整绘制风险。没有量化收益前不改并发/等待预算。性能、准确率、效率和复杂度的平衡已加入 AGENTS 与产品原则。
- 后续修改包：`output/releases/stashdock-plugin-0.4.27-import-overlay-20261020.zip`。185 文件与本机插件缓存逐项匹配；空 PATH stdio、普通链接和 PDF 的隔离运行验证通过。NSIS 已重建；release Desktop 内含 `LibraryView-B9AbtMPX.js` 最新资源。
- 本轮 Desktop 自动终止/替换命令被系统策略拒绝，未执行，不能将源码/安装包完成当成本地运行版已更新。等待用户从托盘退出后再替换；ChatGPT 旧 Node 仍需宿主重新打开。替换前的一致库快照与旧 Desktop 位于 `artifacts/import-overlay-20261020`。
- 用户确认退出并要求重试后，分别执行只读进程检查、文件替换和启动成功。已确认没有运行中的旧 Desktop；本地程序与 release SHA-256 均为 `16175B05F95367A4273D88FF8BD2A3CF722D260699AD42F7226A0A2EE4A891EA`。先前拦截只有通用策略错误，不能推断为文件锁定或某项操作被永久禁止。

## 已选 A 方案落地

后续 2026-10-21 已按共享弹窗收拢留白与辅助字号，当前规则见 `PROGRESS_CONSISTENCY_20261021.zh-CN.md`。本节的 32px/18px 百分比为当时的历史方案，不再是当前规范。

- 用户选择 `output/progress-design-options/index.html` 中的 A。正式共享 ImportProgress 只实现 A，不把 B/C 或演示计时器加入生产。对比页 A 改为复用正式组件，以减少后续漂移。
- 外层 440px、surface 圆角、32px padding；18px 标题和百分比同基线，下方间隔 24px 接官方 Arc 条。600px 以下 padding 24px、字号 16px。实际共享对话框测得 440 × 122.1875px。
- 百分比使用 motion value，不逐帧触发 React 状态更新；与 Arc 条使用相同 smooth spring，reduced-motion 直接到位，卸载/更新停止旧动画。标题通过唯一 ID 关联进度语义，屏幕阅读器不重复读取动画数字。
- TypeScript/生产 UI 构建通过，397 项前端通过。隔离真实共享表单验证浅色、390px 深色/blue/reduced-motion、实际七条混合导入完成与 settled 标记，以及保存错误恢复 Import；无用户收藏写入。截图 `output/playwright/progress-a-production-*.png`。
- Arc 复核：复用已有官方 Progress，不改内部；语义 token、400/500 字重、字号标尺、单层表面、浮层阴影、稳定等宽计数、无额外图标或说明、键盘/焦点与忙碌边界保留。不是用通过的测试代替视觉检查；呈现已实际截图对照获批 A。原生逻辑未修改。
- A 包 `output/releases/stashdock-plugin-0.4.27-progress-a-20261020.zip` 已生成，185 文件与本机缓存完全匹配，空 PATH stdio/HTML/PDF 隔离校验通过。NSIS 已更新。Desktop 已按已观测 PID 结束旧实例、替换并启动；安装文件与 release SHA-256 同为 `320D5BDF9E9A6766458244C922ED17998C34C354FEB8E9DD1DB1ECBB1FCF6CDE`。ChatGPT 未被结束，旧宿主模块/资源缓存需重开后加载。
