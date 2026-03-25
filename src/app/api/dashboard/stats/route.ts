import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function verifyAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * GET /api/dashboard/stats
 * Real stats for the dashboard: account counts, posts, latest syncs.
 */
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();

  const [
    { count: totalAccounts },
    { count: activeAccounts },
    { count: totalPosts },
    { data: recentSnaps },
  ] = await Promise.all([
    adminClient.from("instagram_accounts").select("*", { count: "exact", head: true }),
    adminClient.from("instagram_accounts").select("*", { count: "exact", head: true }).eq("status", "active"),
    adminClient.from("instagram_posts").select("*", { count: "exact", head: true }),
    adminClient
      .from("instagram_account_snapshots")
      .select("instagram_account_id, followers_count, collected_at")
      .order("collected_at", { ascending: false })
      .limit(50),
  ]);

  // Total followers (sum of latest snapshot per account)
  const latestByAccount = new Map<string, number | null>();
  for (const s of recentSnaps ?? []) {
    if (!latestByAccount.has(s.instagram_account_id)) {
      latestByAccount.set(s.instagram_account_id, s.followers_count);
    }
  }
  const totalFollowers = [...latestByAccount.values()].reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0
  );

  // Accounts synced in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: syncedToday } = await adminClient
    .from("instagram_account_snapshots")
    .select("instagram_account_id", { count: "exact", head: true })
    .gte("collected_at", oneDayAgo);

  return NextResponse.json({
    total_accounts: totalAccounts ?? 0,
    active_accounts: activeAccounts ?? 0,
    total_posts: totalPosts ?? 0,
    total_followers: totalFollowers,
    synced_today: syncedToday ?? 0,
  });
}
