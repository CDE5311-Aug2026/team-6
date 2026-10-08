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

The standard build is served from `/` for Vercel. GitHub Pages uses `pnpm build:pages` to serve from `/pawsona-web-prototype/`. Pushes to `main` run the Pages workflow after Pages is set to **GitHub Actions** in the repository settings.

## Workshop path

1. Today → **Worth a closer look**.
2. Afternoon rest → **See supporting moments**.
3. Window rest → **Add your context**.
4. Type or edit a note, choose how Pawsona should treat it, and review before saving.
5. Save, return to Today, reopen the pattern, and use **View or undo** to remove the correction.

Story, Ask AI, Pets, and You are navigable. The prototype uses fixed sample observations and scripted AI copy. Owner context is stored in this browser's local storage, so it survives a refresh on the same device; Undo removes it. No account, camera feed, or AI service is connected.

The project is a working draft. Keep it in the personal repository during the workshop; move approved artifacts into the team's shared deliverables only after review.
