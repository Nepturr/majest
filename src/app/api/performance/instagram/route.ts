import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────

export interface IgReel {
  id: string;
  shortcode: string;
  post_type: string;
  url: string;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  latest_snapshot: {
    likes_count: number | null;
    comments_count: number | null;
    views_count: number | null;
    plays_count: number | null;
  } | null;
  views: number | null;
  shares: number | null;
  engagement_rate: number | null;
}

export interface IgAccountData {
  id: string;
  instagram_handle: string;
  profile_pic_url: string | null;
  stats: {
    followers_current: number | null;
    followers_delta: number | null;
    avg_views: number | null;
    avg_likes: number | null;
    avg_comments: number | null;
    total_reels: number;
  };
  followers_history: Array<{ date: string; value: number }>;
  views_history: Array<{ date: string; value: number }>;
  top_reels: IgReel[];
}

export interface IgAvailableAccount {
  id: string;
  instagram_handle: string;
  profile_pic_url: string | null;
}

export interface IgPerformanceResponse {
  available_accounts: IgAvailableAccount[];
  data: Record<string, IgAccountData>;
  period: string;
}

type Period = "today" | "yesterday" | "week" | "month" | "inception";

function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  switch (period) {
    case "today":
      return { start: today, end: now };
    case "yesterday":
      return { start: yesterday, end: today };
    case "week": {
      const w = new Date(today);
      w.setUTCDate(today.getUTCDate() - 7);
      return { start: w, end: now };
    }
    case "month": {
      const m = new Date(today);
      m.setUTCDate(today.getUTCDate() - 30);
      return { start: m, end: now };
    }
    case "inception":
      return { start: new Date(0), end: now };
  }
}

