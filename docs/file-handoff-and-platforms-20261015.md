# 原文件交付方案与平台适配

## 产品边界

StashDock 保存原文件、用户补充说明、标题、来源与标签，负责可靠交付，不负责另建 PDF/Office/OCR 内容理解服务。本文先记录方案；后续用户批准后已实现 Windows 原文件与 Markdown 多文件交付。最新实现和验收以 `original-file-delivery-20261015.md` 为准。

## 文件交付建议

### Windows 独立应用：推荐原文件与 Markdown 说明一起交付

已有原生 OLE/Windows Shell 剪贴板和拖拽链路，但目前只发布导出的 Markdown 文件。建议下一步将其扩展为多文件传递：原始 PDF/Office/图片等保持字节不变，另附一份包含标题、标签和用户补充内容的 Markdown 文件。网页、笔记继续使用 Markdown。

- 普通文件与文件说明保持可识别的关联，支持混合多选并去重。
- 仍由用户主动粘贴或拖放，不自动操作聊天窗口，不自动发送。
- 通过资料 ID 解析、校验托管文件；使用不可变导出副本，防止消费者修改收藏原件。
- 必须在接收端确认原文件附件出现、补充说明保留、重复文件名不冲突、应用退出后仍可粘贴。
- 原生多文件传递可实现，但 AI 客户端是否接受某种文件仍由接收端决定。不能承诺所有客户端、格式和大小都支持。

这是独立桌面端最接近用户正常上传附件的路线，建议优先做，不需要另一个收费 AI API。

### 内嵌 MCP App：必须区分上传与添加到草稿

官方文档列出了可选的 `window.openai.uploadFile`，返回 `fileId`；`selectFiles` 和临时下载地址能力也需按宿主检测。文档没有由此证明这些接口可以把一个文件加到当前 Codex 草稿，不能把“上传成功”显示成“已作为聊天附件添加”。

当前 SDK `@openai/mcp-extensions@0.1.0` 的 `openai/files` 是打开原生查看器，不是上传。资源读写与 MCP `resource/blob` 也不等价于原生附件。

只读检查当前安装宿主 `OpenAI.Codex_26.1007.2314.0` 的打包代码：`ui/message` 草稿分支将内容转换为 MCP message/context attachment；发送分支的 `addedFiles`、`fileAttachments` 为空。这证明现用 Add 路径不是原生文件上传，不能据此推断所有未来宿主都不支持附件。

推荐按顺序验证：宿主是否提供正式上传能力 → 是否提供附加到草稿的能力 → 用户实际看到原文件附件且 AI 能读取。未完成最后一步前，保留明确的上下文行为，不新增假附件，不使用私有 IPC、路径文字或自动粘贴冒充。

官方来源：

- [Plugin UI reference / File APIs](https://developers.openai.com/plugins/reference#file-apis)
- [Plugin extensions](https://developers.openai.com/plugins/build/extensions)

## 默认平台专门读取

| 平台 | 已实现的读取范围 | 关键边界 |
| --- | --- | --- |
| X | 当前 status 的正文、引文、媒体替代文字 | 精确匹配帖子 ID，不抓整个时间线 |
| Instagram | p/reel/tv 详情的说明与图片替代文字 | 识别弹层；排除评论图片和头像；不导入首页 |
| Reddit | 当前帖子标题和正文；新 shreddit 与旧版布局 | 匹配 t3 ID/permalink；排除评论与邻帖 |
| LinkedIn | activity/share/ugcPost 详情、公开 posts URL 和 pulse 文章 | 以 URN 或 permalink 定位，不导入整个 feed |
| Pinterest | 当前 pin 的标题、描述和替代文字 | 拒绝旧 pin ID；不导入推荐网格 |
| 小红书 | 当前笔记标题、描述与作者 | 不抓评论或推荐流 |
| 知乎 | 当前文章或指定 answer | 回答 ID 匹配，不抓整个问题页 |

这些读取器只检查当前页已渲染 DOM，不读取 Cookie、密码、页面私有全局状态，不重放登录 API，不绕过付费墙、登录或风控。未加载时返回可恢复错误，不用整页杂文凑结果。纯媒体内容只能保存已有说明/替代文字和截图，不声称理解视频或 OCR。

用户自定义平台继续使用 Readability 与语义正文区域（articleBody、entry-content、post-content、article/main）回退；过滤隐藏内容、表单及弹窗，保留原链接与提取来源。无法识别时明确失败，不能承诺任意登录型 Web App 都能通用解析。

## 验收边界

- 单元回归覆盖当前帖子 ID、相邻帖子、隐藏内容、登录空态、评论、SPA 旧内容、长文、折叠提示、旧版 Reddit 和 LinkedIn URL 变体。
- 浏览器夹具使用自有浏览器和合成页面，不读取用户 Cookie/其他标签，不作为真实账号验收的替代。
- 七个平台仍需使用真实已登录页面逐一确认。站点 A/B 布局或 DOM 变化可能需要后续维护。
- 扩展更新为 0.4.8；现有已加载的解压扩展需要在 Chrome 扩展管理页重新加载一次。

本轮验证结果：263 项前端回归通过，原生测试通过；`verify-platform-posts.js` 在真实 Chromium 的七种合成平台页通过。`verify-file-heading-icons.js` 分别在桌面组件夹具与打包 MCP UI 中确认 PDF、Word、表格、图片均使用同一套 20px 彩色图标，并检查 390/768/1024/1440 宽度、明暗主题及 neutral/blue。未点击 Save，未写入用户收藏。打包独立应用在开发服务器停止后正常展示资料面板；升级前后资料内容及固定标签指纹一致。

旁项记录（未在本轮扩大修改）：MCP 夹具出现既有跨域 favicon 候选被 CSP 拒绝，以及 X 图标请求超时。文件表单功能未受影响；这不应被表述为浏览器控制台完全无错误，后续 favicon 专项应覆盖这些来源。
