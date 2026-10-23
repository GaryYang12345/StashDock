# 浏览器保存与批量截图：实现、研究与验收

## 本次行为

- Chrome / Edge / Firefox 继续共用 capture-client、读取器、session、侧栏、保存 RPC；仅清单和原生侧栏适配不同。扩展版本 0.4.15。
- 已加载、身份仍匹配的 HTTP/HTTPS 页面，不再因为正文为空或截图失败而不能保存。读取器受限时只保留浏览器已提供的链接/标题，不扩大权限、不伪造正文；无法解析的帖子不替换成推荐流或评论。
- 截图和文字均为可选内容，保存成功仍以数据库事务回执为准。地址非法、页面切换、导航和真正的服务写入失败仍是失败，不能显示假成功。原有去重/覆盖确认、修订冲突和不自动重放 Save 保持不变。
- 正文较晚出现时，原有 document/token 校验的 DOM 通知仍更新未被用户改动的表单。
- 原生截图从固定等待改为有界视窗就绪探测：可见图片、字体、aria-busy、正文/媒体和采样布局稳定；不等待无限 network-idle。空视窗不再因固定计时结束而被认为可截图。
- 截图成功立即结束缺封面任务，不再串行等待额外 HTML + favicon 请求。原有较低优先级的 icon-only 队列后补图标，不增加后台渲染并发。

## 哪种截图最快

这里的主要成本是打开 URL、下载资源和网页执行/布局，不是 JPEG 编码。不同网站和机器没有一个有证据的“永远最快”的通用引擎。

| 方式 | 适合的场景 | 限制 / 决策 |
| --- | --- | --- |
| 已加载标签页的浏览器原生截图 | 用户当前浏览的页面 | 不需要再次导航；扩展当前已使用。Chrome/Edge captureVisibleTab 只能截指定窗口的活动标签页，不是任意书签 URL。 |
| 复用的私有系统 WebView2 | Windows 大批量公开链接 | 当前默认；不捆绑浏览器、不打断日常标签页，资源预算和清理集中管理。仍要逐页真实渲染。 |
| Playwright / Puppeteer / shot-scraper | 自动化截图工具、测试、服务端 | 可以参考等待条件、复用和截图准备，但不是无需加载网页的加速器。直接引入还要考虑额外运行时、浏览器安装和分发体积。 |
| 网页声明的 OG 图片 | 需要快速封面而非网页截图 | 通常少做一次浏览器渲染，但不是实际页面截图，继续只作为失败后封面回退，不能混称 screenshot。 |
| 第三方云截图 | 愿意上传 URL 的在线服务 | 引入网络、隐私、成本及服务依赖；本次不采用。 |

“从 Chrome 导入书签”只能证明存在可读取的书签来源，不代表该浏览器正在运行、已安装并启用扩展、已授权页面访问，或这些网页已经打开。Chrome/Edge 的当前页截图不能静默替代整个书签队列。

Firefox 另有 captureTab，可指定标签页，但同样需要扩展、权限、创建/加载网页；不能据此认为批量截图零加载或更省资源。为三个浏览器增加后台标签页截图，会增加宿主依赖、标签生命周期和权限差异，本次不引入第二条批量渲染架构。

下一阶段若仍有明显等待，应优先测量并实现可见卡片优先调度，以及有大小/时效上限的跨导入 URL 缩略图缓存。它们分别改善首屏体感和重复导入；目前尚未实现，不能把其收益归到本次。

## 一手资料与开源参考

- [Chrome captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)：活动标签页及权限边界。
- [Firefox captureTab](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/captureTab)：指定 tab 与 all_urls 权限。
- [Microsoft WebView2 performance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)：复用控件/环境，避免冗余实例。
- [Playwright screenshotter 源码](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/screenshotter.ts)：截图准备、字体和动画处理。本次采用自己的轻量探测，没有复制该源码。
- [Playwright 页面就绪文档](https://playwright.dev/docs/api/class-page#page-wait-for-load-state)：不应把 networkidle 当作通用就绪判据。
- [shot-scraper](https://github.com/simonw/shot-scraper) 与 [条件等待说明](https://shot-scraper.datasette.io/en/stable/screenshots.html#waiting-until-a-specific-condition)：基于 Playwright 的开源截图工具，可等待明确 DOM 条件。

## 验收边界

真实 Uiverse 公网页由本地原生 renderer 截图，人工查看输出已包含元素卡片区；运行日志仍有第三方资源失败，因此不宣称网页所有资源均完整。此测试不写用户收藏。

三浏览器身份分别对真实隔离本地 provider 完成空正文/无截图保存；读取、切页、过期结果、截图配额、重复确认和未知提交回执均有回归。浏览器安装实例中的点击与重载仍需用户验收，测试服务通过不等于已经操作真实 Chrome/Edge/Firefox。

测试和打包日志位于 `output/browser-preview-0415-*`。用户数据快照位于 `artifacts/browser-preview-0415-20261020/library.sqlite3`；不恢复、重导入或改写用户现有收藏来制造验收结果。

### 本次交付结果

- 前端 390 项通过；原生 171 项通过、1 项显式网络测试默认忽略；额外手动启用的 Uiverse 原生公网页截图测试通过并查看图片。
- 最终 release helper 的三页验证：3.164 / 3.195 / 6.216 秒出图，创建一个 renderer、复用两次；单链接与后台正文 1883 字符完全一致。这是三个公网页的功能/时间样本，不是 60 站全量吞吐量测试或严格前后对照。
- 独立插件交付目录与本机缓存 185 文件校验通过，自带 Node 24.22.0，PATH 为空时 stdio、网页和 PDF 查询通过。
- 本机 Desktop 已替换并启动，SHA256 `4b5dcb16f52093a779aa193b8e81add06104ecdecb82cf298acb15d11eaeebba`；17863 health、注册 Chrome Origin 的 POST tags/lookup 均 200，外部网页 Origin 403。未自动点击浏览器 Save。
- 三浏览器扩展 zip 位于 `output/extensions/stashdock-{chrome,edge,firefox}-0.4.15*.zip`，共用源文件与生成目录逐一哈希一致。Firefox 仍是未签名开发包。
- AI 插件运行文件已同步，`output/releases/stashdock-plugin-0.4.27-capture-0415-20261020.zip` 为本次完整包。文件替换不等于重启宿主内存中的旧模块：浏览器需重载扩展，AI 后台由宿主下次重载启用。没有强制结束用户 ChatGPT/浏览器，也未上传远端仓库。
