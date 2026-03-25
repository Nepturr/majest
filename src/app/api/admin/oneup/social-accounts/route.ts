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

  // Fetch all categories
  const catRes = await fetch(
    `https://www.oneupapp.io/api/listcategory?apiKey=${apiKey}`
  );
  const catJson = await catRes.json();
  if (!catRes.ok || catJson.error) {
    return NextResponse.json({ error: "Failed to fetch OneUp categories." }, { status: 502 });
  }

  const categories: { id: number; category_name: string }[] = catJson.data ?? [];

  // Fetch accounts for all categories in parallel
  const categoryAccountLists = await Promise.all(
    categories.map(async (cat) => {
      const res = await fetch(
        `https://www.oneupapp.io/api/listcategoryaccount?apiKey=${apiKey}&category_id=${cat.id}`
      );
      const json = await res.json();
      return {
        category_id: String(cat.id),
        category_name: cat.category_name,
        accounts: (json.data ?? []) as {
          social_network_id: string;
          social_network_name: string;
          social_network_type: string;
        }[],
      };
    })
  );

  // Flatten, filter Instagram only, deduplicate by social_network_id
  const seen = new Set<string>();
  const allInstagramAccounts: {
    social_network_id: string;
    social_network_name: string;
    category_id: string;
    category_name: string;
    is_expired: boolean;
  }[] = [];

  for (const { category_id, category_name, accounts } of categoryAccountLists) {
    for (const acc of accounts) {
      if (acc.social_network_type !== "Instagram") continue;
      if (seen.has(acc.social_network_id)) continue;
      seen.add(acc.social_network_id);
      allInstagramAccounts.push({
        social_network_id: acc.social_network_id,
        social_network_name: acc.social_network_name,
        category_id,
        category_name,
        is_expired: false,
      });
    }
  }

  // Get already-assigned social_network_ids from our DB
  const { data: assigned } = await adminClient
    .from("instagram_accounts")
    .select("oneup_social_network_id")
    .not("oneup_social_network_id", "is", null);

  const assignedIds = new Set((assigned ?? []).map((r) => r.oneup_social_network_id));

  const result = allInstagramAccounts.map((acc) => ({
    ...acc,
    isAssigned: assignedIds.has(acc.social_network_id),
  }));

  return NextResponse.json({ accounts: result });
}
