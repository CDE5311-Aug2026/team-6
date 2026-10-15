### Live Demo

**[Click here to explore our interactive prototype](https://pawsona-team-6.vercel.app/)**

是我测试用的链接（目前最新的是这个）<(￣︶￣)↗ **[test prototype](https://team-6-main-1-2.vercel.app/)**


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

The deployed prototype currently uses Vercel and the standard `pnpm build` command, which serves the app from `/`.

An optional `pnpm build:pages` command is also available for GitHub Pages and uses the `/team-6/` repository path. A GitHub Pages workflow is not currently configured in this repository.

<!-- The standard build is served from `/` for Vercel. GitHub Pages uses `pnpm build:pages` to serve from `/pawsona-web-prototype/`. Pushes to `main` run the Pages workflow after Pages is set to **GitHub Actions** in the repository settings. -->

## Workshop path

1. Today → **Worth a closer look**.
2. Afternoon rest → **See supporting moments**.
3. Window rest → **Add your context**.
4. Type or edit a note, choose how Pawsona should treat it, and review before saving.
5. Save, return to Today, reopen the pattern, and use **View or undo** to remove the correction.

Story, Ask AI, Pets, and You are navigable. Guest mode uses local Luna sample observations and scripted AI copy. With Supabase configured, verified accounts save private pet workspaces to the database and media to a private Storage bucket. Camera feeds and a live AI service are not connected.

The project is a working draft. Keep it in the personal repository during the workshop; move approved artifacts into the team's shared deliverables only after review.

## Pawsona – Interactive Web Prototype

Pawsona is an AI-powered pet care application designed
to help pet owners better understand their pets through
personalized observations and insights.


## Welcome and cloud accounts

Continue as guest opens the existing Luna sample workspace in local storage. Create account and Log in use Supabase email/password authentication; new users must confirm their email. Cloud profiles start empty, are isolated from Guest data, and save private workspaces across devices. Nothing from previous local simulated accounts is automatically uploaded.

Cloud status is shown at the top: Saving, Saved, or Not synced. Save failures preserve edits for explicit retry; revision checks reject stale-device overwrites. Account switching/deletion and care-circle invitations remain disabled in cloud mode. Live AI and real device connections are not implemented.

## Supabase setup

1. Install locked dependencies with pnpm install --frozen-lockfile.
2. Copy .env.example to .env.local and fill in the project URL and public publishable key. Never use a secret/service_role key in a browser environment variable.
3. Apply supabase/migrations/202610150001_personal_workspaces.sql to a fresh project after checking for existing tables.
4. Set Auth Site URL and allowed redirects to your deployed origin. Configure custom SMTP before opening email registration to arbitrary testers; Supabase's built-in email service is restricted.
5. Run pnpm build. VITE_* values are compiled into the static build; rebuild when changing them.

Validation: node --test tests/cloudSync.test.mjs. See supabase/接入与验收.md for integration checks and limits.
