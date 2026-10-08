import postgres from "postgres";
import { sql, dec } from "./db";

const TG = `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}`;

export async function tg(method: string, body: any): Promise<any> {
  const r = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function dumpDb(connUrl: string): Promise<{ json: string; tables: number; rows: number }> {
  // Connect with postgres driver; fallback sslmode for Neon/Supabase
  let src: ReturnType<typeof postgres> | null = null;
  try {
    const url = new URL(connUrl);
    const search = new URLSearchParams(url.search);
    if (!search.get("sslmode")) search.set("sslmode", "require");
    url.search = search.toString();
    src = postgres(url.toString(), { max: 1, idle_timeout: 2, connect_timeout: 15, ssl: "require", prepare: false });

    const tabRows = await src<any[]>`
      select table_schema, table_name from information_schema.tables
      where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema')
      order by table_schema, table_name`;

    const out: any[] = [];
    let totalRows = 0;
    for (const t of tabRows) {
      const colRows = await src<any[]>`
        select column_name, data_type from information_schema.columns
        where table_schema=${t.table_schema} and table_name=${t.table_name}
        order by ordinal_position`;
      const cols = colRows.map((c: any) => ({ name: c.column_name, type: c.data_type }));
      const rows = await src.unsafe(`select * from ${src(t.table_schema)}.${src(t.table_name)}`) as any[];
      out.push({ schema: t.table_schema, table: t.table_name, cols, rows });
      totalRows += rows.length;
    }
    return { json: JSON.stringify({ tables: out }), tables: tabRows.length, rows: totalRows };
  } finally {
    if (src) await src.end();
  }
}

export async function runBackup(targetId: number): Promise<void> {
  const [t] = await sql`select id, name, conn from targets where id=${targetId}`;
  if (!t) return;
  try {
    const conn = await dec(t.conn);
    const { json, tables, rows } = await dumpDb(conn);
    const gz = new Bun.Gzip("gzip") as any;
    // Node fallback: use zlib if Bun not present
    let data: Uint8Array;
    let compressKind: string;
    if (typeof Bun !== "undefined" && (Bun as any).gzipSync) {
      data = (Bun as any).gzipSync(new TextEncoder().encode(json));
      compressKind = "bun";
    } else {
      const zlib = require("node:zlib");
      data = zlib.gzipSync(Buffer.from(json, "utf8"));
      compressKind = "node";
    }

    // Telegram document upload (limit ~50MB bot-side)
    const MB = data.byteLength / 1048576;
    const safe = t.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const fn = `${safe}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json.gz`;

    if (MB > 45) {
      await sql`insert into backups(target_id,status,bytes,note) values(${t.id},'failed',${data.byteLength},'Archive too large for Telegram ('||${MB.toFixed(1)}||' MB)')`;
      await tg("sendMessage", { chat_id: process.env.TG_ADMIN_ID, text: `⚠️ ${t.name}: archive is ${MB.toFixed(1)} MB, too large for Telegram (≤50). Use /fullbackup for pg_dump → GitLab.` });
      return;
    }

    // Build multipart/form-data
    const form = new FormData();
    form.append("chat_id", process.env.TG_ADMIN_ID!);
    const caption = `✅ ${t.name} · ${tables} tables · ${rows} rows · ${MB.toFixed(2)} MB · ${compressKind}`;
    form.append("caption", caption);
    const blob = new Blob([data], { type: "application/gzip" });
    form.append("document", blob, fn);

    const r = await fetch(`${TG}/sendDocument`, { method: "POST", body: form as any });
    const ok = r.ok;
    let note: string | undefined;
    if (!ok) {
      try { const j = await r.json(); note = (j as any).description || `HTTP ${r.status}`; } catch { note = `HTTP ${r.status}`; }
    }
    await sql`insert into backups(target_id,status,bytes,note) values(${t.id},${ok ? "ok" : "failed"},${data.byteLength},${note || null})`;
    if (!ok) await tg("sendMessage", { chat_id: process.env.TG_ADMIN_ID, text: `❌ ${t.name} Telegram send failed: ${note}` });
  } catch (e: any) {
    await sql`insert into backups(target_id,status,note) values(${t.id},'failed',${e.message.slice(0, 500)})`;
    await tg("sendMessage", { chat_id: process.env.TG_ADMIN_ID, text: `❌ ${t.name} backup failed: ${e.message}` });
  }
}
