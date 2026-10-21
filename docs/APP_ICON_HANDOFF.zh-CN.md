# StashDock 方形图标交接

此包是 `v0.2.5` 源码的图标增量，不是新的应用安装包。将包内 `assets`、`scripts`、
`docs`、`tests` 和 `src-tauri/icons` 合并到仓库同名目录。若 Mac 已改过同名脚本或
测试，请比较后合并；不要替换整份 Tauri 配置或覆盖无关迁移改动。

## 已完成

- 原版 logo 的 SVG 路径不变，等比例居中；白底 1024×1024 母版和配套深色原稿。
- Windows 16/20/24/30/32/36/40/48/60/64/72/80/96/128/256px PNG 与多分辨率 ICO。
- Windows 图标去掉底板外侧透明留白，白底、圆角与标识作为整体等比放大，内部比例不变。Apple 图层不受此调整影响。
- 包含 1024px 表示的静态 ICNS，以及未遮罩、无烘焙效果的 Apple SVG 前景层。
- SVG 可直接导入 Figma 编辑。`preview.png` 仅用于查看白底图标在不同背景和尺寸的表现。

`node scripts/generate-app-icons.mjs` 使用项目已有 Tauri CLI，可在安装依赖后重新生成。
图标与透明品牌标识分开管理；界面 wordmark、托盘模板和浏览器工具栏不应一律加白底。

## 给 Mac 上代理的提示词

请先读 `AGENTS.md` 和 `assets/app-icon/README.md`。沿用这些素材完成 Mac 图标：

1. 在 Apple Icon Composer 创建并保存 `AppIcon.icon`，背景设为白色，导入
   `assets/app-icon/apple/02-mark.svg`。保留完整 1024px 图层和现有位置，不加外框遮罩。
2. 用系统提供的 Liquid Glass 高光、折射和透明度做克制调整，保证原版黑色标识清晰。
   不把截图里的高光或阴影烘焙进 SVG。深色可用配套白色前景和石墨色背景；同样检查
   clear/tinted/mono 以及明暗壁纸下的可辨识度。
3. 使用实际 Apple 工具链编译并接入生成的 bundle 资源。仅给 Tauri 设置一个 `.icns`
   不等于原生 Liquid Glass 已完成。请在 Finder、Dock 和系统各外观下实测实际 `.app`。
4. 若当前工具链/系统暂不支持，使用 `assets/app-icon/app-icon.icns` 静态兼容图标并
   如实记录；不要伪造已完成的 `.icon` 文件，也不要改变整个应用的 Arc 界面。

Windows 端没有运行 Icon Composer，目前未生成、编译或实测原生 `.icon`。
详见素材目录内 README 的官方文档链接。
