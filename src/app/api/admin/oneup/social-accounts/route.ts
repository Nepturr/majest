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

/** GET /api/admin/oneup/social-accounts
 *  Returns all Instagram social accounts from OneUp (across all categories),
 *  deduplicated by social_network_id, with isAssigned flag.
 */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "oneup_api_key")
    .single();

  if (!setting?.value) {
    return NextResponse.json({ error: "OneUp API key not configured." }, { status: 400 });
  }

  const apiKey = setting.value;

  // Use listsocialaccounts — returns ALL connected accounts with social_account_id
  const res = await fetch(
    `https://www.oneupapp.io/api/listsocialaccounts?apiKey=${apiKey}`
  );
  const json = await res.json();
  if (!res.ok || json.error) {
    return NextResponse.json({ error: "Failed to fetch OneUp accounts." }, { status: 502 });
  }

  const allAccounts: {
    username: string;
    social_account_id: string;
    full_name: string;
    is_expired: number;
    social_network_type: string;
    need_refresh: boolean;
  }[] = json.data ?? [];

  // Filter Instagram only
  const instagramAccounts = allAccounts.filter(
    (a) => a.social_network_type?.toLowerCase() === "instagram"
  );

  // Get already-assigned IDs from our DB
  const { data: assigned } = await adminClient
    .from("instagram_accounts")
    .select("oneup_social_network_id")
    .not("oneup_social_network_id", "is", null);

  const assignedIds = new Set((assigned ?? []).map((r) => r.oneup_social_network_id));

  const result = instagramAccounts.map((acc) => ({
    social_network_id: acc.social_account_id,
    social_network_name: acc.username,
    category_id: "",         // not available from listsocialaccounts
    category_name: acc.full_name ?? "",
    is_expired: acc.is_expired === 1,
    isAssigned: assignedIds.has(acc.social_account_id),
  }));

  return NextResponse.json({ accounts: result });
}
