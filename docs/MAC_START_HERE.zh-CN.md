# Mac 从这里开始

源码仓库：https://github.com/GaryYang12345/StashDock

**已经基于旧 GitHub 版本做过 Mac 版？** 先读 [MAC_SYNC](MAC_SYNC.zh-CN.md)：它列出自旧基线
`f1995cf` 以来的全部变化、合并方法、Windows 实现与 Apple 建议做法的对照，以及交回审查的方式。
提示词用 [MAC_HANDOFF_PROMPT](MAC_HANDOFF_PROMPT.zh-CN.md) 里的"同步已有 Mac 分支"一段。
下面的步骤用于从零开始。

轻量交接 ZIP 只带提示词、规范、Arc Skill 和精确提交号，不重复携带源码、
Windows 运行时或个人收藏。所有交接资料也在仓库里，不传 ZIP 也可以开始。

1. 在 Mac 上克隆仓库，从交接基线建立迁移分支：

   ```bash
   git clone https://github.com/GaryYang12345/StashDock.git
   cd StashDock
   git switch -c feat/macos-arm64 <sourceCommit>
   ```

   `<sourceCommit>` 取交接包 `BASELINE.json` 中的 `sourceCommit`。没有交接包时，
   从当前 `main` 开始并记下提交号。已发布的 `v0.2.5` 早于文件夹快速搜索和文件夹/面板
   空间交接，不是现行产品的完整基线。
2. 在能访问该目录和终端的本机 GPT/Codex 中打开项目，将
   `docs/MAC_HANDOFF_PROMPT.zh-CN.md` 分隔线后的提示词发给它。
3. 代理先读 `AGENTS.md`、`design.md`、产品/架构文档与
   `docs/MAC_MIGRATION_HANDOFF.zh-CN.md`，再修改。开发规范、Arc Skill、产品 Skill
   都在仓库内，不需要复制 Windows 的个人技能目录或聊天历史。

Mac 需要自行准备 ARM64 Node 24、Rust 和 Xcode Command Line Tools。当前构建入口和
多个原生模块只有 Windows 实现，不能原样在 Mac 构建出完整产品。只做本机测试时不要求
一开始就购买 Apple 开发者账号；公开签名/公证另行处理。

迁移在新分支上进行，保留 Windows 支持；完成后通过 PR 合入同一个仓库。
这不是跨机器的数据同步任务，也不要把 Windows 收藏库放进代码仓库。
