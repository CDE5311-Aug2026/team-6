### Live Demo

我测试用的链接<(￣︶￣)↗ **[test prototype](https://team-6-main-5.vercel.app/)**

**[Click here to explore our interactive prototype](https://pawsona-team-6.vercel.app/)**

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

Story, Ask AI, Pets, and You are navigable. The prototype uses fixed sample observations and scripted AI copy. Owner context is stored in this browser's local storage, so it survives a refresh on the same device; Undo removes it. No account, camera feed, or AI service is connected.

The project is a working draft. Keep it in the personal repository during the workshop; move approved artifacts into the team's shared deliverables only after review.

## Pawsona – Interactive Web Prototype

Pawsona is an AI-powered pet care application designed
to help pet owners better understand their pets through
personalized observations and insights.
