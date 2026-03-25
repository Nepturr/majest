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

/** GET /api/admin/gms/test — Verifies the stored GMS API key works */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "gms_api_key")
    .single();

  if (!row?.value) {
    return NextResponse.json({ error: "No API key configured." }, { status: 400 });
  }

  try {
    const res = await fetch("https://getmysocial.com/api/v2/links?limit=1", {
      headers: { "x-api-key": row.value },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.error?.message ?? `HTTP ${res.status}` },
        { status: 400 }
      );
    }

    const data = await res.json();
    const linkCount: number = data?.meta?.pagination?.totalItems ?? 0;

    return NextResponse.json({ success: true, linkCount });
  } catch {
    return NextResponse.json({ error: "Network error — could not reach GetMySocial." }, { status: 502 });
  }
}
