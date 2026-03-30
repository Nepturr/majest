import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export type DashboardPeriod = "today" | "week" | "month" | "inception";

export interface TopPost {
  id: string;
  shortcode: string;
  caption: string | null;
  thumbnail_url: string | null;
  post_type: string;
  url: string;
  account_handle: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface TopAccount {
  id: string;
  handle: string;
  profile_pic_url: string | null;
  followers: number;
  total_views: number;
  posts_count: number;
  avg_er: number;
}

export interface DailyPoint {
  date: string;
  views: number;
  likes: number;
  engagement: number; // 0–100 %
}

export interface DashboardOverview {
  period: DashboardPeriod;
  // ── Stats ──────────────────────────────────────────────────
  total_posts: number;
  active_accounts: number;
  total_views: number;
  total_views_delta: number | null;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_followers: number;
  avg_engagement_rate: number; // %
  // ── Chart data ─────────────────────────────────────────────
  daily: DailyPoint[];
  // ── Top content ────────────────────────────────────────────
  top_posts: TopPost[];
  top_accounts: TopAccount[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodToIso(period: DashboardPeriod): { start: string | null; prevStart: string | null } {
  const now = new Date();
  if (period === "inception") return { start: null, prevStart: null };
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  const start = new Date(now.getTime() - days * 86_400_000).toISOString();
  const prevStart = new Date(now.getTime() - days * 2 * 86_400_000).toISOString();
  return { start, prevStart };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") ?? "week") as DashboardPeriod;
  const { start, prevStart } = periodToIso(period);

  const admin = createAdminClient();

  // ── 1. Active accounts + latest snapshots ─────────────────────────────────
  const { data: accounts } = await admin
    .from("instagram_accounts")
    .select("id, instagram_handle")
    .eq("status", "active");

  const accountIds = (accounts ?? []).map((a) => a.id);
  const accountHandleMap = new Map((accounts ?? []).map((a: { id: string; instagram_handle: string }) => [a.id, a.instagram_handle]));

  // Guard: skip DB queries if no active accounts
  if (accountIds.length === 0) {
    return NextResponse.json({
      period, total_posts: 0, active_accounts: 0, total_views: 0,
      total_views_delta: null, total_likes: 0, total_comments: 0, total_shares: 0,
      total_followers: 0, avg_engagement_rate: 0, daily: [], top_posts: [], top_accounts: [],
    } satisfies DashboardOverview);
  }

  // Latest account snapshots (followers, total_views)
  const { data: latestSnapRows } = await admin
    .from("instagram_account_snapshots")
    .select("instagram_account_id, followers_count, total_views, collected_at")
    .in("instagram_account_id", accountIds)
    .order("collected_at", { ascending: false })
    .limit(Math.max(accountIds.length * 20, 100));

  const latestSnap = new Map<string, { followers: number; total_views: number }>();
  for (const s of latestSnapRows ?? []) {
    if (!latestSnap.has(s.instagram_account_id)) {
      latestSnap.set(s.instagram_account_id, {
        followers: s.followers_count ?? 0,
        total_views: s.total_views ?? 0,
      });
    }
  }

  const totalFollowers = [...latestSnap.values()].reduce((s, v) => s + v.followers, 0);
  const totalViewsNow = [...latestSnap.values()].reduce((s, v) => s + v.total_views, 0);

  // ── 2. Views delta (vs start of period) ──────────────────────────────────
  let totalViewsDelta: number | null = null;
  if (start) {
    const { data: oldSnapRows } = await admin
      .from("instagram_account_snapshots")
      .select("instagram_account_id, total_views, collected_at")
      .in("instagram_account_id", accountIds)
      .lte("collected_at", start)
      .order("collected_at", { ascending: false })
      .limit(accountIds.length * 5);

    const oldSnap = new Map<string, number>();
    for (const s of oldSnapRows ?? []) {
      if (!oldSnap.has(s.instagram_account_id)) oldSnap.set(s.instagram_account_id, s.total_views ?? 0);
    }
    const totalViewsOld = [...oldSnap.values()].reduce((s, v) => s + v, 0);
    totalViewsDelta = totalViewsNow - totalViewsOld;
  }

  // ── 3. Post-level metrics (likes, comments, shares, views) ────────────────
  // Use latest snapshot per post, optionally filtered by period
  const postQuery = admin
    .from("instagram_posts")
    .select(`
      id, shortcode, caption, thumbnail_url, post_type, url,
      instagram_account_id,
      latest_snapshot:instagram_post_snapshots(
        views_count, plays_count, likes_count, comments_count, shares_count, collected_at
      )
    `)
    .in("instagram_account_id", accountIds)
    .eq("is_active", true)
    .order("shortcode");

  const { data: postsRaw } = await postQuery.limit(2000);

  type PostRow = {
    id: string;
    shortcode: string;
    caption: string | null;
    thumbnail_url: string | null;
    post_type: string;
    url: string;
    instagram_account_id: string;
    latest_snapshot: Array<{
      views_count: number | null;
      plays_count: number | null;
      likes_count: number | null;
      comments_count: number | null;
      shares_count: number | null;
      collected_at: string;
    }>;
  };

  // Get latest snapshot per post
  const posts: Array<PostRow & {
    views: number; likes: number; comments: number; shares: number;
  }> = (postsRaw ?? []).map((p) => {
    const snaps = (p.latest_snapshot ?? []).sort(
      (a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime()
    );
    const s = snaps[0] ?? {};
    return {
      ...(p as PostRow),
      views: s.views_count ?? s.plays_count ?? 0,
      likes: s.likes_count ?? 0,
      comments: s.comments_count ?? 0,
      shares: s.shares_count ?? 0,
    };
  });

  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const totalShares = posts.reduce((s, p) => s + p.shares, 0);

  // Avg engagement rate: (likes + comments) / views * 100
  const erPosts = posts.filter((p) => p.views > 0);
  const avgEngagementRate = erPosts.length > 0
    ? erPosts.reduce((s, p) => s + (p.likes + p.comments) / p.views * 100, 0) / erPosts.length
    : 0;

  // ── 4. Top posts (by views) ────────────────────────────────────────────────
  const top_posts: TopPost[] = [...posts]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      shortcode: p.shortcode,
      caption: p.caption,
      thumbnail_url: p.thumbnail_url,
      post_type: p.post_type,
      url: p.url,
      account_handle: accountHandleMap.get(p.instagram_account_id) ?? "",
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      engagement_rate: p.views > 0 ? (p.likes + p.comments) / p.views * 100 : 0,
    }));

