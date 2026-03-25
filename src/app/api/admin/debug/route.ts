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

/** GET /api/admin/debug — returns raw first items from OneUp & GMS to inspect field names */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  const [oneupKeySetting, gmsKeySetting] = await Promise.all([
    adminClient.from("settings").select("value").eq("key", "oneup_api_key").single(),
    adminClient.from("settings").select("value").eq("key", "gms_api_key").single(),
  ]);

  const result: Record<string, unknown> = {};

  // OneUp: fetch categories then first category's accounts (raw)
  if (oneupKeySetting.data?.value) {
    const apiKey = oneupKeySetting.data.value;
    const catRes = await fetch(`https://www.oneupapp.io/api/listcategory?apiKey=${apiKey}`);
    const catJson = await catRes.json();
    result.oneup_categories_raw = catJson.data?.slice(0, 3) ?? catJson;

    if (catJson.data?.[0]?.id) {
      const accRes = await fetch(`https://www.oneupapp.io/api/listcategoryaccount?apiKey=${apiKey}&category_id=${catJson.data[0].id}`);
      const accJson = await accRes.json();
      result.oneup_first_category_accounts_raw = accJson.data?.slice(0, 5) ?? accJson;
    }

    // Also try listsocialaccounts
    const allRes = await fetch(`https://www.oneupapp.io/api/listsocialaccounts?apiKey=${apiKey}`);
    const allJson = await allRes.json();
    result.oneup_all_social_accounts_raw = allJson.data?.slice(0, 5) ?? allJson;
  } else {
    result.oneup_error = "No OneUp API key configured";
  }

  // GMS: fetch full raw response
  if (gmsKeySetting.data?.value) {
    const res = await fetch("https://getmysocial.com/api/v2/links?limit=3", {
      headers: { "x-api-key": gmsKeySetting.data.value },
    });
    const json = await res.json();
    result.gms_full_response_sample = json; // full response to inspect structure
    const raw = json.data ?? json.links ?? (Array.isArray(json) ? json : null);
    result.gms_first_link_raw = Array.isArray(raw) ? raw[0] : raw;
    result.gms_first_link_all_keys = Array.isArray(raw) && raw[0] ? Object.keys(raw[0]) : [];
    result.gms_response_top_keys = Object.keys(json);
  } else {
    result.gms_error = "No GMS API key configured";
  }

  return NextResponse.json(result);
}
