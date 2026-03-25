import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const TIER1 = new Set(["US", "GB", "CA", "AU", "DE", "FR"]);

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Allow Vercel cron (CRON_SECRET)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Allow admin users
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

async function getSettings(): Promise<Record<string, string>> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select("key, value")
    .in("key", ["gms_api_key", "ofapi_api_key", "apify_api_key"]);
  const r: Record<string, string> = {};
  for (const row of data ?? []) r[row.key] = row.value;
  return r;
}

/**
 * POST /api/collect/daily
 * Collects GMS time-series (last 30 days) and OFAPI tracking link snapshots
 * for all active Instagram accounts. Stores results in DB.
 * Triggered daily by Vercel cron at 06:00 UTC, or manually by admins.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const settings = await getSettings();

  // Load all active Instagram accounts
  const { data: accounts } = await adminClient
    .from("instagram_accounts")
    .select(`
      id, instagram_handle, status,
      get_my_social_link_id,
      of_tracking_link_id,
      of_account:accounts(ofapi_account_id)
    `)
    .eq("status", "active");

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: "No active accounts.", gms: 0, tracking: 0 });
  }

  let gmsCollected = 0;
  let trackingCollected = 0;
  const errors: string[] = [];

  // ── GMS collection ───────────────────────────────────────────
  if (settings.gms_api_key) {
    const gmsKey = settings.gms_api_key;

    await Promise.allSettled(
      accounts
        .filter((a) => a.get_my_social_link_id)
        .map(async (account) => {
          const linkId = account.get_my_social_link_id!;
          try {
            // Fetch time-series (daily clicks for the last 30 days)
            const tsRes = await fetch(
              `https://getmysocial.com/api/v2/analytics/time-series?scope=link&linkId=${linkId}&interval=day`,
              { headers: { "x-api-key": gmsKey } }
            );
            if (tsRes.ok) {
              const body = await tsRes.json();
              const series: Array<{
                date?: string;
                day?: string;
                clicks?: number;
                uniqueVisitors?: number;
                unique_visitors?: number;
              }> = body.data ?? (Array.isArray(body) ? body : []);

              if (series.length > 0) {
                const rows = series
                  .filter((item) => item.date ?? item.day)
                  .map((item) => ({
                    instagram_account_id: account.id,
                    date: item.date ?? item.day,
                    clicks: item.clicks ?? 0,
                    unique_visitors: item.uniqueVisitors ?? item.unique_visitors ?? null,
                  }));

                if (rows.length > 0) {
                  await adminClient
                    .from("gms_daily_stats")
                    .upsert(rows, { onConflict: "instagram_account_id,date" });
                  gmsCollected++;
                }
              }
            }

            // Fetch overview (Tier 1 %)
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
              const d = (await overviewRes.value.json())?.data ?? {};
              total_clicks = d.totalClicks ?? d.total_clicks ?? null;
              unique_visitors = d.uniqueVisitors ?? d.unique_visitors ?? null;
            }
            if (countriesRes.status === "fulfilled" && countriesRes.value.ok) {
              const list: Array<{ country: string; visitors?: number; clicks?: number }> =
                (await countriesRes.value.json())?.data ?? [];
              if (Array.isArray(list) && list.length > 0) {
                const total = list.reduce((s, c) => s + (c.visitors ?? c.clicks ?? 0), 0);
                const t1 = list
                  .filter((c) => TIER1.has(c.country))
                  .reduce((s, c) => s + (c.visitors ?? c.clicks ?? 0), 0);
                tier1_pct = total > 0 ? Math.round((t1 / total) * 100) : null;
              }
            }

            await adminClient.from("gms_overview_snapshots").insert({
              instagram_account_id: account.id,
              total_clicks,
              unique_visitors,
              tier1_pct,
            });
          } catch (e) {
            errors.push(`GMS ${account.instagram_handle}: ${e}`);
          }
        })
    );
  }

  // ── OFAPI tracking link collection ───────────────────────────
  if (settings.ofapi_api_key) {
    const ofapiKey = settings.ofapi_api_key;

    type AccountWithOf = (typeof accounts)[number] & {
      of_account: { ofapi_account_id: string | null } | null;
    };

    const byOfAccount = new Map<string, AccountWithOf[]>();
    for (const account of accounts as AccountWithOf[]) {
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
            const pageRes: Response = await fetch(nextUrl, {
              headers: { Authorization: `Bearer ${ofapiKey}` },
            });
            if (!pageRes.ok) break;
            const body = await pageRes.json();
            allLinks.push(...(body.data?.list ?? []));
            nextUrl = body.data?.hasMore && body._pagination?.next_page
              ? body._pagination.next_page : null;
          }

          for (const igAccount of igAccounts) {
            const link = allLinks.find(
              (l) => String(l.id) === String(igAccount.of_tracking_link_id)
            );
            if (link) {
              await adminClient.from("tracking_link_snapshots").insert({
                instagram_account_id: igAccount.id,
                clicks_count: link.clicksCount ?? 0,
                subscribers_count: link.subscribersCount ?? 0,
              });
              trackingCollected++;
            }
          }
        } catch (e) {
          errors.push(`OFAPI ${ofapiId}: ${e}`);
        }
      })
    );
  }

  // ── Apify Instagram sync (fire-and-wait, max 3 min) ─────────
  let apifyCollected = 0;
  if (settings.apify_api_key) {
    const apifyKey = settings.apify_api_key;
    const APIFY_ACTOR = "apify~instagram-scraper";
    const APIFY_BASE = "https://api.apify.com/v2";

    // Fire all runs in parallel
    const apifyRuns = await Promise.allSettled(
      accounts.map(async (account) => {
        const handle = account.instagram_handle.replace(/^@/, "");
        const profileUrl = `https://www.instagram.com/${handle}/`;
        const runRes = await fetch(
          `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${apifyKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ directUrls: [profileUrl], resultsType: "details", resultsLimit: 50 }),
          }
        );
        if (!runRes.ok) throw new Error(`Apify start failed for ${handle}`);
        const data = await runRes.json();
        return { accountId: account.id, runId: (data?.data ?? data)?.id as string };
      })
    );

    // Collect successful run IDs
    const pendingRuns: { accountId: string; runId: string }[] = [];
    for (const r of apifyRuns) {
      if (r.status === "fulfilled") pendingRuns.push(r.value);
    }

    // Poll for completion (max 150 seconds)
    const deadline = Date.now() + 150_000;
    const remaining = new Set(pendingRuns.map((r) => r.runId));
    const runIdToAccountId = new Map(pendingRuns.map((r) => [r.runId, r.accountId]));

    while (remaining.size > 0 && Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 8000));
      await Promise.allSettled(
        [...remaining].map(async (runId) => {
          try {
            const statusRes = await fetch(
              `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs/${runId}?token=${apifyKey}`
            );
            if (!statusRes.ok) return;
            const statusData = await statusRes.json();
            const run = statusData?.data ?? statusData;
            if (run.status !== "SUCCEEDED" && run.status !== "FAILED") return;
            remaining.delete(runId);
            if (run.status !== "SUCCEEDED") return;

            const accountId = runIdToAccountId.get(runId)!;
            const itemsRes = await fetch(
              `${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?token=${apifyKey}&clean=true&format=json`
            );
            if (!itemsRes.ok) return;
            const items = await itemsRes.json();
            if (!items?.length) return;

            const profile = items[0];
            await adminClient.from("instagram_account_snapshots").insert({
              instagram_account_id: accountId,
              followers_count: profile.followersCount ?? null,
              following_count: profile.followsCount ?? null,
              posts_count: profile.postsCount ?? null,
              bio: profile.biography ?? null,
              is_verified: profile.verified ?? false,
              profile_pic_url: profile.profilePicUrlHD ?? profile.profilePicUrl ?? null,
              apify_run_id: runId,
            });

            for (const post of profile.latestPosts ?? []) {
              if (!post.shortCode) continue;
              let postType: string = "Image";
              if (post.productType === "clips") postType = "Reel";
              else if (post.type === "Video") postType = "Video";
              else if (post.type === "Sidecar" || post.type === "GraphSidecar") postType = "Sidecar";

              const { data: upsertedPost } = await adminClient
                .from("instagram_posts")
                .upsert({ instagram_account_id: accountId, shortcode: post.shortCode, post_type: postType, url: post.url ?? `https://www.instagram.com/p/${post.shortCode}/`, caption: post.caption ?? null, thumbnail_url: post.displayUrl ?? null, posted_at: post.timestamp ?? null }, { onConflict: "shortcode", ignoreDuplicates: false })
                .select("id")
                .single();

              if (upsertedPost?.id) {
                await adminClient.from("instagram_post_snapshots").insert({
                  post_id: upsertedPost.id,
                  likes_count: post.likesCount ?? null,
                  comments_count: post.commentsCount ?? null,
                  views_count: post.videoViewCount ?? null,
                  plays_count: post.videoPlayCount ?? null,
                  apify_run_id: runId,
                });
                apifyCollected++;
              }
            }
          } catch (e) {
            errors.push(`Apify finalize ${runId}: ${e}`);
          }
        })
      );
    }
  }

  return NextResponse.json({
    message: "Collection complete.",
    gms_accounts_collected: gmsCollected,
    tracking_accounts_collected: trackingCollected,
    apify_posts_saved: apifyCollected,
    errors: errors.length > 0 ? errors : undefined,
    collected_at: new Date().toISOString(),
  });
}
