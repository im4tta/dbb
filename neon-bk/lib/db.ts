import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) throw new Error("DATABASE_URL missing");
export const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5, connect_timeout: 10, ssl: "require" });

const ENC_KEY = process.env.ENC_KEY!;
if (!ENC_KEY || ENC_KEY.length < 32) throw new Error("ENC_KEY must be at least 32 chars");

function key(): CryptoKey {
  const buf = new Uint8Array(32);
  const s = new TextEncoder().encode(ENC_KEY);
  for (let i = 0; i < 32; i++) buf[i] = s[i % s.length] ?? 0;
  return crypto.subtle.importKey("raw", buf, "AES-GCM", false, ["encrypt", "decrypt"]) as any;
}

export async function enc(plain: string): Promise<string> {
  const k = await key();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(plain)));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0); out.set(ct, 12);
  return Buffer.from(out).toString("base64");
}

export async function dec(b64: string): Promise<string> {
  const k = await key();
  const buf = new Uint8Array(Buffer.from(b64, "base64"));
  const iv = buf.subarray(0, 12);
  const ct = buf.subarray(12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, ct));
  return new TextDecoder().decode(pt);
}
