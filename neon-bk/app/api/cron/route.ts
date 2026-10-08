import { sql } from "@/lib/db";
import { runBackup } from "@/lib/backup";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth =
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` ||
    new URL(req.url).searchParams.get("secret") === process.env.CRON_SECRET;
  if (!auth) return new Response("no", { status: 401 });

  const rows = await sql<any[]>`select id, name from targets where auto`;
  const n = rows.length;
  // fire sequentially to respect Telegram rate limits & memory
  for (const r of rows) await runBackup(r.id);
  return Response.json({ ok: true, scheduled: n });
}