/**
 * GET /api/performance/instagram?period=week&ids=id1,id2
 *
 * Returns multi-account Instagram analytics for the Performance page.
 * Non-admins only see accounts they are assigned to.
 * `ids` is optional — when omitted returns available_accounts only (no data).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();

  // Load caller's profile to determine access scope
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role, assigned_instagram_account_ids")
    .eq("id", user.id)
    .single();

  const isAdmin = callerProfile?.role === "admin";
  const assignedIds: string[] = callerProfile?.assigned_instagram_account_ids ?? [];

  const period = (req.nextUrl.searchParams.get("period") as Period | null) ?? "week";
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const requestedIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { start } = getPeriodRange(period);
  const startIso = start.toISOString();

  // ── 1. Load all available accounts (scoped by role) ────────────
  let accQuery = adminClient
    .from("instagram_accounts")
    .select("id, instagram_handle, status")
    .eq("status", "active")
    .order("instagram_handle");

  if (!isAdmin && assignedIds.length > 0) {
    accQuery = accQuery.in("id", assignedIds);
  } else if (!isAdmin) {
    // No assignments = no accounts visible
    return NextResponse.json({ available_accounts: [], data: {}, period });
  }

  const { data: allAccounts } = await accQuery;
  const availableAccounts = allAccounts ?? [];

  // Fetch latest snapshot profile pics for available accounts
  const availableIds = availableAccounts.map((a) => a.id);
  const { data: latestSnapsForPic } = await adminClient
    .from("instagram_account_snapshots")
    .select("instagram_account_id, profile_pic_url, collected_at")
    .in("instagram_account_id", availableIds)
    .order("collected_at", { ascending: false });

  const picByAccount = new Map<string, string | null>();
  for (const s of latestSnapsForPic ?? []) {
    if (!picByAccount.has(s.instagram_account_id)) {
      picByAccount.set(s.instagram_account_id, s.profile_pic_url ?? null);
    }
  }

  const available_accounts: IgAvailableAccount[] = availableAccounts.map((a) => ({
    id: a.id,
    instagram_handle: a.instagram_handle,
    profile_pic_url: picByAccount.get(a.id) ?? null,
  }));

  // If no specific IDs requested, return only the accounts list
  if (requestedIds.length === 0) {
    return NextResponse.json({ available_accounts, data: {}, period });
  }

  // Restrict requested IDs to available (security)
  const allowedIds = new Set(availableIds);
  const targetIds = requestedIds.filter((id) => allowedIds.has(id));

  if (targetIds.length === 0) {
    return NextResponse.json({ available_accounts, data: {}, period });
  }

  // ── 2. Followers history ───────────────────────────────────────
  const { data: accountSnaps } = await adminClient
    .from("instagram_account_snapshots")
    .select("instagram_account_id, followers_count, total_views, profile_pic_url, collected_at")
    .in("instagram_account_id", targetIds)
    .order("collected_at", { ascending: true });

  type SnapRow = {
    instagram_account_id: string;
    followers_count: number | null;
    total_views: number | null;
    profile_pic_url: string | null;
    collected_at: string;
  };

  // Group snaps by account — limit chart history to reasonable window (last 90)
  const snapsByAccount = new Map<string, SnapRow[]>();
  for (const s of accountSnaps ?? []) {
    const arr = snapsByAccount.get(s.instagram_account_id) ?? [];
    arr.push(s);
    snapsByAccount.set(s.instagram_account_id, arr);
  }

  // ── 3. Top reels ───────────────────────────────────────────────
  const { data: posts } = await adminClient
    .from("instagram_posts")
    .select("id, instagram_account_id, shortcode, url, thumbnail_url, posted_at, post_type, caption")
    .in("instagram_account_id", targetIds)
    .in("post_type", ["Reel", "Video"])
    .order("posted_at", { ascending: false })
    .limit(200);

  const postIds = (posts ?? []).map((p) => p.id);
  type PostSnapRow = { post_id: string; likes_count: number | null; comments_count: number | null; shares_count: number | null; views_count: number | null; plays_count: number | null; collected_at: string };

  let postSnaps: PostSnapRow[] = [];
  if (postIds.length > 0) {
    const { data } = await adminClient
      .from("instagram_post_snapshots")
      .select("post_id, likes_count, comments_count, shares_count, views_count, plays_count, collected_at")
      .in("post_id", postIds)
      .order("collected_at", { ascending: false });
    postSnaps = (data ?? []) as PostSnapRow[];
  }

  const latestPostSnap = new Map<string, PostSnapRow>();
  for (const s of postSnaps) {
    if (!latestPostSnap.has(s.post_id)) latestPostSnap.set(s.post_id, s);
  }

  // ── 4. Assemble per-account data ───────────────────────────────
  const data: Record<string, IgAccountData> = {};

  for (const accountId of targetIds) {
    const snaps = snapsByAccount.get(accountId) ?? [];
    const recentSnaps = snaps.slice(-90); // limit chart data

    const latestSnap = recentSnaps.at(-1) ?? null;
    const followers_current = latestSnap?.followers_count ?? null;

    // Period-start snapshot for delta
    const startSnap = snaps.filter((s) => s.collected_at <= startIso).at(-1) ?? null;
    const followers_delta =
      followers_current != null && startSnap?.followers_count != null
        ? followers_current - startSnap.followers_count
        : null;

    // Keep only the latest snapshot per calendar day to avoid duplicate points
    const latestSnapByDay = new Map<string, SnapRow>();
    for (const s of recentSnaps) {
      latestSnapByDay.set(s.collected_at.split("T")[0], s);
    }
    const dedupedSnaps = [...latestSnapByDay.values()].sort((a, b) =>
      a.collected_at < b.collected_at ? -1 : 1
    );

    const followers_history = dedupedSnaps
      .filter((s) => s.followers_count != null)
      .map((s) => ({ date: s.collected_at.split("T")[0], value: s.followers_count as number }));

    const views_history = dedupedSnaps
      .filter((s) => s.total_views != null)
      .map((s) => ({ date: s.collected_at.split("T")[0], value: s.total_views as number }));

    const profilePic =
      picByAccount.get(accountId) ??
      (recentSnaps.filter((s) => s.profile_pic_url).at(-1)?.profile_pic_url ?? null);

    // Build reels list for this account
    const accountPosts = (posts ?? []).filter((p) => p.instagram_account_id === accountId);

    const reels: IgReel[] = accountPosts
      .map((post) => {
        const snap = latestPostSnap.get(post.id) ?? null;
        const views = snap?.views_count ?? snap?.plays_count ?? null;
        const likes = snap?.likes_count ?? null;
        const comments = snap?.comments_count ?? null;
        const shares = snap?.shares_count ?? null;
        const interactions = (likes ?? 0) + (comments ?? 0);
        const engagement_rate =
          views != null && views > 0 ? (interactions / views) * 100 : null;
        return {
          id: post.id,
          shortcode: post.shortcode,
          post_type: post.post_type as string,
          url: post.url,
          caption: (post as Record<string, unknown>).caption as string | null ?? null,
          thumbnail_url: post.thumbnail_url,
          posted_at: post.posted_at,
          latest_snapshot: snap ? {
            likes_count: snap.likes_count,
            comments_count: snap.comments_count,
            views_count: snap.views_count,
            plays_count: snap.plays_count,
          } : null,
          views,
          shares,
          engagement_rate,
        };
      })
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 30);

    // Aggregate stats
    const reelsWithViews = reels.filter((r) => r.views != null);
    const avg_views =
      reelsWithViews.length > 0
        ? Math.round(reelsWithViews.reduce((s, r) => s + (r.views ?? 0), 0) / reelsWithViews.length)
        : null;
    const reelsWithLikes = reels.filter((r) => r.latest_snapshot?.likes_count != null);
    const avg_likes =
      reelsWithLikes.length > 0
        ? Math.round(reelsWithLikes.reduce((s, r) => s + (r.latest_snapshot?.likes_count ?? 0), 0) / reelsWithLikes.length)
        : null;
    const reelsWithComments = reels.filter((r) => r.latest_snapshot?.comments_count != null);
    const avg_comments =
      reelsWithComments.length > 0
        ? Math.round(reelsWithComments.reduce((s, r) => s + (r.latest_snapshot?.comments_count ?? 0), 0) / reelsWithComments.length)
        : null;

    const handle =
      availableAccounts.find((a) => a.id === accountId)?.instagram_handle ?? accountId;

    data[accountId] = {
      id: accountId,
      instagram_handle: handle,
      profile_pic_url: profilePic,
      stats: {
        followers_current,
        followers_delta,
        avg_views,
        avg_likes,
        avg_comments,
        total_reels: accountPosts.length,
      },
      followers_history,
      views_history,
      top_reels: reels,
    };
  }

  return NextResponse.json({ available_accounts, data, period } satisfies IgPerformanceResponse);
}
