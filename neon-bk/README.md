# BackupDeck
Next.js + Neon + Telegram. Back up any Postgres (Neon, Supabase…) manually or on a schedule; files land in your Telegram chat.

## Setup
1. Create a Neon project, run `schema.sql` in its SQL editor, copy the connection string to `DATABASE_URL`.
2. Create a bot with @BotFather; get your numeric user id (e.g. @userinfobot) for `TG_ADMIN_ID`.
3. Copy `.env.example` values into Vercel project env vars, then deploy (`vercel --prod`).
4. Point the bot at your deployment:
```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-app>.vercel.app/api/telegram" -d "secret_token=<TG_WEBHOOK_SECRET>"
```
5. In Telegram: `/add mydb postgres://user:pass@host/db`, then `/backup mydb`.

Auto-backup runs daily at 20:00 UTC (= 03:00 Phnom Penh), edit `vercel.json` to change.
Supabase: use the direct or pooler (session mode) connection string.

## Limits (v1)
- Exports data as gzipped JSON (+ column types), not a full pg_dump. Schema DDL, functions and RLS policies are not included.
- Whole DB is loaded in memory and must stay under 50 MB compressed (Telegram bot limit).
- Single admin, connection strings stored AES-256-GCM encrypted.

## Full pg_dump → GitLab (v2)
`/fullbackup name|all` triggers `.github/workflows/pgdump.yml`, which runs a real `pg_dump -Fc` (schema, functions, indexes + data), uploads it to your GitLab Package Registry (keeps newest 7 per target), and reports back to Telegram and the dashboard. It also runs nightly for targets with auto on (this replaces the Vercel cron).

GitHub repo secrets: `APP_URL`, `RUNNER_TOKEN`, `GITLAB_URL`, `GITLAB_PROJECT_ID`, `GITLAB_TOKEN` (project token, Maintainer, `api`).
Vercel env: `RUNNER_TOKEN`, `GH_REPO`, `GH_TOKEN`.
Restore: `pg_restore --no-owner -d "<url>" file.dump`. Use direct (non-pooler) connection strings; Supabase pooler in transaction mode breaks pg_dump.
