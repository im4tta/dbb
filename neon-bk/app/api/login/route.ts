export async function POST(req: Request) {
  const { p } = await req.json();
  if (p !== process.env.ADMIN_PASSWORD)
    return Response.json({ error: "Wrong password" }, { status: 401 });
  return Response.json({ ok: true });
}
