# Ask AI：文字与图片测试版

实现位于 `src/askAI.ts`、`src/App.tsx` 和 `supabase/functions/ask-ai/`。工作文件留在当前课程目录，尚未放入团队 confirmed deliverables。

## 已实现的范围

- 登录账号发送文字和单张图片，可连续追问。
- 图片支持 JPEG、PNG、WebP，每张最多 1 MB；不支持视频或语音。
- 每次给模型最近 19 条消息，保留其中最近 3 张图片；完整聊天继续保存在当前宠物 workspace。
- 只读取已同步到数据库的当前宠物基本资料；不读取其他宠物、摄像头或历史行为记录。
- 后端使用 OpenAI Responses API，默认 `gpt-4.1-mini`，可通过后台 `OPENAI_MODEL` 调整。`store:false` 关闭 Response 的应用状态存储，不代表零数据保留。
- 回答完成后整体显示；本版未做逐字流式输出。
- 等待提示、防重复发送、失败保留文字及附件，再点发送重试。
- 成功的问答沿用当前 workspace 云同步和 revision 冲突保护。失败的输入仅在当前界面保留。
- 切换账号/宠物会取消前端等待，避免把回复写入其他宠物；已发出的模型请求可能仍产生用量。
- Guest 只可查看历史，不会使用项目 Key 发起请求。

## 需要的配置

在 Pawsona 项目的 Supabase Dashboard → Edge Functions → Secrets 中设置：

- `OPENAI_API_KEY`：从 OpenAI API 平台创建的项目 Key。不要发到聊天、放入 `VITE_*`、提交 Git 或写入数据库。
- `OPENAI_MODEL`：可选，默认 `gpt-4.1-mini`。账号需有该模型的 API 访问权限及可用计费额度。
- `ASK_AI_ALLOWED_ORIGINS`：可选，逗号分隔的前端 Origin；设置后覆盖默认清单。默认包含现有 Pawsona 预览域名与 localhost 5173、127.0.0.1:5173/5178/5179。

Secrets 页面： https://supabase.com/dashboard/project/efihvahumvqyaumdqpcy/functions/secrets

后端 `ask-ai` 已部署到当前 Pawsona 项目。函数内部用 `auth.getUser(token)` 验证真实用户，随后按已验证的用户 ID 读取 workspace 并核实 pet ID。网关 `verify_jwt=false` 仅用于兼容当前项目认证，绝不表示匿名可调用。

限流复用已有 service-role-only 的 `pawsona_signup_quota` 原子计数函数，使用独立 `ask:user:<uid>` / `ask:global` 前缀；每用户每小时 30 次，全项目每小时 200 次。按自然小时重置，限制的是请求次数而非美元消费；调用失败可能消耗请求次数。注册计数不受 AI 计数影响。没有新增表或修改数据库结构。

## 验收

1. 登录，保存一个真实宠物资料，等待顶部显示 Saved。
2. Ask AI 发文字问题，确认出现等待提示及真实回复。
3. 上传 JPG/PNG/WebP，询问图片里可见的情况；继续问“还有什么值得观察？”。
4. 刷新后确认聊天及图片恢复；切换宠物确认记录隔离。
5. Key 缺失、网络中断、模型限流时，确认不生成模拟回答，文字和附件保留供重试。
6. 不把 AI 输出自动存为主人记录、健康事实或行为趋势。

自动检查：`node --test tests/*.test.mjs`，包含处理器的身份、宠物访问、限流、图片校验与 OpenAI 错误处理测试。构建：`npm run build`。
浏览器流程脚本 `tests/ask-ui.local.mjs` 使用模拟的 Auth、Storage、数据库与模型返回值，不是实际模型质量测试。

真实 OpenAI 端到端测试需在 Key 配置后完成。前端与后端源码同步在 CDE5311-Aug2026/team-6。前端上线取决于仓库部署配置及 GitHub Actions / Vercel 的实际结果。

## 2026-10-15 真实 API 验证

用户配置 OPENAI_API_KEY 后，使用独立 QA 身份和人工绘制的图片完成三次真实调用，均返回 HTTP 200：

1. 文字：正确读取测试宠物名称 Milo。
2. 图片：正确识别测试图中的红色圆形与蓝色正方形。
3. 多轮追问：正确复述首条消息中的测试口令。

脚本：`tests/ask-real.local.mjs`。测试没有读取 Key，也没有使用用户的真实宠物资料或照片。测试 workspace 已清理，Auth 内保留一条 `qa_ai_` 前缀的测试账号。本地预览已验证真实对话；线上可用性以对应部署结果为准。
