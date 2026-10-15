# Pawsona 代码协作

- 本项目唯一代码主仓库为 `https://github.com/CDE5311-Aug2026/team-6`，默认分支 `main`。后续修改以本仓库最新内容为基础，并按用户要求同步到该仓库；不要同步到旧的个人原型仓库。
- 提交前先获取远程最新 `main` 并保留团队新增内容。当前用户允许直接提交 `main`，不要求新分支。终端没有 GitHub 凭据时，可使用已连接 GitHub 工具同步，提交必须基于远程最新 SHA，禁止 force push。
- 不提交 `.env`、`.env.local`、API Key、账号测试凭据、`node_modules`、`dist`、CLI 缓存和临时截图。OpenAI Key 仅保存在 Supabase Edge Function Secrets。
- 变更后运行相关检查及构建。GitHub Pages 工作流和部署说明应保留。
