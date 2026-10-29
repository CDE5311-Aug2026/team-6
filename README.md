### Live Demo

**Click here to explore our interactive prototype: https://pawsona-team6.vercel.app/**

【链接已更新26.10.28 16：40】添加了today care + 站内request + change用户判断[点这里](https://pawsona-team-6.vercel.app/)

【已更新 26.10.29 00:15】添加了my activity功能 + 加了一些动效 + 做了一个美化版的loading界面 是本地版的链接 <(￣︶￣)↗ **[test prototype](https://pawsona-current-preview.vercel.app/)**



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

## Shared workday scenario and daily patterns

Daily Rhythm now separates owner-confirmed time windows from actual recorded moments. A check appears 75% through an unfulfilled window; it says that no matching record has been found, never that the animal is ill or care was definitely missed. A subsequent record resolves the check and shows its actual time. Daily patterns cover breakfast, lunch/dinner, walks, rest and play. Patterns without explicit time-window fields remain notes until edited.

Typical patterns can ask OpenAI to summarize bounded timing statistics from at most 100 public records in the last seven complete days, with at least three recorded days per activity/time group. Drafts retain source record IDs, editable windows, and require explicit human confirmation. AI wording cannot activate a reminder by itself. Overlapping drafts update the existing confirmed activity rather than silently duplicating reminders.

The workday fixture describes Jessica working away from home while Mum provides daily care. Four six-second MP4 storyboards are reconstructed from existing generated Sunny images and stored in private Supabase Storage. These are labelled simulations, not real camera footage or automatic video detection. The new test accounts and credentials are kept outside this repository. The dedicated replay must not receive the older rolling Sunny seed generator.

The scenario's replay selector demonstrates 09:45, 10:15, 11:45 and 14:30. The app has an in-app notification centre; real background/lock-screen push and camera ingestion are not connected. Choose Live to view actual current-day additions. Normal live views refresh on the existing clock interval. Notification read state currently lasts for the current view.

Apply supabase/shared_care_checked_save.sql before deploying this frontend. Current clients read the shared workspace's updated_at value and use an authenticated, member-checked compare-and-save RPC. Stale writes are rejected with a visible error instead of overwriting another caregiver's data. Shared records refresh while the page is visible (approximately every five seconds), only when no local edit is pending. Chat, drafts and private moments stay out of the shared write. All users must reload the current frontend before the study; the legacy save RPC is retained for compatibility and does not provide the new timestamp guard.

Story now opens on today only. Selecting an empty date shows zero and an empty state; View all recorded days is an explicit separate mode. The decorative time/signal/Wi-Fi/battery bar has been removed, leaving system status to the device and respecting its safe-area inset.

## User-test fixes: activity wording, clips and editing

Routine checks inspect both title and note and conservatively exclude negative, missing, planned, uncertain or question wording before matching the supported English activity labels. This remains a simple rule-based aid, not video recognition or full natural-language understanding. A missing/unrecognized record leaves the caregiver check open.

Main video uploads accept up to 5 MiB (shown as 5 MB in the UI); images and supplementary attachments retain the 2 MiB limit. Larger clips receive trimming/720p guidance before being read or uploaded. Public Samplelib road clips are used only for compatibility QA and are labelled as non-pet footage. Small downloaded videos use self-contained display URLs for WebKit compatibility; cloud saves still contain stable private Storage references, not duplicate video data.

Cancel exits the observation editing session without auto-creating a draft; previously saved records and existing drafts stay intact. Shared member views display roles for every person and format internal username identities as @username rather than exposing Auth implementation emails.

## Pet details and sex metadata

Pet details uses compact name/type/breed/age/sex controls. Each species has eight common breeds plus Mixed breed and Other breed; unlisted existing breeds are kept as custom text. The local SVG breed examples are illustrative and are not inferred from photographs. Choosing a breed keeps an uploaded pet photo; using the breed illustration as the profile image is explicit.

Apply `supabase/pet_profile_sex.sql` before deploying this version. Personal pets store optional `sex` in the existing private workspace JSON; legacy values normalize to Unknown. Shared circles store canonical `pet_sex` constrained to Female/Male/Unknown. The checked-save RPC copies it from owner-authored workspace metadata, and keeps the canonical value for non-owner writes. New circles initialize it from the owner's metadata. Existing records are not assigned a guessed sex. Shared pet species is also read back when switching or refreshing accounts.



## Getting started and single active login (2026-10-29)

New accounts open an optional three-step setup (display name/relationship, optional pet basics, and care goals plus device preferences), followed by a skippable seven-step tour starting on Today. You > Help & getting started contains the help guide, Review getting-started guide and Edit basics & preferences. Existing accounts can open these manually. Setup/guide status and care goals are saved with the account; display/history preferences retain their documented device scope. Quick questions in Ask AI now include routine, records, engagement, handover and vet-note prompts; selecting a prompt only fills the composer.

Apply `supabase/single_active_session.sql` before deploying the frontend. It introduces a private active-session registry keyed by user, claims Auth-issued session IDs using Auth-created timestamps, and never allows an older session to reclaim ownership after a later login or logout. Existing sessions are seeded from the latest Auth session. Authenticated personal/shared/storage access is fenced with restrictive RLS; existing care-group RPC checks are preserved and augmented. Write guards hold a shared registry lock to serialize writes with login takeover. Service-role jobs retain their existing authorization. Existing revision checks remain in place.

The frontend checks the server on cloud access, every five seconds while signed in, and on focus/visibility restoration. A confirmed replacement stops pending sync, closes the workspace, signs out locally, shows an alert, and returns to Log in. Network failure alone does not classify a session as replaced. Background-tab timers may be throttled: server writes are still fenced immediately, while the visible notice is shown on the next check/resume. Previously issued media URLs remain subject to their existing expiry.

The deployed ask-ai function also checks the caller's active session before reading the workspace or consuming quota. Deploy it with its existing explicit Bearer authentication and existing CORS configuration; preserve its prior `verify_jwt=false` setting because it validates the user and current session in the handler.

Validation: TypeScript; automated tests; SQL transactional smoke test of takeover, rejected old-session RPC/direct writes and non-resurrection after logout. UI checks use the deployed preview/production and a dedicated QA account; credentials are not committed. See `supabase/tests/single_active_session.sql` for the rollback-only database test.


## Reversible care completion and Daily Rhythm (2026-10-29)

The recent-completion row and Completed history both expose an accessible checked button to undo a mistaken completion. The care-plan archive also offers Undo completion. Completion is reversible for its author or the primary caregiver; viewers remain read-only. Reopening an accepted assignment restores its accepted status and preserves the event history. Rechecking records a fresh actual completion time.

Daily Rhythm merges independent visible Story observations with view-only task completion markers. Human-completed tasks use completedAt, an activity-specific icon, and Done by attribution. Opening a task marker leads to the care plan, not fabricated Story evidence. Reopening removes only the task-derived marker; independent real observations remain. Linked simulated activity is replaced rather than duplicated, and an explicit undo persists across refreshes and future simulated recordings. Pattern view remains the confirmed routine, separate from actual completion.

Validation: TypeScript and 72 automated tests, including completion/undo/recheck, authorization, simulation override persistence after reminders, actual timestamps, overnight completion, deduplication and independent/private evidence handling.
