# 关闭行为与品牌图标

2026-10-08 后续修订。取代上一版“× 收起到任务栏”的语义，不改变原生窗口形态引擎或收藏数据库。

同日后续微调：圆形 × 改为 18px、完成 Windows 快捷方式图标刷新并在原生截图确认任务栏品牌图标。当前程序校验与备份见 [小尺寸关闭按钮与 Windows 图标引用](./taskbar-icon-and-close-review.md)；下面的 SHA256 代表本文件记录的前一版。

## 实现

- 文件夹、Dock、Library 的 × 共用 `hide_stashdock`，调用原生 `window.hide()`；系统 CloseRequested 也先 prevent_close 再 hide。隐藏窗口与任务栏按钮，托盘/进程/bridge 保留。OS 最小化与关闭现在是不同概念。
- 初次启动仍在画布形状准备好后显示文件夹。托盘打开、快捷键、再次启动均沿用恢复原窗口逻辑；只有托盘“退出 StashDock”结束应用。
- 文件夹和圆形 × 是同一个 `floating-folder-surface` 的两个兄弟按钮，共用 hover/press transform；不是在打开按钮中嵌套另一个按钮。鼠标进入 × 时仍保持文件夹 hover。减少动态效果会移除位移/缩放。
- 品牌源为用户提供的 `assets/brand/icon.png`、`icon.svg`、`full.png`；不改源文件。`scripts/generate-icon.ps1` 不再手绘占位图形，保留图标比例和透明底。
- Windows ICO 含 16/20/24/32/40/48/64/128/256 九种尺寸。原生窗口、托盘、安装包和扩展均引用生成的品牌资产。标题栏仍使用原有 full.png；文件夹表面仍使用品牌 SVG。
- 浏览器 favicon 使用同一 SVG 路径，仅随浏览器明暗偏好调整黑/白墨色。Vite 生成带内容 hash 的地址，桌面 bridge 直接提供此资产；不是另加一个图标服务。
- 扩展为 0.1.4，工具栏/扩展管理页/侧栏图标均换成品牌图形，移除字母 S 占位徽章。现有解压扩展需要用户在扩展管理页 Reload；没有擅自重新安装浏览器扩展。
- `npm run assets:brand` 可单独刷新全部派生图标，`prebuild` 保证构建前刷新；无需图像依赖包或联网生成。

## 验证

- 前端 60 项通过；Rust 19 项通过；桌面构建通过 TypeScript 和 Vite 检查。项目无独立 lint 配置。
- ICO 二进制测试核对九个 PNG 的尺寸、偏移、签名以及它们与托盘/扩展 PNG 的字节一致性；SVG 测试核对与用户原 SVG 的路径完全一致。
- Playwright `scripts/verify-window-controls.js`：三个 hover 中间时间点，相对位置误差小于 0.002；hover 到 × 不回弹，reduced-motion 不位移；文件夹关闭不会触发拖拽。
- 同脚本保留 7 次大小切换、失败回滚、动画完成超时恢复和三个形态共用关闭命令的回归。浏览器 native mock 不能证明系统托盘行为。
- 浏览器截图已检查文件夹 ×：`output/playwright/folder-close-hover.png`。
- 新 release 普通启动立即显示文件夹。原生 Tab/Return 激活 × 后工具报告 `window is not a usable app window`，与上一版 minimized 明确不同；主 StashDock 窗口不再可捕获，PID 36556 和 bridge 保留，27 项收藏/13 个预览未变化。
- 隐藏后再次启动：PID 36556、原窗口句柄 4726158 均保持不变，文件夹恢复。系统 Alt+F4 也得到同样隐藏结果，随后恢复原实例。只有代码检查覆盖任务栏按钮隐藏和托盘菜单“退出”；本轮没有对托盘右键菜单做原生点击，不将其写成已实测。
- 隐藏后进程主窗口标题显示的 `app.stashdock.desktop-siw` 是 single-instance 插件的辅助窗，不是残留主界面；核对插件 Windows 源码带 `WS_EX_TOOLWINDOW`，不会形成另一个任务栏按钮。没有为修复关闭而额外创建可见窗口。
- `scripts/verify-brand-browser.js`：六个实际品牌文件加载成功，真实 release `/dock` 的 favicon 地址为 `/assets/favicon-CmcETvS0.svg`，HTTP 返回实际品牌 SVG。截图分别为 `brand-assets-light.png` / `brand-assets-dark.png`；这是品牌资源预览，不是扩展安装后的功能回归。
- 根目录 `stashdock.exe` 已更新且恢复为可见文件夹，SHA256 `0DFB2B12B38024AE408FDEA3642C1AE8CBAA2699119A94A52DFB9201EA58C160`。新安装包为 `artifacts/StashDock_0.2.1_close-brand_x64-setup.exe`，旧程序保存在 `artifacts/stashdock-before-close-brand.exe`。

## Arc 范围 review

- [x] 没有新增或仿制 Arc 组件；沿用现有 foundation 与品牌材质例外，不更改已批准的文件夹几何。
- [x] 新 hover 使用 Arc duration/ease token、单一 transform owner、稳定挂载和 reduced-motion；没有新增发光、外圈或反复入场。
- [x] 关闭按钮真实可键盘访问、独立命名、保留轻量共享 focus token；失败沿用 role=alert。新图标不增加虚假按钮或数据。
- [x] 新图标保持原品牌，尺寸/比例有构建与自动测试约束；普通 UI 不引入额外装饰背景。
- [ ] 文件夹 × 保持 32px 原生桌面目标，不宣称满足触屏 44px；整个扩展的旧 token/字体、其他表单/状态仍需后续 Arc 迁移，不在本次品牌替换中顺便重写。
- [ ] PNG 图标按当前用户提供的黑色版本输出；深色资源预览显示黑色 PNG 在深底对比不足，仅浏览器 SVG 已随偏好反色。原生托盘的独立系统主题适配、扩展深色工具栏变体仍需后续处理，不宣称已经完成所有平台暗色图标适配。