  // ── 5. Top accounts ────────────────────────────────────────────────────────
  // Compute per-account stats from posts
  const accountPostMap = new Map<string, typeof posts>();
  for (const p of posts) {
    if (!accountPostMap.has(p.instagram_account_id)) accountPostMap.set(p.instagram_account_id, []);
    accountPostMap.get(p.instagram_account_id)!.push(p);
  }

  // Latest profile_pic from latest snapshot
  const { data: profilePicRows } = await admin
    .from("instagram_account_snapshots")
    .select("instagram_account_id, profile_pic_url, collected_at")
    .in("instagram_account_id", accountIds)
    .order("collected_at", { ascending: false })
    .limit(accountIds.length * 3);

  const profilePicMap = new Map<string, string | null>();
  for (const r of profilePicRows ?? []) {
    if (!profilePicMap.has(r.instagram_account_id)) profilePicMap.set(r.instagram_account_id, r.profile_pic_url ?? null);
  }

  const top_accounts: TopAccount[] = accountIds
    .map((id) => {
      const ps = accountPostMap.get(id) ?? [];
      const snap = latestSnap.get(id);
      const erPs = ps.filter((p) => p.views > 0);
      return {
        id,
        handle: accountHandleMap.get(id) ?? "",
        profile_pic_url: profilePicMap.get(id) ?? null,
        followers: snap?.followers ?? 0,
        total_views: snap?.total_views ?? 0,
        posts_count: ps.length,
        avg_er: erPs.length > 0
          ? erPs.reduce((s, p) => s + (p.likes + p.comments) / p.views * 100, 0) / erPs.length
          : 0,
      };
    })
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, 8);

  // ── 6. Daily views chart ───────────────────────────────────────────────────
  const chartDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 30;
  const chartStart = new Date(Date.now() - chartDays * 86_400_000).toISOString();

  const { data: snapHistory } = await admin
    .from("instagram_account_snapshots")
    .select("instagram_account_id, total_views, followers_count, collected_at")
    .in("instagram_account_id", accountIds)
    .gte("collected_at", chartStart)
    .order("collected_at", { ascending: true });

  // Group by date (YYYY-MM-DD), sum total_views across accounts (latest per account per day)
  const byDate = new Map<string, Map<string, number>>();
  for (const s of snapHistory ?? []) {
    const date = s.collected_at.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, new Map());
    const dayMap = byDate.get(date)!;
    // Keep latest snapshot per account per day
    dayMap.set(s.instagram_account_id, s.total_views ?? 0);
  }

  // Build daily points with cumulative views
  const sortedDates = [...byDate.keys()].sort();
  let prevDayViews = 0;

  // Also fetch post snapshots for likes for engagement chart
  const { data: postSnapHistory } = await admin
    .from("instagram_post_snapshots")
    .select("post_id, views_count, plays_count, likes_count, comments_count, collected_at")
    .in("post_id", posts.map((p) => p.id))
    .gte("collected_at", chartStart)
    .order("collected_at", { ascending: true });

  // Group post snaps by date
  const postSnapByDate = new Map<string, Array<typeof postSnapHistory extends Array<infer T> | null ? T : never>>();
  for (const s of postSnapHistory ?? []) {
    const date = (s as { collected_at: string }).collected_at.slice(0, 10);
    if (!postSnapByDate.has(date)) postSnapByDate.set(date, []);
    postSnapByDate.get(date)!.push(s as never);
  }

  const daily: DailyPoint[] = sortedDates.map((date) => {
    const dayViews = [...(byDate.get(date)?.values() ?? [])].reduce((s, v) => s + v, 0);
    const viewsDelta = Math.max(0, dayViews - prevDayViews);
    prevDayViews = dayViews;

    const dayPostSnaps = postSnapByDate.get(date) ?? [];
    type PSnap = { views_count?: number | null; plays_count?: number | null; likes_count?: number | null; comments_count?: number | null };
    const dayLikes = (dayPostSnaps as PSnap[]).reduce((s, p) => s + (p.likes_count ?? 0), 0);
    const dayViews2 = (dayPostSnaps as PSnap[]).reduce((s, p) => s + (p.views_count ?? p.plays_count ?? 0), 0);
    const engagement = dayViews2 > 0 ? (dayLikes / dayViews2) * 100 : 0;

    return { date, views: viewsDelta, likes: dayLikes, engagement };
  });

  // ── Result ─────────────────────────────────────────────────────────────────
  const overview: DashboardOverview = {
    period,
    total_posts: posts.length,
    active_accounts: accountIds.length,
    total_views: totalViewsNow,
    total_views_delta: totalViewsDelta,
    total_likes: totalLikes,
    total_comments: totalComments,
    total_shares: totalShares,
    total_followers: totalFollowers,
    avg_engagement_rate: avgEngagementRate,
    daily,
    top_posts,
    top_accounts,
  };

  return NextResponse.json(overview);
}
