import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GMS uses 3-letter country codes ("USA", "GBR", etc.)
const TIER1_3 = new Set(["USA", "GBR", "CAN", "AUS", "DEU", "FRA"]);
// Fallback for 2-letter ISO codes
const TIER1_2 = new Set(["US", "GB", "CA", "AU", "DE", "FR"]);

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

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

// Supabase returns joins as arrays — helper to unwrap
function unwrapJoin<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * POST /api/collect/daily
 * Collecte complète pour tous les comptes actifs :
 *   1. GMS overview snapshot (total clicks + Tier 1 %) — sert au delta période
 *   2. OFAPI tracking link snapshot (cumulatif, delta sur période)
 *   3. Apify Instagram sync (profil + posts + métriques)
 *
 * Protégé : CRON_SECRET (Vercel) ou session admin.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // sources: tableau de "gms" | "ofapi" | "instagram" — défaut = tout
  const body = await req.json().catch(() => ({}));
  const allSources = ["gms", "ofapi", "instagram"] as const;
  type Source = typeof allSources[number];
  const sourcesRaw: string[] = Array.isArray(body.sources) ? body.sources : allSources;
  const sources = new Set<Source>(sourcesRaw.filter((s): s is Source => allSources.includes(s as Source)));

  const adminClient = createAdminClient();
  const settings = await getSettings();

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
    return NextResponse.json({ message: "No active accounts.", gms: 0, tracking: 0, apify: 0 });
  }

  let gmsCollected = 0;
  let trackingCollected = 0;
  let apifyPostsSaved = 0;
  const errors: string[] = [];
  const details: Record<string, string[]> = {};

  // ── 1. GMS overview snapshot ─────────────────────────────────
  if (sources.has("gms") && settings.gms_api_key) {
    const gmsKey = settings.gms_api_key;

    await Promise.allSettled(
      accounts
        .filter((a) => a.get_my_social_link_id)
        .map(async (account) => {
          const linkId = account.get_my_social_link_id!;
          const accountDetails: string[] = [];
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

            if (overviewRes.status === "fulfilled") {
              if (overviewRes.value.ok) {
                const d = (await overviewRes.value.json())?.data ?? {};
                total_clicks = d.totalClicks ?? d.total_clicks ?? d.clicks ?? null;
                // uniqueVisitors can be a nested object { uniqueVisitors: N } or a plain number
                const uv = d.uniqueVisitors ?? d.unique_visitors;
                unique_visitors = typeof uv === "number" ? uv : (uv?.uniqueVisitors ?? null);
                accountDetails.push(`overview OK: ${total_clicks} clicks, ${unique_visitors} unique`);
              } else {
                accountDetails.push(`overview ERR: ${overviewRes.value.status}`);
              }
            }

            if (countriesRes.status === "fulfilled" && countriesRes.value.ok) {
              // GMS returns 3-letter codes (USA, GBR, CAN…) with count field
              const list: Array<{ country: string; code?: string | null; count?: number; visitors?: number; clicks?: number }> =
                (await countriesRes.value.json())?.data ?? [];
              if (Array.isArray(list) && list.length > 0) {
                const total = list.reduce((s, c) => s + (c.count ?? c.visitors ?? c.clicks ?? 0), 0);
                const t1 = list
                  .filter((c) => TIER1_3.has(c.country) || TIER1_2.has(c.country) || (c.code != null && TIER1_2.has(c.code)))
                  .reduce((s, c) => s + (c.count ?? c.visitors ?? c.clicks ?? 0), 0);
                tier1_pct = total > 0 ? Math.round((t1 / total) * 100) : null;
                accountDetails.push(`Tier1: ${t1}/${total} = ${tier1_pct}%`);
              }
            }

            const { error: snapErr } = await adminClient.from("gms_overview_snapshots").insert({
              instagram_account_id: account.id,
              total_clicks,
              unique_visitors,
              tier1_pct,
            });

            if (!snapErr) {
              gmsCollected++;
              accountDetails.push(`snapshot saved`);
            } else {
              accountDetails.push(`snapshot ERR: ${snapErr.message}`);
            }
          } catch (e) {
            const msg = `GMS ${account.instagram_handle}: ${e}`;
            errors.push(msg);
            accountDetails.push(`exception: ${e}`);
          }
          details[`gms:${account.instagram_handle}`] = accountDetails;
        })
    );
  }

  // ── 2. OFAPI tracking link snapshot ──────────────────────────
  if (sources.has("ofapi") && settings.ofapi_api_key) {
    const ofapiKey = settings.ofapi_api_key;

    // Unwrap Supabase join (can be array or object)
    const byOfAccount = new Map<string, { accountId: string; trackingLinkId: string }[]>();

    for (const account of accounts) {
      const ofAccount = unwrapJoin(account.of_account as { ofapi_account_id: string | null } | { ofapi_account_id: string | null }[] | null);
      const ofapiId = ofAccount?.ofapi_account_id;
      if (!account.of_tracking_link_id || !ofapiId) continue;
      if (!byOfAccount.has(ofapiId)) byOfAccount.set(ofapiId, []);
      byOfAccount.get(ofapiId)!.push({ accountId: account.id, trackingLinkId: account.of_tracking_link_id });
    }

    await Promise.allSettled(
      [...byOfAccount.entries()].map(async ([ofapiId, entries]) => {
        try {
          const allLinks: Array<{ id: number; clicksCount: number; subscribersCount: number; revenue?: { total?: number; revenuePerSubscriber?: number } }> = [];
          let nextUrl: string | null = `https://app.onlyfansapi.com/api/${ofapiId}/tracking-links?limit=100`;

          while (nextUrl) {
            const pageRes: Response = await fetch(nextUrl, {
              headers: { Authorization: `Bearer ${ofapiKey}` },
            });
            if (!pageRes.ok) {
              errors.push(`OFAPI ${ofapiId}: HTTP ${pageRes.status}`);
              break;
            }
            const body = await pageRes.json();
            allLinks.push(...(body.data?.list ?? []));
            nextUrl = body.data?.hasMore && body._pagination?.next_page
              ? body._pagination.next_page : null;
          }

          for (const entry of entries) {
            const link = allLinks.find((l) => String(l.id) === String(entry.trackingLinkId));
            if (link) {
              await adminClient.from("tracking_link_snapshots").insert({
                instagram_account_id: entry.accountId,
                clicks_count: link.clicksCount ?? 0,
                subscribers_count: link.subscribersCount ?? 0,
                revenue_total: link.revenue?.total ?? null,
                revenue_per_subscriber: link.revenue?.revenuePerSubscriber ?? null,
              });
              trackingCollected++;
            } else {
              errors.push(`OFAPI: link ${entry.trackingLinkId} not found in ${ofapiId}`);
            }
          }
        } catch (e) {
          errors.push(`OFAPI ${ofapiId}: ${e}`);
        }
      })
    );
  }

  // ── 3. Apify Instagram sync (fire all → poll max 150s) ───────
  if (sources.has("instagram") && settings.apify_api_key) {
    const apifyKey = settings.apify_api_key;
    const APIFY_ACTOR = "apify~instagram-scraper";
    const APIFY_BASE = "https://api.apify.com/v2";
    const now = new Date().toISOString();

    const apifyRuns = await Promise.allSettled(
      accounts.map(async (account) => {
        const handle = account.instagram_handle.replace(/^@/, "");
        const runRes = await fetch(
          `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${apifyKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              directUrls: [`https://www.instagram.com/${handle}/`],
              resultsType: "details",
              resultsLimit: 50,
            }),
          }
        );
        if (!runRes.ok) throw new Error(`HTTP ${runRes.status}`);
        const data = await runRes.json();
        return { accountId: account.id, runId: (data?.data ?? data)?.id as string };
      })
    );

    const pending = new Map<string, string>(); // runId → accountId
    for (const r of apifyRuns) {
      if (r.status === "fulfilled") pending.set(r.value.runId, r.value.accountId);
      else errors.push(`Apify start: ${r.reason}`);
    }

    const deadline = Date.now() + 150_000;
    const remaining = new Set(pending.keys());

    while (remaining.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 8000));

      await Promise.allSettled([...remaining].map(async (runId) => {
        try {
          const statusRes = await fetch(`${APIFY_BASE}/acts/${APIFY_ACTOR}/runs/${runId}?token=${apifyKey}`);
          if (!statusRes.ok) return;
          const run = (await statusRes.json())?.data ?? {};
          if (run.status !== "SUCCEEDED" && run.status !== "FAILED") return;
          remaining.delete(runId);
          if (run.status !== "SUCCEEDED") return;

          const accountId = pending.get(runId)!;
          const itemsRes = await fetch(
            `${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?token=${apifyKey}&clean=true&format=json`
          );
          if (!itemsRes.ok) return;
          const items = await itemsRes.json();
          if (!items?.length) return;

          const profile = items[0];

          // Account snapshot
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

          // Collect the shortcodes seen this run (for last_seen_at update)
          const seenShortcodes: string[] = [];

          for (const post of profile.latestPosts ?? []) {
            if (!post.shortCode) continue;
            seenShortcodes.push(post.shortCode);

            let postType = "Image";
            if (post.productType === "clips") postType = "Reel";
            else if (post.productType === "igtv") postType = "Video";
            else if ((post.type ?? "").toLowerCase() === "video") postType = "Video";
            else if ((post.type ?? "").toLowerCase() === "sidecar") postType = "Sidecar";

            const { data: upsertedPost } = await adminClient
              .from("instagram_posts")
              .upsert({
                instagram_account_id: accountId,
                shortcode: post.shortCode,
                post_type: postType,
                url: post.url ?? `https://www.instagram.com/p/${post.shortCode}/`,
                caption: post.caption ?? null,
                thumbnail_url: post.displayUrl ?? null,
                posted_at: post.timestamp ?? null,
                video_duration: post.videoDuration != null ? Math.round(post.videoDuration) : null,
                last_seen_at: now,
              }, { onConflict: "shortcode", ignoreDuplicates: false })
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
              // Toujours écraser duration_seconds avec la valeur Apify (sûre)
              if (post.videoDuration != null) {
                await adminClient
                  .from("instagram_post_metadata")
                  .upsert(
                    { post_id: upsertedPost.id, duration_seconds: Math.round(post.videoDuration) },
                    { onConflict: "post_id", ignoreDuplicates: false }
                  );
              }
              apifyPostsSaved++;
            }
          }
        } catch (e) {
          errors.push(`Apify finalize ${runId}: ${e}`);
        }
      }));
    }
  }

  return NextResponse.json({
    message: "Collection complete.",
    gms_collected: gmsCollected,
    tracking_collected: trackingCollected,
    apify_posts_saved: apifyPostsSaved,
    details,
    errors: errors.length > 0 ? errors : undefined,
    collected_at: new Date().toISOString(),
  });
}
