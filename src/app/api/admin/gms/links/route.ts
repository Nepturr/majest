import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

/** GET /api/admin/gms/links
 *  Returns all GetMySocial links with isAssigned flag.
 */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "gms_api_key")
    .single();

  if (!setting?.value) {
    return NextResponse.json({ error: "GetMySocial API key not configured." }, { status: 400 });
  }

  const res = await fetch("https://getmysocial.com/api/v2/links", {
    headers: { "x-api-key": setting.value },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `GMS API error: HTTP ${res.status}` }, { status: 502 });
  }

  const json = await res.json();
  // GMS links are under .data or .links depending on version
  const rawLinks: { _id: string; title?: string; name?: string; url?: string; destination?: string }[] =
    json.data ?? json.links ?? [];

  // Get already-assigned GMS link IDs from our DB
  const { data: assigned } = await adminClient
    .from("instagram_accounts")
    .select("get_my_social_link_id")
    .not("get_my_social_link_id", "is", null);

  const assignedIds = new Set((assigned ?? []).map((r) => r.get_my_social_link_id));

  const links = rawLinks.map((link) => ({
    id: link._id,
    title: link.title ?? link.name ?? link._id,
    url: link.url ?? link.destination ?? null,
    isAssigned: assignedIds.has(link._id),
  }));

  return NextResponse.json({ links });
}
