import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────
export interface FunnelAccount {
  id: string;
  instagram_handle: string;
  status: "active" | "inactive";
  niche: string | null;
  model: { id: string; name: string; avatar_url: string | null } | null;
  get_my_social_link_id: string | null;
  of_tracking_link_id: string | null;
  instagram: {
    followers_current: number | null;
    followers_delta: number | null;
    views_current: number | null;   // total views (cumulative latest)
    views_delta: number | null;     // new views during the period
    profile_pic_url: string | null;
    avg_likes: number | null;
    avg_comments: number | null;
    avg_views: number | null;
    avg_plays: number | null;
    total_posts_in_db: number;
  };
  gms: {
    clicks: number;
    unique_visitors: number;
    tier1_pct: number | null;
    is_delta: boolean; // true = delta période, false = total cumulatif (1er snapshot)
  } | null;
  tracking: {
    clicks_delta: number | null;
    subscribers_delta: number | null;
    clicks_total: number;
    subscribers_total: number;
    is_total: boolean; // true = cumul all-time (pas de snapshot antérieur ou période inception)
  } | null;
}

type Period = "today" | "yesterday" | "week" | "month" | "inception";

function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today); yesterday.setUTCDate(today.getUTCDate() - 1);

  switch (period) {
    case "inception":
      // Epoch : retourne forcément tous les snapshots
      return { start: new Date(0), end: now };
    case "today":
      return { start: today, end: now };
    case "yesterday":
      return { start: yesterday, end: today };
    case "week": {
      const dayOfWeek = today.getUTCDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setUTCDate(today.getUTCDate() + diff);
      return { start: monday, end: now };
    }
    case "month": {
      const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { start: firstOfMonth, end: now };
    }
  }
}

