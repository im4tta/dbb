import { sql, enc } from "@/lib/db";
import { runBackup, tg } from "@/lib/backup";
export const maxDuration = 60;

const HELP = `/add <name> <postgres-url>\n/list\n/backup <name|all>  (quick JSON)\n/fullbackup <name|all>  (pg_dump → GitLab)\n/auto <name> on|off\n/remove <name>`;

export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TG_WEBHOOK_SECRET)
    return new Response("no", { status: 401 });
  const m = (await req.json()).message;
  if (!m?.text || String(m.from?.id) !== process.env.TG_ADMIN_ID) return Response.json({ ok: true });
  const say = (text: string) => tg("sendMessage", { chat_id: m.chat.id, text });
  const [cmd, a, b] = m.text.trim().split(/\s+/);
  try {
    if (cmd === "/add" && a && b) {
      await sql`insert into targets(name,conn) values(${a},${enc(b)}) on conflict(name) do update set conn=excluded.conn`;
      await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id });
      await say(`Added "${a}" (auto-backup on). Your message with the URL was deleted.`);
    } else if (cmd === "/list") {
      const r = await sql`select t.name, t.auto, (select status||' '||to_char(created_at,'MM-DD HH24:MI') from backups where target_id=t.id order by id desc limit 1) as last from targets t order by t.id`;
      await say(r.length ? r.map((x) => `${x.name} · auto ${x.auto ? "on" : "off"} · ${x.last ?? "never"}`).join("\n") : "No targets yet.\n" + HELP);
    } else if (cmd === "/backup" && a) {
      const r = a === "all" ? await sql`select id,name from targets` : await sql`select id,name from targets where name=${a}`;
      if (!r.length) { await say("Not found"); return Response.json({ ok: true }); }
      await say(`Backing up ${r.map((x) => x.name).join(", ")}…`);
      for (const x of r) await runBackup(x.id);
    } else if (cmd === "/fullbackup") {
      const r = await fetch(`https://api.github.com/repos/${process.env.GH_REPO}/actions/workflows/pgdump.yml/dispatches`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
        body: JSON.stringify({ ref: "main", inputs: { target: a || "all" } }),
      });
      await say(r.ok ? "Full pg_dump started. I'll message you when it's done." : `GitHub dispatch failed (${r.status})`);
    } else if (cmd === "/auto" && a && b) {
      await sql`update targets set auto=${b === "on"} where name=${a}`; await say(`${a}: auto ${b}`);
    } else if (cmd === "/remove" && a) {
      await sql`delete from targets where name=${a}`; await say(`Removed ${a}`);
    } else await say(HELP);
  } catch (e: any) { await say("Error: " + e.message); }
  return Response.json({ ok: true });
}
