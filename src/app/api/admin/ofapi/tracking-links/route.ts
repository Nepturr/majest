import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

/** GET /api/admin/ofapi/tracking-links?account_id=acct_XXXX
 *  Returns tracking links for a given OF account, with isAssigned flag.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id is required." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "ofapi_api_key")
    .single();

  if (!setting?.value) {
    return NextResponse.json({ error: "OnlyFansAPI key not configured." }, { status: 400 });
  }

  const res = await fetch(
    `https://app.onlyfansapi.com/api/${accountId}/tracking-links`,
    { headers: { Authorization: `Bearer ${setting.value}` } }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: body?.message ?? `OFAPI error: HTTP ${res.status}` },
      { status: 502 }
    );
  }

  const json = await res.json();

  // OFAPI response: { data: { list: [...], hasMore: bool }, _pagination: {...} }
  const rawLinks: {
    id?: number | string;
    campaignName?: string;
    campaignUrl?: string;
    campaignCode?: number;
  }[] = json.data?.list ?? json.data ?? json.tracking_links ?? json ?? [];

  // Get already-assigned tracking link IDs from our DB
  const { data: assigned } = await adminClient
    .from("instagram_accounts")
    .select("of_tracking_link_id")
    .not("of_tracking_link_id", "is", null);

  const assignedIds = new Set((assigned ?? []).map((r) => r.of_tracking_link_id));

  const links = rawLinks.map((link) => {
    const id = String(link.id ?? "");
    const name = link.campaignName ?? id;
    const url = link.campaignUrl ?? null;
    return {
      id,
      name,
      url,
      isAssigned: assignedIds.has(id),
    };
  });

  return NextResponse.json({ links });
}
