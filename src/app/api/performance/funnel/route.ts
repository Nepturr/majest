import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TIER1 = new Set(["US", "GB", "CA", "AU", "DE", "FR"]);

async function verifyAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

async function getSettings(): Promise<Record<string, string>> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select("key, value")
    .in("key", ["gms_api_key", "ofapi_api_key"]);
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.key] = row.value;
  return result;
}

// ── Types ─────────────────────────────────────────────────────
export interface FunnelAccount {
  id: string;
  instagram_handle: string;
  status: "active" | "inactive";
  niche: string | null;
  model: { name: string; avatar_url: string | null } | null;
  get_my_social_link_id: string | null;
  get_my_social_link_name: string | null;
  of_tracking_link_id: string | null;
  of_tracking_link_url: string | null;
  instagram: {
    followers_count: number | null;
    following_count: number | null;
    posts_count: number | null;
    profile_pic_url: string | null;
    collected_at: string | null;
    total_posts_in_db: number;
    video_posts: number;
    avg_likes: number | null;
    avg_comments: number | null;
    avg_views: number | null;
    avg_plays: number | null;
  };
  gms: {
    total_clicks: number | null;
    unique_visitors: number | null;
    tier1_pct: number | null;
    error: string | null;
  } | null;
  tracking: {
    clicks_count: number | null;
    subscribers_count: number | null;
    error: string | null;
  } | null;
}

