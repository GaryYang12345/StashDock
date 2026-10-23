# 小尺寸关闭按钮与 Windows 图标引用

2026-10-08。继续使用 Arc 语义色、动效和键盘 focus token；文件夹及其附着关闭按钮沿用用户明确要求的拟物品牌材质例外，不向普通 Arc 控件扩散。

## 变更

- × 的圆面由 20px 改为 18px、Lucide 字形由 12px 改为 10px；32px 点击范围不变。轻灰边缘、顶缘高光、柔和内阴影与轻磨砂，与文件夹同一动画层。键盘 focus 仍由 foundation 绘制，内偏移随圆面改为 -7px，没有额外黑圈。
- 新 `scripts/verify-windows-icons.mjs` 直接解析 Windows PE 资源，不依赖有缓存的 Shell 提取结果。检查每个图标组的实际 PNG 与当前品牌 ICO 是否逐字节一致。
- 原运行程序已含九个品牌图标尺寸。历史旧程序只含一个 256px 图标，新增校验正确拒绝它；不是仅检查“源码引用对了”就宣称打包正确。
- 桌面和开始菜单的现有 StashDock 快捷方式原为 `IconLocation=,0`，依赖 Shell 默认程序图标。为这些明确指向本 checkout 的快捷方式指定带内容 hash 的品牌 ICO，定向通知 Shell 更新文件元数据。没有清空系统图标缓存、重启 Explorer 或操作其他应用快捷方式。
- 修改前快捷方式保存在 `artifacts/shortcut-backups/20261008-133523`。目标路径、启动参数等不改；没有额外创建或固定任务栏项。
- `npm run desktop:refresh-brand` 可重复执行此定向修复；作为显式维护操作，不在应用每次启动时擅自改快捷方式。`postdesktop:build` 自动核对新 exe 中真正的图标资源。

## 验证

- 前端 61 项通过；桌面 release 构建通过 TypeScript/Vite 和 Rust 链接，仅有此前的 MSVC PDB 缺失警告；无独立 lint 配置。本次未更改 Rust 行为代码，未重复运行 Rust 单测。
- 已读回两个 `.lnk`：目标仍为 `D:\StashDock\stashdock.exe`，IconLocation 为 `D:\StashDock\assets\generated\stashdock-brand-9ba7272a926c.ico,0`。
- 新旧 exe 的 PE 图标校验分别成功/预期失败；因此能够识别旧占位图，而不是只读取磁盘上的新 ICO。
- Playwright 确认圆面 18px、字形 10px、点击区 32px，hover 中间帧贴合、移动到 × 不回弹、reduced-motion、7 次大小切换与三个关闭动作回归全部通过。已检查 `output/playwright/folder-close-hover.png`。
- 已替换并正常启动根目录新程序；原生截图实际显示悬浮文件夹与底部任务栏，任务栏 StashDock 图标已经是品牌 S，不再是用户截图中的旧文档图标。此项有实际画面检查，不仅是资源或快捷方式属性检查。
- `stashdock.exe` SHA256：`FB3FB826D99D5C9D2C6F33050BC8E9DCF231878EE0F1F74B728D3918EC5578D7`；安装包 `artifacts/StashDock_0.2.1_close-small_x64-setup.exe`。旧程序在 `artifacts/stashdock-before-close-small.exe`，修改前快捷方式已备份，未修改用户收藏。

## Arc review

- [x] 保留真实按钮、独立 aria-label、关闭到托盘语义、共享 hover、reduced-motion 与失败 role=alert。
- [x] 无新组件或 Pro 仿制；材质仅用于用户指定的品牌文件夹按钮，普通控件样式不修改。
- [x] 没有自制 focus ring；focus 仍使用共享 token，材质内阴影不在 focus 规则内。
- [x] 新 CSS 使用语义色与共享反馈时长；没有新增字体、文字、数据或重复入场。
- [ ] 18px/10px 为此次明确要求的光学校准；点击区为桌面 32px，不宣称触屏 44px。原生 PNG 的深色系统对比限制延续上轮记录，本次不额外设计暗色品牌变体。
