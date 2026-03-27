import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

/** GET /api/admin/debug — returns raw first items from GMS to inspect field names */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  const { data: gmsKeySetting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "gms_api_key")
    .single();

  const result: Record<string, unknown> = {};

  if (gmsKeySetting?.value) {
    const res = await fetch("https://getmysocial.com/api/v2/links?limit=3", {
      headers: { "x-api-key": gmsKeySetting.value },
    });
    const json = await res.json();
    result.gms_full_response_sample = json;
    const raw = json.data ?? json.links ?? (Array.isArray(json) ? json : null);
    result.gms_first_link_raw = Array.isArray(raw) ? raw[0] : raw;
    result.gms_first_link_all_keys = Array.isArray(raw) && raw[0] ? Object.keys(raw[0]) : [];
    result.gms_response_top_keys = Object.keys(json);
  } else {
    result.gms_error = "No GMS API key configured";
  }

  return NextResponse.json(result);
}