/**
 * GET /api/performance/funnel
 * Returns all Instagram accounts enriched with:
 *  - latest Apify snapshot (followers, pfp)
 *  - avg post metrics (likes, views, plays) from instagram_post_snapshots
 *  - GMS bio link analytics (clicks, Tier 1 %)
 *  - OFAPI tracking link stats (clicks, subscribers)
 */
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const settings = await getSettings();

  // ── 1. Instagram accounts ───────────────────────────────────
  const { data: accounts, error: accountsErr } = await adminClient
    .from("instagram_accounts")
    .select(`
      id, instagram_handle, status, niche,
      get_my_social_link_id, get_my_social_link_name,
      of_tracking_link_id, of_tracking_link_url,
      model:models(name, avatar_url),
      of_account:accounts(ofapi_account_id, of_username)
    `)
    .order("created_at", { ascending: false });

  if (accountsErr || !accounts) {
    return NextResponse.json({ error: accountsErr?.message ?? "Failed to load accounts" }, { status: 500 });
  }
  if (accounts.length === 0) return NextResponse.json({ accounts: [] });

  const accountIds = accounts.map((a) => a.id);

  // ── 2. Latest account snapshots ──────────────────────────────
  const { data: snapshots } = await adminClient
    .from("instagram_account_snapshots")
    .select("instagram_account_id, followers_count, following_count, posts_count, profile_pic_url, collected_at")
    .in("instagram_account_id", accountIds)
    .order("collected_at", { ascending: false });

  const latestSnap = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const s of snapshots ?? []) {
    if (!latestSnap.has(s.instagram_account_id)) latestSnap.set(s.instagram_account_id, s);
  }

  // ── 3. Post metrics (from DB) ────────────────────────────────
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

  // Latest snap per post
  const latestPostSnap = new Map<string, NonNullable<typeof postSnaps>[number]>();
  for (const s of postSnaps ?? []) {
    if (!latestPostSnap.has(s.post_id)) latestPostSnap.set(s.post_id, s);
  }

  // Aggregate per account
  interface IgAggregate {
    total_posts_in_db: number;
    video_posts: number;
    sum_likes: number; count_likes: number;
    sum_comments: number; count_comments: number;
    sum_views: number; count_views: number;
    sum_plays: number; count_plays: number;
  }
  const igAgg = new Map<string, IgAggregate>();

  for (const post of posts ?? []) {
    const snap = latestPostSnap.get(post.id);
    const acc = igAgg.get(post.instagram_account_id) ?? {
      total_posts_in_db: 0, video_posts: 0,
      sum_likes: 0, count_likes: 0,
      sum_comments: 0, count_comments: 0,
      sum_views: 0, count_views: 0,
      sum_plays: 0, count_plays: 0,
    };
    acc.total_posts_in_db++;
    if (post.post_type === "Video") acc.video_posts++;
    if (snap?.likes_count != null) { acc.sum_likes += snap.likes_count; acc.count_likes++; }
    if (snap?.comments_count != null) { acc.sum_comments += snap.comments_count; acc.count_comments++; }
    if (snap?.views_count != null) { acc.sum_views += snap.views_count; acc.count_views++; }
    if (snap?.plays_count != null) { acc.sum_plays += snap.plays_count; acc.count_plays++; }
    igAgg.set(post.instagram_account_id, acc);
  }

  // ── 4. GMS analytics (parallel, one call per account) ───────
  type GmsResult = { total_clicks: number | null; unique_visitors: number | null; tier1_pct: number | null; error: string | null };
  const gmsResults = new Map<string, GmsResult>();

  if (settings.gms_api_key) {
    const gmsKey = settings.gms_api_key;
    await Promise.allSettled(
      accounts
        .filter((a) => a.get_my_social_link_id)
        .map(async (account) => {
          const linkId = account.get_my_social_link_id!;
          try {
            const [overviewRes, countriesRes] = await Promise.allSettled([
              fetch(`https://getmysocial.com/api/v2/analytics/overview?scope=link&linkId=${linkId}`, {
                headers: { "x-api-key": gmsKey },
              }),
              fetch(`https://getmysocial.com/api/v2/analytics/dimensions/countries?scope=link&linkId=${linkId}`, {
                headers: { "x-api-key": gmsKey },
              }),
            ]);

            let total_clicks: number | null = null;
            let unique_visitors: number | null = null;
            let tier1_pct: number | null = null;

            if (overviewRes.status === "fulfilled" && overviewRes.value.ok) {
              const body = await overviewRes.value.json();
              const d = body.data ?? body;
              total_clicks = d.totalClicks ?? d.total_clicks ?? null;
              unique_visitors = d.uniqueVisitors ?? d.unique_visitors ?? null;
            }

            if (countriesRes.status === "fulfilled" && countriesRes.value.ok) {
              const body = await countriesRes.value.json();
              const list: Array<{ country: string; visitors?: number; clicks?: number; count?: number }> =
                body.data ?? (Array.isArray(body) ? body : []);
              if (list.length > 0) {
                const total = list.reduce((s, c) => s + (c.visitors ?? c.clicks ?? c.count ?? 0), 0);
                const t1 = list
                  .filter((c) => TIER1.has(c.country))
                  .reduce((s, c) => s + (c.visitors ?? c.clicks ?? c.count ?? 0), 0);
                tier1_pct = total > 0 ? Math.round((t1 / total) * 100) : null;
              }
            }

            gmsResults.set(account.id, { total_clicks, unique_visitors, tier1_pct, error: null });
          } catch {
            gmsResults.set(account.id, { total_clicks: null, unique_visitors: null, tier1_pct: null, error: "Fetch failed" });
          }
        })
    );
  }

  // ── 5. OFAPI tracking link stats ─────────────────────────────
  // Group IG accounts by their OF account (ofapi_account_id) → one OFAPI call per OF account
  type TrackingResult = { clicks_count: number | null; subscribers_count: number | null; error: string | null };
  const trackingResults = new Map<string, TrackingResult>();

  if (settings.ofapi_api_key) {
    const ofapiKey = settings.ofapi_api_key;

    type IgWithOf = (typeof accounts)[number] & {
      of_account: { ofapi_account_id: string | null; of_username: string | null } | null;
    };

    const byOfAccount = new Map<string, IgWithOf[]>();
    for (const account of accounts as IgWithOf[]) {
      const ofapiId = account.of_account?.ofapi_account_id;
      if (!account.of_tracking_link_id || !ofapiId) continue;
      if (!byOfAccount.has(ofapiId)) byOfAccount.set(ofapiId, []);
      byOfAccount.get(ofapiId)!.push(account);
    }

    await Promise.allSettled(
      [...byOfAccount.entries()].map(async ([ofapiId, igAccounts]) => {
        try {
          const allLinks: Array<{ id: number; clicksCount: number; subscribersCount: number }> = [];
          let nextUrl: string | null = `https://app.onlyfansapi.com/api/${ofapiId}/tracking-links?limit=100`;

          while (nextUrl) {
            const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${ofapiKey}` } });
            if (!res.ok) break;
            const body = await res.json();
            allLinks.push(...(body.data?.list ?? []));
            nextUrl = body.data?.hasMore && body._pagination?.next_page ? body._pagination.next_page : null;
          }

          for (const igAccount of igAccounts) {
            const link = allLinks.find((l) => String(l.id) === String(igAccount.of_tracking_link_id));
            trackingResults.set(
              igAccount.id,
              link
                ? { clicks_count: link.clicksCount ?? null, subscribers_count: link.subscribersCount ?? null, error: null }
                : { clicks_count: null, subscribers_count: null, error: "Link not found" }
            );
          }
        } catch {
          for (const igAccount of igAccounts) {
            trackingResults.set(igAccount.id, { clicks_count: null, subscribers_count: null, error: "Fetch failed" });
          }
        }
      })
    );
  }

  // ── 6. Assemble ──────────────────────────────────────────────
  const result: FunnelAccount[] = accounts.map((account) => {
    const snap = latestSnap.get(account.id);
    const agg = igAgg.get(account.id);

    return {
      id: account.id,
      instagram_handle: account.instagram_handle,
      status: account.status as "active" | "inactive",
      niche: account.niche,
      model: account.model as { name: string; avatar_url: string | null } | null,
      get_my_social_link_id: account.get_my_social_link_id,
      get_my_social_link_name: account.get_my_social_link_name,
      of_tracking_link_id: account.of_tracking_link_id,
      of_tracking_link_url: account.of_tracking_link_url,
      instagram: {
        followers_count: snap?.followers_count ?? null,
        following_count: snap?.following_count ?? null,
        posts_count: snap?.posts_count ?? null,
        profile_pic_url: snap?.profile_pic_url ?? null,
        collected_at: snap?.collected_at ?? null,
        total_posts_in_db: agg?.total_posts_in_db ?? 0,
        video_posts: agg?.video_posts ?? 0,
        avg_likes: agg && agg.count_likes > 0 ? Math.round(agg.sum_likes / agg.count_likes) : null,
        avg_comments: agg && agg.count_comments > 0 ? Math.round(agg.sum_comments / agg.count_comments) : null,
        avg_views: agg && agg.count_views > 0 ? Math.round(agg.sum_views / agg.count_views) : null,
        avg_plays: agg && agg.count_plays > 0 ? Math.round(agg.sum_plays / agg.count_plays) : null,
      },
      gms: gmsResults.get(account.id) ?? null,
      tracking: trackingResults.get(account.id) ?? null,
    };
  });

  return NextResponse.json({ accounts: result });
}
