import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

/** GET /api/admin/apify/test
 *  Vérifie la clé Apify en appelant GET /v2/users/me
 *  Retourne : { ok: true, username, plan, actorRunsCount }
 */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "apify_api_key")
    .single();

  const apiKey = setting?.value;
  if (!apiKey) {
    return NextResponse.json({ error: "Apify API key not configured." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${apiKey}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.error?.message ?? `Apify returned ${res.status}.` },
        { status: 400 }
      );
    }

    const body = await res.json();
    const user = body?.data ?? body;

    return NextResponse.json({
      ok: true,
      username: user.username ?? null,
      plan: user.plan ?? null,
      actorRunsCount: user.profile?.actorRunsCount ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach Apify API." }, { status: 500 });
  }
}
