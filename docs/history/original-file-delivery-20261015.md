# 原文件交付

## Windows 独立应用

文件卡片的 Copy 与原生拖拽共用 `reference_transfer`，输出一个平面的 Windows Shell 多文件组：原文件副本以及 StashDock 的 Markdown 补充说明。网页和笔记仍只输出原来的 Markdown。没有压缩包、自动粘贴、自动发送或新的解析服务。

- 单个原文件的字节不变；接收方只能修改临时副本，不能修改资料库原件。
- 多选保留资料的顺序和补充内容；共享原件去重，同名文件区分大小写冲突并保留扩展名。
- Markdown 保留现有正文、标签、最终上下文编辑，并追加本次附件名称映射。不会改写已保存的上下文。
- 只接受资料 ID，从同一个 SQLite 只读快照取得内容和原件元数据。校验原件处于托管 assets 根目录中；缺失、越界或传输失败直接报错，不降级为路径文字。
- 原件最多 100 个，总计 100 MB，避免无限制复制拖慢 UI。该限制不是接收端 AI 的格式或大小承诺。
- Shell 数据对象发布 CF_HDROP 等标准格式。剪贴板执行 OleFlushClipboard，让接收方不依赖 StashDock 进程或复制线程继续运行。
- 取消拖拽会清理本次副本；成功输出保留七天。只清理 UUID 命名的平面导出目录，不递归遍历子目录，不触碰资料原件。

接收端 AI 决定它支持的扩展名、大小和个数。StashDock 负责传递文件，不承诺所有 AI 客户端接受所有文件格式。

## Codex 内嵌面板验证

使用当前任务实际打开的 StashDock MCP App 做只读检测（不是本地开发夹具）：`window.openai.uploadFile`、`selectFiles`、`getFileDownloadUrl`、`sendFollowUpMessage` 均未暴露。

官方 SDK `@openai/mcp-extensions@0.1.0` 的 `openai/files` 提供的是文件查看器打开操作，不是原文件上传。现有 `ui/message` / `send:false` 草稿路径使用 MCP 上下文附件，不能将资源 blob、文件路径或普通上下文宣称为原生文件附件。官方文档列出的可选上传 API 也不意味着当前 MCP App 具备“上传并加入当前草稿”的能力。

因此，本轮没有修改 Codex 的 Add 行为，没有发送消息，也没有上传用户的个人文件。若未来宿主提供并验证可用的原生文件草稿接口，再在主机适配层接入，保留黑、绿、黑反馈和重复添加行为。

来源：[Plugin file APIs](https://developers.openai.com/plugins/reference#file-apis)、当前安装宿主的只读实现检查、当前实际 MCP App 的公开接口能力检测。

## 验证

新增原件字节、说明、共享原件去重、顺序、同名、缺失/越界路径、大小限制、清理与 Windows Shell 多文件 CF_HDROP 回归。真实剪贴板测试需显式启用；测试保留并恢复原剪贴板，仅读写自建测试原件。

本轮通过：263 项前端回归、114 项默认原生测试，以及显式启用的真实剪贴板测试。后者确认 PDF、Word 与 Markdown 三个独立文件在复制线程退出后仍可由 `OleGetClipboard` / `DragQueryFileW` 读取，原件字节不变，测试结束后成功恢复原剪贴板。剪贴板读取/恢复的测试辅助代码对 Windows 短暂的 OpenClipboard/CloseClipboard 占用做有界重试；没有改变生产复制路径的交互。

已部署至 `D:/StashDock/stashdock.exe`，安装文件与 release 构建 SHA-256 一致：`296242DCB78A1B39174D67372ECAB7BF045011F8D83D910E25E4E939D301F0DD`。实际打包窗口正常展示资料面板；面板保持普通 Z-order、悬浮文件夹独立。升级前后 47 条资料的内容与固定标签指纹一致。升级前的可恢复数据库与旧执行文件保存在 `artifacts/*before-original-file-delivery-20261015*`。

真实接收端的粘贴/拖放是否接受某种文件，与操作系统传输正确性分开验收。不得仅凭测试夹具成功声称所有 AI 客户端已通过。
