import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type Period = "today" | "week" | "month" | "inception";

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    return new Date(now.getTime() - 7 * 86400_000);
  }
  if (period === "month") {
    return new Date(now.getTime() - 30 * 86400_000);
  }
  return null; // inception = no start bound
}

/** Duration in ms for a given period (null for inception) */
function periodDurationMs(period: Period): number | null {
  if (period === "today") return 86400_000;
  if (period === "week") return 7 * 86400_000;
  if (period === "month") return 30 * 86400_000;
  return null;
}

export interface AccountAnalytics {
  period: Period;
  stats: {
    views_total: number | null;
    views_delta: number | null;
    /** Views delta for the previous period (for % comparison) */
    views_delta_prev: number | null;
    followers_current: number | null;
    followers_delta: number | null;
    /** Followers delta for the previous period */
    followers_delta_prev: number | null;
    /** Sum of daily GMS snapshots for the period. Null for "inception" (no full history). */
    bio_clicks: number | null;
    /** Bio clicks for the previous period */
    bio_clicks_prev: number | null;
    /** True when period = inception and GMS data is unavailable all-time */
    bio_clicks_na: boolean;
    /** All-time cumulative (always available) */
    track_clicks_total: number | null;
    subscribers_total: number | null;
    /** Delta for non-inception periods; same as _total for inception */
    track_clicks_delta: number | null;
    subscribers_delta: number | null;
    revenue_total: number | null;
    /** Revenue for the selected period (delta); null for inception (= revenue_total) */
    revenue_delta: number | null;
    /** Deltas for previous period (for % comparison) */
    track_clicks_delta_prev: number | null;
    subscribers_delta_prev: number | null;
    revenue_delta_prev: number | null;
    ltv: number | null;
    needs_more_data: boolean; // no period-start OFAPI snapshot yet
  };
  followers_history: Array<{ date: string; value: number }>;
  views_history: Array<{ date: string; value: number }>;
  bio_clicks_history: Array<{ date: string; value: number }>;
  country_breakdown: Array<{ country: string; count: number; pct: number }>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const period = (req.nextUrl.searchParams.get("period") ?? "month") as Period;
  const start = periodStart(period);
  const startIso = start?.toISOString() ?? null;

  // Previous period boundaries (null for inception)
  const durationMs = periodDurationMs(period);
  const prevStart = start && durationMs ? new Date(start.getTime() - durationMs) : null;
  const prevStartIso = prevStart?.toISOString() ?? null;

  const adminClient = createAdminClient();

  // ── 1. Account snapshots (followers + total_views history) ──────────────────
  const snapQuery = adminClient
    .from("instagram_account_snapshots")
    .select("followers_count, total_views, collected_at")
    .eq("instagram_account_id", id)
    .order("collected_at", { ascending: true });

  // For history charts always show last 60 data points max
  const { data: accountSnaps } = await snapQuery.limit(60);

  // Deduplicate: keep only the latest snapshot per calendar day
  const latestSnapByDay = new Map<string, typeof accountSnaps extends Array<infer T> | null ? T : never>();
  for (const s of accountSnaps ?? []) {
    latestSnapByDay.set(s.collected_at.slice(0, 10), s);
  }
  const dedupedSnaps = [...latestSnapByDay.values()].sort((a, b) =>
    a.collected_at < b.collected_at ? -1 : 1
  );

  const followers_history = dedupedSnaps
    .filter((s) => s.followers_count != null)
    .map((s) => ({ date: s.collected_at.slice(0, 10), value: s.followers_count as number }));

  const views_history = dedupedSnaps
    .filter((s) => s.total_views != null)
    .map((s) => ({ date: s.collected_at.slice(0, 10), value: s.total_views as number }));

  const latest = accountSnaps?.at(-1) ?? null;
  const followers_current = latest?.followers_count ?? null;
  const views_total = latest?.total_views ?? null;

  // Followers & views deltas — single query per period boundary
  let followers_delta: number | null = null;
  let views_delta: number | null = null;
  let followers_delta_prev: number | null = null;
  let views_delta_prev: number | null = null;

