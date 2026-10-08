"use client";
import { useState } from "react";

export default function Login() {
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  return (
    <main style={{ maxWidth: 380, margin: "10vh auto", padding: 24 }}>
      <h1>🛟 BackupDeck</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          document.cookie = `bd_a=${encodeURIComponent(p)}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
          fetch("/api/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ p }),
          }).then(async (r) => {
            if (r.ok) location.reload();
            else setErr((await r.json()).error || "Wrong password");
          });
        }}
        style={{ display: "grid", gap: 10 }}
      >
        <input
          type="password"
          placeholder="ADMIN_PASSWORD"
          value={p}
          onChange={(e) => setP(e.target.value)}
          autoFocus
          style={{ padding: 10, borderRadius: 8, border: "1px solid #334", background: "#131a3a", color: "inherit" }}
        />
        <button style={{ padding: 10, borderRadius: 8, border: 0, background: "#5b7cfa", color: "white", cursor: "pointer" }}>
          Log in
        </button>
        {err && <div style={{ color: "#ff9aa1", fontSize: 14 }}>{err}</div>}
      </form>
    </main>
  );
}
