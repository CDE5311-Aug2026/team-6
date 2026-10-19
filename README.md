### Live Demo

**Click here to explore our interactive prototype: https://pawsona-team6.vercel.app/**

修改了story部分的新连接:补齐时间线，并在对应时间到达后逐步显示（通过提前预设未来一周活动来模拟）+ 通过日历会看以前的记录 [点这里](https://pawsona-team-6.vercel.app/)

【链接已更新26.10.18 00：15】是我测试用的链接 <(￣︶￣)↗ **[test prototype](https://pawsona-current-preview.vercel.app/)**

  1.目前settings里面加了关联邮箱的功能 但因为要进行设置的东西有点多我怕改坏了先搁置了 目前这块用不了

  2.优化了story页面中时间轴和日历功能的显示方式

  3.尝试增加了每日/常态时间轴的功能 目前只是做了个非常潦草的大概（跟c老师聊让它美化这个可真是让我恼火。。。并且怕做坏了只是加了一个卡片 之后可以改~


The prototype is deployed on Vercel and can be accessed
directly through any web browser without installation.

# Pawsona browser prototype

An interactive front-end draft for the CDE5311 Week 8 vibe-coding workshop. It follows the team's selected Pawsona palette and fonts and is based on the [Pawsona Figma prototype](https://www.figma.com/design/dlI1dj58oG7WTraYQc9bIp/Pawsona-Interim-Prototype--Copy-).

## Run locally

Requires Node.js 20.19+ and pnpm (or npm).

```bash
pnpm install
pnpm dev
```

Open the local address printed by Vite. To check the production build:

```bash
pnpm build
```

GitHub Pages automatic deployment has been removed. Pushing to `main` does not trigger a Pages deployment.

## Workshop path

1. Today → **Worth a closer look**.
2. Afternoon rest → **See supporting moments**.
3. Window rest → **Add your context**.
4. Type or edit a note, choose how Pawsona should treat it, and review before saving.
5. Save, return to Today, reopen the pattern, and use **View or undo** to remove the correction.

Story, Ask AI, Pets, and You are navigable. Guest mode uses local Luna sample observations and scripted AI copy. With Supabase configured, verified accounts save private pet workspaces to the database and media to a private Storage bucket. Ask AI supports authenticated text and photo conversations through the `ask-ai` Edge Function. Camera feeds are not connected.

The project is a working draft. Keep it in the personal repository during the workshop; move approved artifacts into the team's shared deliverables only after review.

## Pawsona – Interactive Web Prototype

Pawsona is an AI-powered pet care application designed
to help pet owners better understand their pets through
personalized observations and insights.


## Welcome and cloud accounts

Continue as guest opens the existing Luna sample workspace in local storage. Create account and Log in use a username and password. Usernames are case-insensitive and contain 3–24 ASCII letters, digits or underscores. A rate-limited Edge Function creates an internal Auth identifier; no real email is collected or sent. Passwords remain managed by Supabase Auth. Cloud profiles start empty, are isolated from Guest data, and save private workspaces across devices. Nothing from previous local simulated accounts is automatically uploaded.

Cloud status appears inside the phone: Saving, Saved, or Not synced. Successful saves dismiss after 2.5 seconds; errors remain available for retry. Save failures preserve edits for explicit retry; revision checks reject stale-device overwrites. Account switching/deletion and care-circle invitations remain disabled in cloud mode. Ask AI supports text and photos after server-side OPENAI_API_KEY configuration. Real device connections are not implemented.

## Supabase setup

1. Install locked dependencies with pnpm install --frozen-lockfile.
2. Copy .env.example to .env.local and fill in the project URL and public publishable key. Never use a secret/service_role key in a browser environment variable.
3. Apply supabase/migrations/202610150001_personal_workspaces.sql to a fresh project after checking for existing tables.
4. Deploy supabase/functions/register-username with its shared username helper and server-side quota migration. This pre-login endpoint validates the project publishable API key itself, restricts the operation to username registration, and applies server-side limits. Admin credentials stay in the Edge Function environment. SMTP is not required for username accounts; password recovery is not implemented.
5. Run pnpm build. VITE_* values are compiled into the static build; rebuild when changing them.

Validation: node --test tests/cloudSync.test.mjs. See supabase/接入与验收.md for integration checks and limits.

## Ask AI: text and photos

See [接入与验收](supabase/Ask_AI_接入与验收.md) for server-side secrets, limits, and test steps. Never put an OpenAI key in VITE_* variables.

## User-test scope: bounded history, routine and settings

Ask AI reads a server-verified pet workspace. For care-circle pets it re-checks current membership and uses the canonical shared workspace. Each request includes at most 28 public Story text records from the previous rolling 7 days, 8 linked owner contexts, 5 confirmed patterns and 5 explicitly permitted recent/ongoing life events, with a hard 12,000-character serialized extract limit. Private/hidden/future moments and historical media are excluded. There is no growing AI memory or extra summarization API call: the extract is assembled deterministically, and up to 12 chat turns are sent (1,500 characters per earlier turn; the current question retains up to 4,000). The model must acknowledge partial coverage and cite dates/titles. This bounds model input, not the size of the existing JSON workspace read from the database. A larger future product would need dated database rows/indexes rather than one workspace payload.

Today > Pattern summarizes recorded activity clock times from the last 7 complete local days, using at most 100 records. It requires at least 8 records across 3 days and only lists meal/walk/rest/play groups recorded on at least 3 days. It identifies simulated data, does not infer duration or diagnose health, and does not automatically create owner-confirmed knowledge.

Settings now explains actual data handling, provides a per-browser future-request history switch, downloads the current pet workspace as JSON (without bundled media), and offers larger reading text, reduced motion, help, and local feedback drafts/downloads. Feedback is not transmitted automatically. Full account deletion, email association and automatic captions remain unavailable and are stated explicitly. Preferences are device-local; they do not delete previously shared chat content.