  if (period === "inception") {
    views_delta = views_total;
  } else if (startIso) {
    const { data: snapAtStart } = await adminClient
      .from("instagram_account_snapshots")
      .select("followers_count, total_views")
      .eq("instagram_account_id", id)
      .lte("collected_at", startIso)
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();

    if (followers_current != null && snapAtStart?.followers_count != null) {
      followers_delta = followers_current - snapAtStart.followers_count;
    }
    if (views_total != null && snapAtStart?.total_views != null) {
      views_delta = views_total - snapAtStart.total_views;
    }

    // Previous period delta (requires snapshot at prevStartIso)
    if (prevStartIso && snapAtStart) {
      const { data: snapAtPrevStart } = await adminClient
        .from("instagram_account_snapshots")
        .select("followers_count, total_views")
        .eq("instagram_account_id", id)
        .lte("collected_at", prevStartIso)
        .order("collected_at", { ascending: false })
        .limit(1)
        .single();

      if (snapAtPrevStart?.followers_count != null && snapAtStart.followers_count != null) {
        followers_delta_prev = snapAtStart.followers_count - snapAtPrevStart.followers_count;
      }
      if (snapAtPrevStart?.total_views != null && snapAtStart.total_views != null) {
        views_delta_prev = snapAtStart.total_views - snapAtPrevStart.total_views;
      }
    }
  }

  // ── 2. Bio clicks history (gms_overview_snapshots.total_clicks per day) ─────
  // Fetch from prevStartIso so we can compute previous period comparison too
  const gmsQueryBuilder = adminClient
    .from("gms_overview_snapshots")
    .select("total_clicks, collected_at")
    .eq("instagram_account_id", id)
    .order("collected_at", { ascending: true });

  const { data: gmsSnaps } = await (prevStartIso
    ? gmsQueryBuilder.gte("collected_at", prevStartIso)
    : gmsQueryBuilder.limit(120));

  // Deduplicate GMS by day too
  const latestGmsByDay = new Map<string, { total_clicks: number | null; collected_at: string }>();
  for (const s of gmsSnaps ?? []) {
    latestGmsByDay.set(s.collected_at.slice(0, 10), s);
  }
  const dedupedGms = [...latestGmsByDay.values()].sort((a, b) =>
    a.collected_at < b.collected_at ? -1 : 1
  );

  const bio_clicks_history = dedupedGms
    .filter((s) => s.total_clicks != null)
    .map((s) => ({ date: s.collected_at.slice(0, 10), value: s.total_clicks as number }));

  // GMS bio clicks: only available for non-inception periods (we don't have full historical data).
  // For inception, we can't know the true all-time total → mark as N/A.
  const bio_clicks_na = period === "inception";
  let bio_clicks: number | null = null;
  let bio_clicks_prev: number | null = null;
  if (!bio_clicks_na && startIso) {
    bio_clicks = (gmsSnaps ?? [])
      .filter((s) => s.total_clicks != null && s.collected_at >= startIso)
      .reduce((s, d) => s + (d.total_clicks ?? 0), 0) || null;

    if (prevStartIso) {
      bio_clicks_prev = (gmsSnaps ?? [])
        .filter((s) => s.total_clicks != null && s.collected_at >= prevStartIso && s.collected_at < startIso)
        .reduce((s, d) => s + (d.total_clicks ?? 0), 0) || null;
    }
  }

  // ── 3. Country breakdown (latest snapshot with data) ───────────────────────
  const { data: latestGms } = await adminClient
    .from("gms_overview_snapshots")
    .select("country_breakdown")
    .eq("instagram_account_id", id)
    .not("country_breakdown", "is", null)
    .order("collected_at", { ascending: false })
    .limit(1)
    .single();

