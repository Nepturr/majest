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

export interface AccountAnalytics {
  period: Period;
  stats: {
    views_total: number | null;
    views_delta: number | null;
    followers_current: number | null;
    followers_delta: number | null;
    /** Sum of daily GMS snapshots for the period. Null for "inception" (no full history). */
    bio_clicks: number | null;
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

  const adminClient = createAdminClient();

  // ── 1. Account snapshots (followers + total_views history) ──────────────────
  const snapQuery = adminClient
    .from("instagram_account_snapshots")
    .select("followers_count, total_views, collected_at")
    .eq("instagram_account_id", id)
    .order("collected_at", { ascending: true });

  // For history charts always show last 60 data points max
  const { data: accountSnaps } = await snapQuery.limit(60);

  const followers_history = (accountSnaps ?? [])
    .filter((s) => s.followers_count != null)
    .map((s) => ({ date: s.collected_at, value: s.followers_count as number }));

  const views_history = (accountSnaps ?? [])
    .filter((s) => s.total_views != null)
    .map((s) => ({ date: s.collected_at, value: s.total_views as number }));

  const latest = accountSnaps?.at(-1) ?? null;
  const followers_current = latest?.followers_count ?? null;
  const views_total = latest?.total_views ?? null;

  // Followers delta
  let followers_delta: number | null = null;
  if (startIso && followers_current != null) {
    const { data: startSnap } = await adminClient
      .from("instagram_account_snapshots")
      .select("followers_count")
      .eq("instagram_account_id", id)
      .lte("collected_at", startIso)
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();
    if (startSnap?.followers_count != null) {
      followers_delta = followers_current - startSnap.followers_count;
    }
  }

  // Views delta
  let views_delta: number | null = null;
  if (startIso && views_total != null) {
    const { data: startSnap } = await adminClient
      .from("instagram_account_snapshots")
      .select("total_views")
      .eq("instagram_account_id", id)
      .lte("collected_at", startIso)
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();
    if (startSnap?.total_views != null) {
      views_delta = views_total - startSnap.total_views;
    } else if (period !== "inception") {
      views_delta = null; // not enough history
    }
  } else if (period === "inception") {
    views_delta = views_total;
  }

  // ── 2. Bio clicks history (gms_overview_snapshots.total_clicks per day) ─────
  const gmsQuery = adminClient
    .from("gms_overview_snapshots")
    .select("total_clicks, collected_at")
    .eq("instagram_account_id", id)
    .order("collected_at", { ascending: true })
    .limit(60);

  const { data: gmsSnaps } = await gmsQuery;

  const bio_clicks_history = (gmsSnaps ?? [])
    .filter((s) => s.total_clicks != null)
    .map((s) => ({ date: s.collected_at, value: s.total_clicks as number }));

  // GMS bio clicks: only available for non-inception periods (we don't have full historical data).
  // For inception, we can't know the true all-time total → mark as N/A.
  const bio_clicks_na = period === "inception";
  let bio_clicks: number | null = null;
  if (!bio_clicks_na && startIso) {
    bio_clicks = (gmsSnaps ?? [])
      .filter((s) => s.total_clicks != null && s.collected_at >= startIso)
      .reduce((s, d) => s + (d.total_clicks ?? 0), 0) || null;
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
  let needs_more_data = false;

  if (period === "inception") {
    track_clicks_delta = track_clicks_total;
    subscribers_delta = subscribers_total;
    revenue_delta = revenue_total;
  } else if (startIso && track_clicks_total != null) {
    const { data: prevTracking } = await adminClient
      .from("tracking_link_snapshots")
      .select("clicks_count, subscribers_count, revenue_total")
      .eq("instagram_account_id", id)
      .lte("collected_at", startIso)
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();

    if (prevTracking) {
      track_clicks_delta = Math.max(0, track_clicks_total - prevTracking.clicks_count);
      subscribers_delta = Math.max(0, subscribers_total! - prevTracking.subscribers_count);
      revenue_delta = revenue_total != null && prevTracking.revenue_total != null
        ? Math.max(0, revenue_total - prevTracking.revenue_total)
        : null;
    } else {
      needs_more_data = true; // no snapshot before period start yet
    }
  }

  const analytics: AccountAnalytics = {
    period,
    stats: {
      views_total,
      views_delta,
      followers_current,
      followers_delta,
      bio_clicks,
      bio_clicks_na,
      track_clicks_total,
      subscribers_total,
      track_clicks_delta,
      subscribers_delta,
      revenue_total,
      revenue_delta,
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
