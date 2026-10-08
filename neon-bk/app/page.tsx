import { sql } from "@/lib/db";
import Login from "./login";

const PWD = process.env.ADMIN_PASSWORD || "";

function getCookie(hdr: string | null, k: string): string | undefined {
  return hdr?.split(";").map((s) => s.trim()).find((s) => s.startsWith(k + "="))?.slice(k.length + 1);
}

export default async function Page({ headersPromise }: { headersPromise: Promise<Headers> }) {
  const headers = await headersPromise;
  const auth = getCookie(headers.get("cookie"), "bd_a") === PWD && Boolean(PWD);
  if (!auth) return <Login />;

  const targets = await sql<any[]>`
    select t.id, t.name, t.auto, t.created_at,
      (select status from backups b where b.target_id=t.id order by b.id desc limit 1) as last_status,
      (select to_char(created_at,'YYYY-MM-DD HH24:MI') from backups b where b.target_id=t.id order by b.id desc limit 1) as last_when,
      (select coalesce(bytes,0) from backups b where b.target_id=t.id order by b.id desc limit 1) as last_bytes
    from targets t order by t.name`;

  const recent = await sql<any[]>`
    select to_char(b.created_at,'YYYY-MM-DD HH24:MI') as when,
           t.name, b.status, coalesce(b.bytes,0) as bytes, b.note
    from backups b join targets t on t.id=b.target_id
    order by b.id desc limit 30`;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>🛟 BackupDeck</h1>
        <div style={{ opacity: 0.7 }}>{targets.length} targets · signaled by Telegram bot + cron</div>
      </header>
      <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <h2>Targets</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ background: "#111735", textAlign: "left" }}>
              <th style={{ padding: 10 }}>name</th>
              <th style={{ padding: 10 }}>auto</th>
              <th style={{ padding: 10 }}>last</th>
              <th style={{ padding: 10 }}>when</th>
              <th style={{ padding: 10 }}>size</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #222a4e" }}>
                <td style={{ padding: 10 }}>{t.name}</td>
                <td style={{ padding: 10 }}>{t.auto ? "on" : "off"}</td>
                <td style={{ padding: 10 }}>
                  <span style={{ color: t.last_status === "ok" ? "#7cffb2" : t.last_status === "failed" ? "#ff9aa1" : "#999" }}>
                    {t.last_status ?? "—"}
                  </span>
                </td>
                <td style={{ padding: 10, opacity: 0.8 }}>{t.last_when ?? "—"}</td>
                <td style={{ padding: 10, opacity: 0.8 }}>{t.last_bytes ? `${(t.last_bytes / 1048576).toFixed(2)} MB` : "—"}</td>
              </tr>
            ))}
            {!targets.length && (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", opacity: 0.6 }}>
                No targets yet. Open Telegram → your bot → <code>/add mydb postgres://…</code>
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
      <section style={{ marginTop: 32 }}>
        <h2>Recent runs</h2>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#111735", textAlign: "left" }}>
              <th style={{ padding: 8 }}>when</th>
              <th style={{ padding: 8 }}>target</th>
              <th style={{ padding: 8 }}>status</th>
              <th style={{ padding: 8 }}>size</th>
              <th style={{ padding: 8 }}>note</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #222a4e" }}>
                <td style={{ padding: 8, opacity: 0.7 }}>{r.when}</td>
                <td style={{ padding: 8 }}>{r.name}</td>
                <td style={{ padding: 8, color: r.status === "ok" ? "#7cffb2" : "#ff9aa1" }}>{r.status}</td>
                <td style={{ padding: 8, opacity: 0.8 }}>{r.bytes ? `${(r.bytes / 1048576).toFixed(2)} MB` : "—"}</td>
                <td style={{ padding: 8, opacity: 0.6, maxWidth: 400 }}>{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer style={{ marginTop: 48, opacity: 0.5, fontSize: 12 }}>
        {PWD ? "Logged in. Clear the bd_a cookie to log out." : ""}
      </footer>
    </main>
  );
}
