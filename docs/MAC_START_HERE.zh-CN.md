# Mac 从这里开始

源码仓库：https://github.com/GaryYang12345/StashDock

轻量交接 ZIP 只带提示词、规范、Arc Skill 和精确提交号，不重复携带源码、
Windows 运行时或个人收藏。整个交接资料也保留在仓库里，不传 ZIP 也可以开始。

1. 在 Mac mini M4 上克隆仓库，默认从 Windows 发布基线建立迁移分支：

   ```bash
   git clone https://github.com/GaryYang12345/StashDock.git
   cd StashDock
   git switch -c feat/macos-arm64 v0.2.5
   ```

   若同时收到交接包，以包内 `BASELINE.json` 的 `sourceCommit` 为准替代 tag。
   不要在后续 Windows 开发提交上无意开始迁移。

2. 在能访问该目录和终端的本机 GPT/Codex 中打开项目，将
   `docs/MAC_HANDOFF_PROMPT.zh-CN.md` 分隔线后的提示词发给它。
3. 代理先读 `AGENTS.md`、产品/架构与 Mac 迁移说明，再修改。开发规范、Arc Skill、
   产品 Skill 都已经在仓库内，不需要复制 Windows 的个人技能目录或聊天历史。

Mac 需要自行准备 ARM64 Node 24、Rust 和 Xcode Command Line Tools。
当前构建入口仍有 Windows 专属部分，尚未承诺可以原样在 Mac 编译。
只做本机测试时不要求一开始就购买 Apple 开发者账号；公开签名/公证另行处理。

迁移在新分支上进行，保留 Windows 支持；完成后提交并通过 PR 合入同一个仓库。
这不是跨机器的数据同步任务，也不要把 Windows 收藏库传入代码仓库。
