# 链接保存与扩展通信修复

## 已确认的问题

1. 单链接可在抓取前保存，但正文队列只接浏览器收藏，导致早存的手动链接没有后续补全。修复后保存仍立即完成，手动链接与收藏导入共用同一正文读取器。未编辑的临时域名标题可补全，用户自定标题、非空正文、主动清空的正文和最终上下文不被覆盖。
2. 原正文队列依赖图片所有者租约。ChatGPT 中仍运行的 image-only 老服务占有图片租约时，新桌面端也无法补正文。现为每条工作队列独立租约，不抢旧图片租约；正文仍只有一个所有者，不新增常驻服务或第二个收藏库。
3. 保存前 GET 查重要求浏览器 Origin；Chrome 扩展的特权 GET/HEAD 不一定携带 Origin。实测两个本地服务在 Origin 缺失时拒绝查重，已有正确扩展 Origin 时正常响应。原客户端将所有失败吞并成 Open app，误导为服务未启动。
4. Uiverse 截图失败已从同一原生入口复现为 `The renderer command queue is unavailable.`，不是仅凭网络猜测。32 条命令瞬时满即失败；修复为受限等待和公平 STA 消息处理，减少无需消费的资源事件/空确认。容量、私网拦截、权限/下载拒绝和浏览器资源边界保持不变。

## 通信约定

- 新扩展为 0.4.14，Chrome、Edge、Firefox 使用同一实现。
- 查重：`POST /v1/capture/lookup`，JSON 仅 URL、operationId、digest，限 16 KiB；这是只读请求。
- 标签：`POST /v1/tags`；这是只读请求。
- 保存：仍为一次 `POST /v1/capture`。不自动重发保存；用户重试前用持久回执检查是否已提交。
- 两个原生提供者仍校验 Host、浏览器 Origin、已注册扩展和客户端标识。未授权请求不会因这次修复放行。旧的已授权 GET 保留兼容。
- 查重可在提供者之间切换，保存只发给完成查重的提供者；业务/权限错误不再伪装成“没有打开应用”。

## 验证与边界

- 隔离库：在一个旧图片所有者持有有效租约时，收藏正文、立即保存的手动链接正文和临时标题仍可自动补全，FTS 同事务更新。
- 浏览器模拟：GET 无 Origin、POST 带 Origin 时，查重、标签、保存、重复确认、回执重试均通过；恶意网页 Origin 仍被拒绝。
- 实际表单：Playwright fixture 将 preview Promise 保持未完成，点击 Save link，确实立即保存 URL 和待补标题标记，不写用户库。
- 实际公开截图：修复前同一 Uiverse 原生测试失败；修复后输出真实栅格图。该次图像的页面框架正常，但部分脚本网络连接失败，元素网格未完整呈现。不能把“有截图”宣称为“网页已完整加载”，也不能保证所有站点资源或登录页面可达。
- 当前 Chrome 加载路径为 `D:/StashDock/extension`。修改其文件后仍需 Chrome 重载扩展；没有自动修改网站权限或浏览器安全设置。

参考：[Chromium 扩展跨域请求中的 Origin 行为](https://chromium.googlesource.com/chromium/src/+/68e96adf4581366f54d90aa126f63746bdc57e57/chrome/common/extensions/docs/templates/articles/xhr.html)、[Chrome 跨域网络请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)。

## 最终交付记录

- 前端 385/385：`output/link-reliability-frontend-delivery.log`。
- 原生 171 通过，保留的 PDF 公开网络测试默认忽略一次：`output/link-reliability-native-acceptance.log`。另行运行 Uiverse 原生截图和生产 helper，以及三页截图复用/正文一致性验证。
- 隔离库的旧图片进程共存、快速保存标题与正文补全：`output/link-reliability-background-acceptance.log`。
- 实际安装的原生服务 `POST /v1/tags`、`POST /v1/capture/lookup` 返回 200，恶意网页 Origin 返回 403：`output/link-reliability-native-api.log`。查询不写用户收藏。
- 用户库仍为其本轮保留的 1 条收藏，没有恢复之前已删除的 65 条。Uiverse 原卡已通过正常后台流程补上真实 screenshot，84,559 字符，任务 done、attempts=1；原正文 255 字符保留，不覆写其已有内容。临时测试截图并未直接灌入用户库。
- 桌面已替换，安装文件与最终 release exe SHA256 一致：`D311ABD3F3A60D9D21D81658CBE1D540487E33C5B7F846553EBF0915548613E7`。
- ChatGPT 插件缓存文件已同步；提取包与缓存 185 文件逐项校验、无 PATH 的捆绑 Node HTML/PDF 查询、宿主 sidebar/conversation entrypoints 均通过。当前已载入的旧插件模块仍需宿主下次重启加载，新桌面服务可独立支持新扩展。
- 插件包：`output/releases/stashdock-plugin-0.4.27-link-reliability-20261020.zip`，42,445,445 bytes，SHA256 `367045cd97617a654a2bd717f0d8a3107ef46e44ffccd1be721d6c03872017aa`。未上传 GitHub。
- 三个扩展均为 0.4.14，目录和独立 ZIP 位于 `output/extensions`；旧版包保留，不覆盖。Chrome 正在使用的源目录已更新，仍需用户重载以刷新内存中的 service worker 模块。未声称已在用户 Chrome 点击 Save 完成最终人工验收。
