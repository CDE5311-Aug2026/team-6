# GitHub Pages 自动部署

本项目通过 GitHub Actions 在每次推送或合并到 `main` 后运行测试、构建并部署。工作流：`.github/workflows/deploy-pages.yml`。

## 首次启用（仓库管理员操作一次）

1. 打开仓库 Settings → Pages。
2. 将 Build and deployment → Source 设为 **GitHub Actions**。
3. 如需云账号功能，在 Settings → Secrets and variables → Actions → Variables 配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`（仅使用浏览器公开 publishable key）
4. 打开 Actions → Deploy Pawsona to GitHub Pages → Run workflow，选择 `main`。
5. 待 build 和 deploy 均成功后，从 deployment 的 URL 打开网站。

标准项目网址预期为 https://cde5311-aug2026.github.io/team-6/；请以成功部署后的实际 URL 为准。启用前，这不是已上线链接。

仓库目前为私有仓库。组织的 GitHub 套餐及政策必须支持私有仓库使用 Pages；若 Pages 不可用，请由课程组织管理员确认。不要为了部署自行更改仓库可见性。

## 日常更新

将代码推送到 `main`（或将 PR 合并到 `main`），自动部署成功后，同一个网址就会更新。电脑上尚未推送的修改不会同步。构建或测试失败时不发布新版本，可在 Actions 中查看错误并修复。

## 云账号功能

未配置上述 Variables 时，前端仍可构建并提供 Guest 模式，但云账号功能不可用。修改 Variables 后需要重新运行部署。云服务端的来源校验也需要允许最终 Pages origin；部署工作流不会修改数据库、Edge Functions 或其配置。

## 路径

工作流使用 `pnpm build:pages`，资源基址为 `/team-6/`。不要改为普通 `pnpm build`，否则项目子路径下的资源可能无法加载。