  let country_breakdown: Array<{ country: string; count: number; pct: number }> = [];
  const rawCountries = latestGms?.country_breakdown as Array<{ country: string; count: number }> | null;
  if (rawCountries?.length) {
    const total = rawCountries.reduce((s, c) => s + c.count, 0);
    const sorted = [...rawCountries].sort((a, b) => b.count - a.count);
    const top5 = sorted.slice(0, 5);
    const othersCount = sorted.slice(5).reduce((s, c) => s + c.count, 0);
    country_breakdown = [
      ...top5.map((c) => ({ country: c.country, count: c.count, pct: total > 0 ? Math.round((c.count / total) * 100) : 0 })),
      ...(othersCount > 0 ? [{ country: "Other", count: othersCount, pct: total > 0 ? Math.round((othersCount / total) * 100) : 0 }] : []),
    ];
  }

  // ── 4. OFAPI tracking (all-time totals) ────────────────────────────────────
  const { data: latestTracking } = await adminClient
    .from("tracking_link_snapshots")
    .select("clicks_count, subscribers_count, revenue_total")
    .eq("instagram_account_id", id)
    .order("collected_at", { ascending: false })
    .limit(1)
    .single();

  const track_clicks_total = latestTracking?.clicks_count ?? null;
  const subscribers_total = latestTracking?.subscribers_count ?? null;
  const revenue_total = latestTracking?.revenue_total ?? null;
  const ltv =
    revenue_total != null && subscribers_total != null && subscribers_total > 0
      ? Math.round((revenue_total / subscribers_total) * 100) / 100
      : null;

  // OFAPI delta for non-inception periods
  let track_clicks_delta: number | null = null;
  let subscribers_delta: number | null = null;
  let revenue_delta: number | null = null;
  let track_clicks_delta_prev: number | null = null;
  let subscribers_delta_prev: number | null = null;
  let revenue_delta_prev: number | null = null;
  let needs_more_data = false;

  if (period === "inception") {
    track_clicks_delta = track_clicks_total;
    subscribers_delta = subscribers_total;
    revenue_delta = revenue_total;
  } else if (startIso && track_clicks_total != null) {
    const { data: trackingAtStart } = await adminClient
      .from("tracking_link_snapshots")
      .select("clicks_count, subscribers_count, revenue_total")
      .eq("instagram_account_id", id)
      .lte("collected_at", startIso)
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();

    if (trackingAtStart) {
      track_clicks_delta = Math.max(0, track_clicks_total - trackingAtStart.clicks_count);
      subscribers_delta = Math.max(0, subscribers_total! - trackingAtStart.subscribers_count);
      revenue_delta = revenue_total != null && trackingAtStart.revenue_total != null
        ? Math.max(0, revenue_total - trackingAtStart.revenue_total)
        : null;

      // Previous period comparison
      if (prevStartIso) {
        const { data: trackingAtPrevStart } = await adminClient
          .from("tracking_link_snapshots")
          .select("clicks_count, subscribers_count, revenue_total")
          .eq("instagram_account_id", id)
          .lte("collected_at", prevStartIso)
          .order("collected_at", { ascending: false })
          .limit(1)
          .single();

        if (trackingAtPrevStart) {
          track_clicks_delta_prev = Math.max(0, trackingAtStart.clicks_count - trackingAtPrevStart.clicks_count);
          subscribers_delta_prev = Math.max(0, trackingAtStart.subscribers_count - trackingAtPrevStart.subscribers_count);
          revenue_delta_prev = trackingAtStart.revenue_total != null && trackingAtPrevStart.revenue_total != null
            ? Math.max(0, trackingAtStart.revenue_total - trackingAtPrevStart.revenue_total)
            : null;
        }
      }
    } else {
      needs_more_data = true; // no snapshot before period start yet
    }
  }

  const analytics: AccountAnalytics = {
    period,
    stats: {
      views_total,
      views_delta,
      views_delta_prev,
      followers_current,
      followers_delta,
      followers_delta_prev,
      bio_clicks,
      bio_clicks_prev,
      bio_clicks_na,
      track_clicks_total,
      subscribers_total,
      track_clicks_delta,
      subscribers_delta,
      revenue_total,
      revenue_delta,
      track_clicks_delta_prev,
      subscribers_delta_prev,
      revenue_delta_prev,
      ltv,
      needs_more_data,
    },
    followers_history,
    views_history,
    bio_clicks_history,
    country_breakdown,
  };

  return NextResponse.json(analytics);
}
