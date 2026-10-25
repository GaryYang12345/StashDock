# 官网 Guide 实现与安装核对（2026-10-25）

## 备份

改动前已在仓库外保存 `website-before-guide-20261025-212506.zip`。
包含 123 个网站文件，以及 package、lockfile、TypeScript 配置和开发准则，共 129 项，1,680,533 字节。
已重新打开压缩包确认包含 `website/src/App.tsx`。

SHA256：`9588A5B94620AE18E5578C8E29A5A1CA484C085F706D756DE23BBBB8453C7A33`。

## 核对结果

- OpenAI 官方支持本地和 GitHub 插件市场；注册市场与安装插件是两个独立动作。本机 `codex plugin marketplace add --help` 和 `codex plugin add --help` 已确认相同命令契约。没有执行安装或改动现有插件配置。
- AI 协助安装是利用本机文件、终端工具执行这些受支持的步骤，不是任意对话粘贴 URL 即可安装的保证。提供完整可复制请求，并保留手动路径；没有编造桌面宿主中的“输入 GitHub 地址”按钮。
- StashDock 当前 Release 需要完整插件 ZIP，内含 Node 和原生程序。直接添加未构建的 Git 源码市场，不能替代完整运行时包。命令中的 `personal` 与实际 marketplace.json 一致，`stashdock` 与插件 manifest 一致。
- 经 GitHub API 读取公开 latest Release：v0.2.5，含 Windows x64 安装器、win32-x64 插件及 Chrome/Edge/Firefox 扩展 ZIP。Mac 附件为开发交接资料，不是 Mac 用户安装包；没有 macOS 或 Safari 可安装产物。Guide 依此标记即将推出，没有代写未验证的 Mac 安装流程。
- Chrome、Edge 各自通过扩展管理页加载解压目录；Firefox 使用临时附加组件，在退出浏览器后移除。三者的浏览器安装入口在 Windows/macOS 上相同，Mac 保存链路仍需要匹配的本地运行程序。Safari 使用独立的 Mac 扩展包。

## 官方来源

- [OpenAI 插件打包与市场](https://developers.openai.com/plugins/build/plugins)
- [OpenAI 插件 CLI 命令](https://learn.chatgpt.com/docs/developer-commands)
- [OpenAI 本地插件链接](https://learn.chatgpt.com/docs/app/commands)
- [Chrome 加载未打包扩展](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
- [Edge 扩展旁加载](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)
- [Firefox 临时安装](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [Safari 扩展](https://support.apple.com/guide/safari/sfri32508/mac)
- [StashDock 已发布产物](https://github.com/GaryYang12345/StashDock/releases/latest)

## 页面实现

- 顶部导航和页脚进入 `guide.html`；首页插件和扩展的安装入口直达对应段落。独立 HTML 入口可以直接访问或刷新，适用于普通静态托管及子目录部署。
- 七个章节，中英文共用结构。桌面端固定目录，手机端展开目录；安装章节提供三个快速入口，系统和浏览器选择复用产品的 Arc SegmentedControl。
- 复制动作使用现有 Arc Button、共享复制反馈 hook，成功绿色反馈、失败恢复指引、键盘焦点和减少动态效果均沿用现有组件。
- 手机目录先收起后定位，防止目录高度变化取消滚动；章节导航同时更新浏览器地址和键盘焦点。同一锚点不重复写入历史。
- SiteShell 统一语言、导航、页脚和基础环境。Guide 不导入整套主页演示或完整参考库；教程复用产品的卡片、品牌与两个展示样例。生产包将共有依赖与各页面入口拆开。
- 删除了上一轮窄屏装饰卡片定位规则；本轮没有恢复它们。

## 验收

- 25 项网站/布局/指南回归测试、TypeScript 和生产构建通过。构建保留既有主页包大于 500 KB 的提醒。
- 实际浏览器验证首页 → Guide → 首页、安装段落直达、中英文切换、Windows/macOS、Chrome/Edge/Firefox/Safari 分支、复制成功反馈、手机目录展开/收起/定位。
- 320、390、768、1024、1440 像素宽度检查，无页面横向溢出。390、768、1440 像素已实看；手机安装段落也已实看。
- 截图：`output/guide-review/guide-desktop.png`、`guide-390.png`、`guide-installation.png`。
- 安装方式依据官方文档、当前 Release 和本机 CLI 帮助核对；本轮没有在干净 Windows/Mac 机器重新安装，也未在三种真实浏览器重走权限与安装流程。Mac 指南仍等待对应产物发布。

## 2026-10-26：入门说明与插件打开教程

- 入门说明明确 Desktop 与 AI 插件（ChatGPT）可任选其一或同时安装。分别解释独立面板拖拽／复制到任意 AI 对话，以及宿主侧边面板的 Add to chat。
- 按用户提供的宿主截图演示：打开侧边面板 → More tools → StashDock → 对话旁的收藏库。宿主入口文字保留截图中的英文名称，中英文讲解分别维护。
- 与首页共用 Replay、首次进入视野后 800 ms 启播的 hook 和脚本光标。有限播放一次，结束保留收藏库；支持暂停、继续、随时重播和四个步骤的手动选择。减少动态效果时显示最终画面，不自动播放。
- 复用真实 ReferenceCardView、Arc Button、品牌图与既有 Design Spells 封面和 favicon。教程内部为 inert 的展示画面，只有外部播放和步骤按钮可操作，不连接用户收藏库。
- 单列卡片保留完整标题与 Add to chat；桌面画布调整到 560px 高，手机 460px，避免最终画面裁掉首张卡片的操作按钮。响应式面板宽度与聊天区使用同一变量，避免边界重叠。
- 实际浏览器检查重播回到起点、暂停／继续、播放到最终状态、手动菜单步骤和教程快速入口。320、390、768、1024、1440px 未见页面横向溢出；390 和 1440px 已实看。
- 这是依据截图重建的使用教程，不是实际插件安装测试，也没有据此修改宿主插件配置。
