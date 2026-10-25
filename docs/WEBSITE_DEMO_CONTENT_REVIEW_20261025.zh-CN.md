# 官网演示正文逐条核对（2026-10-25）

## 核对范围

27 张网站演示卡片。通过 StashDock MCP 按明确选定的收藏 ID 读取对应原收藏，没有直接访问数据库，也没有写回用户收藏库。读取结果只导出公开正文，不携带本地收藏 ID、用户标签、文件路径或临时访问参数。

13 个选定网页的原始保存文本保留在 `website/src/data/saved-reference-content.json`。10 个有实质正文的条目按读取结果逐字恢复，不再保留先前两三百字的网站截短版本。SFT/RL 的原收藏只保存了 20,000 字符，保留它原有的不完整标志，不冒充整页全文。

两条 X 的原保存正文为空，后续已从用户打开的真实 Article 页面读取可见 DOM，并用修正后的扩展提取器获得正文，替换临时简介。Design Spells 按用户要求去除重复标签、列表序号，保留全部九个示例。Uiverse 的原保存正文只有两句按钮文字，简介之后仍保留这份原文字。三张图片根据已经展示的预览补充参考注释，不声称读取、OCR 或修改了原文件。其余五个公开资源的简介参考对应官方来源；五个虚构文档/笔记示例补全了可用的示例上下文。

## 逐条结果

| 演示卡片 | 正文字符数（JS 字符串） | 内容来源 |
| --- | ---: | --- |
| Design Spells · Design details that feel like magic | 534 | 原保存文本去重、清理序号，保留九个示例 |
| SFT, RL, and On-Policy Distillation Through a Distributional Lens | 20000 | 原收藏完整保存文本；原捕获不完整 |
| seeco on X: "Opus 5.5 Motion Design: What the Viral 'One-Prompt' Videos Are Hiding" / X | 15450 | 实际 Article 可见 DOM 正文 |
| Uiverse ／ The Largest Library of Open-Source UI elements | 522 | 英文简介 + 原抓取文字 |
| 湾区周末｜Mission Peak+半月湾上山下海攻略 | 922 | 原收藏完整保存文本 |
| Basic Pitch: An open source MIDI converter from Spotify - Demo | 842 | 原收藏完整保存文本 |
| Plot-color-design | 514 | 基于预览的英文图片注释 |
| Arc UI: the React UI library your AI agents can build with | 594 | 原收藏完整保存文本 |
| Home ／ Laws of UX | 3881 | 原收藏完整保存文本 |
| GUI-HARVEST: Self-Improving GUI Agents through Evidence-Driven Harness Evolution | 2276 | 原收藏完整保存文本 |
| 俄勒冈101自驾-160英里海岸线完整攻略 | 951 | 原收藏完整保存文本 |
| card-ui-design | 518 | 基于预览的英文图片注释 |
| Artificial Analysis Intelligence Index v4.3.2 | 8972 | 原收藏完整保存文本 |
| UCB x Sakana：多Agent自监督实现RSI | 1003 | 原收藏完整保存文本 |
| Korea-Artist-design | 485 | 基于预览的英文图片注释 |
| darkzodchi on X: "How To Turn Opus 5.5 Into Your Personal Reverse Engineer (Full Setup Included) " / X | 12004 | 实际 Article 可见 DOM 正文；内嵌引用帖存在折叠 |
| Anti-Defensive Writing | 787 | 既有英文示例规则 |
| verl-project / verl | 669 | 英文资源简介 |
| langchain-ai / deepagents | 601 | 英文资源简介 |
| Radix Themes | 592 | 英文资源简介 |
| Attention and augmented RNNs | 612 | 英文资源简介 |
| Google documentation style guide | 619 | 英文资源简介 |
| Q3 product spec.pdf | 570 | 英文虚构文档/笔记示例 |
| Pricing model.xlsx | 546 | 英文虚构文档/笔记示例 |
| Code review checklist | 638 | 英文虚构文档/笔记示例 |
| Interview notes.docx | 563 | 英文虚构文档/笔记示例 |
| Project Atlas background | 694 | 英文虚构文档/笔记示例 |

## 回归检查

- 原 MCP 快照之外，两条 X Article 已替换为此次实际页面提取结果；Design Spells 仅按要求去重。网站没有增加正文字符截取。
- 两种界面语言下的正文保持相同；原收藏正文不翻译，补充说明均为英文。
- 全部 27 项都有不少于 200 字符的有用正文或注释，默认上下文包含完整正文。
- 编辑器、预览及桌面复制共用现有上下文格式；扩展修正当前帖归属判断及只读富文本识别，原抓取长度和传输限制保持一致。
- 保存文本自身的不完整标志与网站额外截短分开；SFT/RL 的源上限和 darkzodchi 内嵌折叠引用帖仍如实标记。
- 52 项网站、布局、捕获测试及 5 项浏览器目标测试通过；TypeScript 与网站生产构建通过，仍有既有的单包体积提醒。
- 实际插件演示：SFT/RL 的上下文字段为 20,236 字符，包含全部 20,000 字符已保存正文；预览含末段内容，切回及保存没有改变字段。旅行条目的正文也保留至原保存文本末尾。
- 实际桌面演示：Artificial Analysis 上下文字段为 9,186 字符，包含全部 8,972 字符正文，预览中可找到尾段。截图：`output/playwright/website-full-content-review.png`。

## 本轮补充验收

- X Article 根因：引用帖的时间链接先于当前帖；`contenteditable="false"` 的正文被旧私密字段规则误排除。按当前帖自己的永久链接判断身份，只读正文可读，输入区、表单、隐藏内容仍排除。专注阅读路由仅接受唯一可见的独立 Article 容器，不回退读取整条信息流。
- 真实页面验证使用内嵌浏览器当前渲染的公开文章 DOM，并在本地运行同一份提取器；未读取账号状态、网络接口或 Cookie。Chrome、Edge、Firefox 产物均已生成；没有声称已在三种浏览器的实际 Save 侧栏逐一验收，现有未打包安装需重新加载扩展才能使用修复。
- 插件演示 seeco 编辑字段 15,683 字符，Markdown 预览保留末段；桌面演示 darkzodchi 字段 12,285 字符，包含最后章节和原文末尾。
- 两个交互演示均有 18 个真实网页/仓库跳转按钮，实际操作 Design Spells 按钮已打开来源网站；虚构本地文件不显示无效打开操作。
- 按用户后续决定，1100 像素及以下隐藏首屏装饰卡片，撤掉其额外留白并删除窄屏卡片定位规则；390、1024 像素确认隐藏，宽屏保留原布局。当前窄屏实拍：`output/article-review/hero-narrow-no-cards.png`；文章预览：`output/article-review/article-preview.png`。
