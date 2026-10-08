import { sql, dec } from "@/lib/db";
import { tg } from "@/lib/backup";

const authed = (r: Request) => r.headers.get("authorization") === `Bearer ${process.env.RUNNER_TOKEN}`;

// Runner fetches targets (connection strings decrypted, sent over HTTPS to the GitHub job only)
export async function GET(req: Request) {
  if (!authed(req)) return new Response("no", { status: 401 });
  const u = new URL(req.url);
  const target = u.searchParams.get("target") || "all";
  const onlyAuto = u.searchParams.get("auto") === "1";
  const r = target === "all"
    ? await sql`select id,name,conn from targets where (${!onlyAuto} or auto)`
    : await sql`select id,name,conn from targets where name=${target}`;
  return Response.json(r.map((x) => ({ id: x.id, name: x.name, conn: dec(x.conn) })));
}

// Runner reports each result
export async function POST(req: Request) {
  if (!authed(req)) return new Response("no", { status: 401 });
  const { id, status, bytes, note } = await req.json();
  const [t] = await sql`select name from targets where id=${id}`;
  if (!t) return Response.json({ ok: false }, { status: 404 });
  await sql`insert into backups(target_id,status,bytes,note) values(${id},${status},${bytes ?? 0},${note || "pg_dump → GitLab"})`;
  await tg("sendMessage", {
    chat_id: process.env.TG_ADMIN_ID,
    text: status === "ok"
      ? `✅ pg_dump ${t.name}: ${((bytes ?? 0) / 1048576).toFixed(2)} MB stored in GitLab`
      : `❌ pg_dump ${t.name} failed: ${note}`,
  });
  return Response.json({ ok: true });
}
