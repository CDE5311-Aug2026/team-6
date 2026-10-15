# Typical pattern suggestions

- AI checks the latest run of consecutive Singapore calendar dates with at least one shared, non-empty, valid dated Story observation per date. Seven records on one date do not qualify. A missing date breaks the run; private records and future timestamps do not count.
- At seven dates, the latest seven dates are analyzed automatically when the Primary caregiver opens Pets or Typical patterns, after cloud sync completes. This is an in-app trigger, not an overnight/background scheduled job.
- Records are hashed consistently in the browser and Edge Function. An unchanged successful analysis is saved in `workspace.patternAnalysis` and is not charged again on page reload. Requests in progress are shared across navigation. New or edited observations trigger a new analysis. Failed calls expose an explicit retry.
- Below seven dates, the app shows the current streak, asks for more daily records and offers manual entry. Manual entry is always available to the Primary caregiver.
- The authenticated `patterns-ai` Edge Function loads only the caller's persisted pet. It checks the seven-day gate and fingerprint independently, caps request size, limits analysis to 300 observations and reuses the atomic quota primitive (6 analyses per user/hour, 60 globally/hour).
- OpenAI receives bounded text observations, permitted life/care context and existing protected patterns. Images and credentials are not sent. Responses use structured output, with up to three suggestions; each needs valid record IDs covering at least three distinct dates. Weak evidence can yield zero suggestions.
- AI candidates have `status: suggested`, `source: ai`, `sourceFingerprint` and `recordIds`. They are excluded from confirmed knowledge until the caregiver confirms. Editing sets `userEdited`; automatic refresh preserves edits, manual entries, confirmed, archived and dismissed items. Unedited candidates can be replaced by a new analysis.
- The latest day can be partial. Seven dates are a minimum evidence gate, not proof of a complete behavioral baseline or continuous monitoring. Suggestions display supporting notes and require owner review.

Deployment: deploy `supabase/functions/patterns-ai` with the existing `OPENAI_API_KEY`; `OPENAI_MODEL` defaults to `gpt-4.1-mini`. The handler validates the bearer token using `Auth.getUser`, as documented in `supabase/config.toml`.