/**
 * GET /api/performance/funnel?period=week
 * Reads ALL data from DB — no external API calls.
 * period: today | yesterday | week (default) | month | inception
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = (req.nextUrl.searchParams.get("period") as Period | null) ?? "week";
  const { start, end } = getPeriodRange(period);
  const startIso = start.toISOString();
  const startDate = start.toISOString().split("T")[0]; // YYYY-MM-DD

  const adminClient = createAdminClient();

  // ── 1. Accounts ───────────────────────────────────────────────
  const { data: accounts, error: accErr } = await adminClient
    .from("instagram_accounts")
    .select(`
      id, instagram_handle, status, niche,
      get_my_social_link_id, of_tracking_link_id,
      model:models(id, name, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (accErr || !accounts) {
    return NextResponse.json({ error: accErr?.message ?? "Failed to load accounts" }, { status: 500 });
  }
  if (accounts.length === 0) {
    return NextResponse.json({ accounts: [], models: [], period, start: startIso, end: end.toISOString() });
  }

  const accountIds = accounts.map((a) => a.id);

  // ── 2. Instagram snapshots (latest + period-start) ────────────
  const { data: allSnaps } = await adminClient
    .from("instagram_account_snapshots")
    .select("instagram_account_id, followers_count, profile_pic_url, collected_at")
    .in("instagram_account_id", accountIds)
    .order("collected_at", { ascending: false });

  const latestSnap = new Map<string, { followers_count: number | null; profile_pic_url: string | null }>();
  const periodStartSnap = new Map<string, { followers_count: number | null }>();

  for (const s of allSnaps ?? []) {
    if (!latestSnap.has(s.instagram_account_id)) {
      latestSnap.set(s.instagram_account_id, {
        followers_count: s.followers_count,
        profile_pic_url: s.profile_pic_url,
      });
    }
    // Closest snapshot at or before period start
    if (!periodStartSnap.has(s.instagram_account_id) && s.collected_at <= startIso) {
      periodStartSnap.set(s.instagram_account_id, { followers_count: s.followers_count });
    }
  }

  // ── 3. Post metrics (DB aggregation) ─────────────────────────
  const { data: posts } = await adminClient
    .from("instagram_posts")
    .select("id, instagram_account_id, post_type")
    .in("instagram_account_id", accountIds);

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: postSnaps } = postIds.length > 0
    ? await adminClient
        .from("instagram_post_snapshots")
        .select("post_id, likes_count, comments_count, views_count, plays_count, collected_at")
        .in("post_id", postIds)
        .order("collected_at", { ascending: false })
    : { data: [] as Array<{ post_id: string; likes_count: number | null; comments_count: number | null; views_count: number | null; plays_count: number | null; collected_at: string }> };

  const latestPostSnap = new Map<string, NonNullable<typeof postSnaps>[number]>();
  const periodStartPostSnap = new Map<string, NonNullable<typeof postSnaps>[number]>();
  for (const s of postSnaps ?? []) {
    if (!latestPostSnap.has(s.post_id)) latestPostSnap.set(s.post_id, s);
    // Closest snapshot at or before period start
    if (!periodStartPostSnap.has(s.post_id) && s.collected_at <= startIso) {
      periodStartPostSnap.set(s.post_id, s);
    }
  }

  interface IgAgg {
    total: number;
    sumL: number; cntL: number;
    sumC: number; cntC: number;
    sumV: number; cntV: number;
    sumP: number; cntP: number;
    viewsCurrent: number;   // sum of views from latest snapshots (cumulative)
    viewsAtStart: number;   // sum of views from period-start snapshots
    hasViewData: boolean;
  }
  const igAgg = new Map<string, IgAgg>();
  for (const post of posts ?? []) {
    const snap = latestPostSnap.get(post.id);
    const prevSnap = periodStartPostSnap.get(post.id);
    const a = igAgg.get(post.instagram_account_id) ?? {
      total: 0, sumL: 0, cntL: 0, sumC: 0, cntC: 0,
      sumV: 0, cntV: 0, sumP: 0, cntP: 0,
      viewsCurrent: 0, viewsAtStart: 0, hasViewData: false,
    };
    a.total++;
    if (snap?.likes_count != null) { a.sumL += snap.likes_count; a.cntL++; }
    if (snap?.comments_count != null) { a.sumC += snap.comments_count; a.cntC++; }
    if (snap?.views_count != null) { a.sumV += snap.views_count; a.cntV++; }
    if (snap?.plays_count != null) { a.sumP += snap.plays_count; a.cntP++; }
    // Views delta: use views_count, fallback to plays_count
    const v = snap?.views_count ?? snap?.plays_count;
    if (v != null) {
      a.viewsCurrent += v;
      a.hasViewData = true;
    }
    const vPrev = prevSnap?.views_count ?? prevSnap?.plays_count;
    if (vPrev != null) a.viewsAtStart += vPrev;
    igAgg.set(post.instagram_account_id, a);
  }

  // ── 4. GMS overview snapshots (delta = période) ──────────────
  // On utilise le cumulatif total_clicks et on calcule le delta
  // entre le dernier snapshot et le snapshot au début de la période.
  // C'est la même logique que tracking_link_snapshots.
  const { data: gmsSnaps } = await adminClient
    .from("gms_overview_snapshots")
    .select("instagram_account_id, total_clicks, unique_visitors, tier1_pct, collected_at")
    .in("instagram_account_id", accountIds)
    .order("collected_at", { ascending: false });

  const latestGmsSnap = new Map<string, { total_clicks: number | null; unique_visitors: number | null; tier1_pct: number | null }>();
  const periodStartGmsSnap = new Map<string, { total_clicks: number | null }>();

  for (const row of gmsSnaps ?? []) {
    if (!latestGmsSnap.has(row.instagram_account_id)) {
      latestGmsSnap.set(row.instagram_account_id, {
        total_clicks: row.total_clicks,
        unique_visitors: row.unique_visitors,
        tier1_pct: row.tier1_pct,
      });
    }
    if (!periodStartGmsSnap.has(row.instagram_account_id) && row.collected_at <= startIso) {
      periodStartGmsSnap.set(row.instagram_account_id, { total_clicks: row.total_clicks });
    }
  }

  // ── 5. Tracking link snapshots (latest + period-start delta) ──
  const { data: trackSnaps } = await adminClient
    .from("tracking_link_snapshots")
    .select("instagram_account_id, clicks_count, subscribers_count, collected_at")
    .in("instagram_account_id", accountIds)
    .order("collected_at", { ascending: false });

  const latestTrack = new Map<string, { clicks_count: number; subscribers_count: number }>();
  const periodStartTrack = new Map<string, { clicks_count: number; subscribers_count: number }>();

  for (const s of trackSnaps ?? []) {
    if (!latestTrack.has(s.instagram_account_id)) {
      latestTrack.set(s.instagram_account_id, {
        clicks_count: s.clicks_count,
        subscribers_count: s.subscribers_count,
      });
    }
    if (!periodStartTrack.has(s.instagram_account_id) && s.collected_at <= startIso) {
      periodStartTrack.set(s.instagram_account_id, {
        clicks_count: s.clicks_count,
        subscribers_count: s.subscribers_count,
      });
    }
  }

  // ── 6. Models list (for chips) ────────────────────────────────
  const { data: modelRows } = await adminClient
    .from("models")
    .select("id, name, avatar_url")
    .order("name");

  // ── 7. Assemble ───────────────────────────────────────────────
  const result: FunnelAccount[] = accounts.map((account) => {
    const snap = latestSnap.get(account.id);
    const prevSnap = periodStartSnap.get(account.id);
    const agg = igAgg.get(account.id);
    const gmsLatest = latestGmsSnap.get(account.id);
    const gmsPrev = periodStartGmsSnap.get(account.id);
    const trackLatest = latestTrack.get(account.id);
    const trackPrev = periodStartTrack.get(account.id);

    const followersCurrent = snap?.followers_count ?? null;
    const inception = period === "inception";

    const followersDelta = (followersCurrent != null && prevSnap?.followers_count != null)
      ? followersCurrent - prevSnap.followers_count
      : null;

    // Tracking : si pas de snapshot antérieur, on affiche le total (pas 0)
    const hasPrevTrack = !!(trackLatest && trackPrev);
    const trackClicksDelta = inception || !hasPrevTrack
      ? (trackLatest?.clicks_count ?? null)   // total cumulatif
      : Math.max(0, trackLatest!.clicks_count - trackPrev!.clicks_count);

    const trackSubsDelta = inception || !hasPrevTrack
      ? (trackLatest?.subscribers_count ?? null)
      : Math.max(0, trackLatest!.subscribers_count - trackPrev!.subscribers_count);

    // Views : fallback to total when no period-start data
    const hasViewsDelta = !inception && agg?.hasViewData && agg.viewsAtStart > 0;
    const viewsDeltaVal = hasViewsDelta
      ? Math.max(0, agg!.viewsCurrent - agg!.viewsAtStart)
      : (agg?.hasViewData ? agg.viewsCurrent : null);

    return {
      id: account.id,
      instagram_handle: account.instagram_handle,
      status: account.status as "active" | "inactive",
      niche: account.niche,
      model: account.model as unknown as { id: string; name: string; avatar_url: string | null } | null,
      get_my_social_link_id: account.get_my_social_link_id,
      of_tracking_link_id: account.of_tracking_link_id,
      instagram: {
        followers_current: followersCurrent,
        followers_delta: followersDelta,
        views_current: agg?.hasViewData ? agg.viewsCurrent : null,
        views_delta: viewsDeltaVal,
        profile_pic_url: snap?.profile_pic_url ?? null,
        avg_likes: agg && agg.cntL > 0 ? Math.round(agg.sumL / agg.cntL) : null,
        avg_comments: agg && agg.cntC > 0 ? Math.round(agg.sumC / agg.cntC) : null,
        avg_views: agg && agg.cntV > 0 ? Math.round(agg.sumV / agg.cntV) : null,
        avg_plays: agg && agg.cntP > 0 ? Math.round(agg.sumP / agg.cntP) : null,
        total_posts_in_db: agg?.total ?? 0,
      },
      gms: account.get_my_social_link_id
        ? (() => {
            // Delta période : si pas de snapshot antérieur, on affiche le total cumulatif
            const latestClicks = gmsLatest?.total_clicks ?? null;
            const prevClicks = gmsPrev?.total_clicks ?? null;
            const clicksDelta = (latestClicks != null && prevClicks != null)
              ? Math.max(0, latestClicks - prevClicks)
              : (latestClicks ?? 0); // 1er snapshot : affiche le total
            return {
              clicks: clicksDelta,
              unique_visitors: gmsLatest?.unique_visitors ?? 0,
              tier1_pct: gmsLatest?.tier1_pct ?? null,
              is_delta: prevClicks != null, // indique si c'est un vrai delta ou un total
            };
          })()
        : null,
      tracking: trackLatest != null
        ? {
            clicks_delta: trackClicksDelta,
            subscribers_delta: trackSubsDelta,
            clicks_total: trackLatest.clicks_count,
            subscribers_total: trackLatest.subscribers_count,
            is_total: inception || !hasPrevTrack,
          }
        : null,
    };
  });

  return NextResponse.json({
    accounts: result,
    models: modelRows ?? [],
    period,
    start: startIso,
    end: end.toISOString(),
  });
}
