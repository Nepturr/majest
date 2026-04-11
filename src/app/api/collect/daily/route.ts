import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { upsertPosts, updateTotalViews } from "@/lib/instagram/apify-collect";

export const maxDuration = 300; // 5 min pour le cron Vercel

// GMS uses 3-letter country codes ("USA", "GBR", etc.)
const TIER1_3 = new Set(["USA", "GBR", "CAN", "AUS", "DEU", "FRA"]);
// Fallback for 2-letter ISO codes
const TIER1_2 = new Set(["US", "GB", "CA", "AU", "DE", "FR"]);

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // Vercel cron with CRON_SECRET configured
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Vercel cron without CRON_SECRET — header x-vercel-cron is always sent by Vercel infra
  if (!cronSecret && req.headers.get("x-vercel-cron") === "1") return true;

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

const ALL_SOURCES = ["gms", "ofapi", "instagram"] as const;
type Source = typeof ALL_SOURCES[number];

/**
 * GET /api/collect/daily  ← appelé par Vercel Cron (envoie GET, pas POST)
 * Lance la collecte complète avec toutes les sources.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCollection(new Set<Source>(ALL_SOURCES));
}

/**
 * POST /api/collect/daily  ← déclenchement manuel depuis l'admin
 * Body optionnel : { sources: ["gms", "ofapi", "instagram"] }
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const sourcesRaw: string[] = Array.isArray(body.sources) ? body.sources : ALL_SOURCES;
  const sources = new Set<Source>(sourcesRaw.filter((s): s is Source => ALL_SOURCES.includes(s as Source)));
  return runCollection(sources);
}

async function runCollection(sources: Set<Source>) {

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
  let apifyRunsStarted = 0;
  let apifyRunsTimedOut = 0;
  const errors: string[] = [];

  // Diagnostic: log which settings keys are present (values redacted)
  const settingsPresent = Object.entries(settings)
    .filter(([, v]) => !!v)
    .map(([k]) => k);
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

            // Read countries once — used for both tier1_pct and country_breakdown donut
            let countryBreakdown: Array<{ country: string; count: number }> | null = null;
            if (countriesRes.status === "fulfilled" && countriesRes.value.ok) {
              const list: Array<{ country: string; code?: string | null; count?: number; visitors?: number; clicks?: number }> =
                (await countriesRes.value.json())?.data ?? [];
              if (Array.isArray(list) && list.length > 0) {
                const total = list.reduce((s, c) => s + (c.count ?? c.visitors ?? c.clicks ?? 0), 0);
                const t1 = list
                  .filter((c) => TIER1_3.has(c.country) || TIER1_2.has(c.country) || (c.code != null && TIER1_2.has(c.code)))
                  .reduce((s, c) => s + (c.count ?? c.visitors ?? c.clicks ?? 0), 0);
                tier1_pct = total > 0 ? Math.round((t1 / total) * 100) : null;
                accountDetails.push(`Tier1: ${t1}/${total} = ${tier1_pct}%`);
                countryBreakdown = list.map((c) => ({ country: c.country, count: c.count ?? c.visitors ?? c.clicks ?? 0 }));
              }
            }

            const { error: snapErr } = await adminClient.from("gms_overview_snapshots").insert({
              instagram_account_id: account.id,
              total_clicks,
              unique_visitors,
              tier1_pct,
              country_breakdown: countryBreakdown,
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

  // ── 3. Apify Instagram sync (profile + reels, fire all → poll max 270s) ─────
  if (sources.has("instagram") && settings.apify_api_key) {
    const apifyKey = settings.apify_api_key;
    const APIFY_BASE = "https://api.apify.com/v2";

    type RunMeta = { accountId: string; mode: "profile" | "reels" };
    const pending = new Map<string, RunMeta>(); // runId → meta
    const accountIds = new Set<string>();

    // Fire profile scans + reel scans for every active account in parallel
    const fireResults = await Promise.allSettled(
      accounts.flatMap((account) => {
        const handle = account.instagram_handle.replace(/^@/, "");
        accountIds.add(account.id);

        const fireRun = async (mode: "profile" | "reels") => {
          const actorId = mode === "reels" ? "apify~instagram-reel-scraper" : "apify~instagram-scraper";
          const payload =
            mode === "reels"
              ? { username: [handle], resultsLimit: 50 }
              : { directUrls: [`https://www.instagram.com/${handle}/`], resultsType: "details", resultsLimit: 50 };

          const runRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${apifyKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!runRes.ok) {
            const body = await runRes.text().catch(() => "");
            throw new Error(`Apify ${mode} start HTTP ${runRes.status}: ${body.slice(0, 200)}`);
          }
          const data = await runRes.json();
          const runId = (data?.data ?? data)?.id as string;
          if (!runId) throw new Error(`Apify ${mode} start: no runId in response`);
          pending.set(runId, { accountId: account.id, mode });
          apifyRunsStarted++;
          return { handle, mode, runId };
        };

        return [fireRun("profile"), fireRun("reels")];
      })
    );

    for (const result of fireResults) {
      if (result.status === "rejected") {
        errors.push(`Apify fire: ${result.reason}`);
      }
    }

    const deadline = Date.now() + 270_000; // 4.5 min
    const remaining = new Set(pending.keys());

    while (remaining.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 8000));

      await Promise.allSettled([...remaining].map(async (runId) => {
        try {
          const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apifyKey}`);
          if (!statusRes.ok) return;
          const run = (await statusRes.json())?.data ?? {};
          if (run.status !== "SUCCEEDED" && run.status !== "FAILED") return;
          remaining.delete(runId);
          if (run.status !== "SUCCEEDED") return;

          const meta = pending.get(runId)!;
          const itemsRes = await fetch(
            `${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?token=${apifyKey}&format=json&limit=500`
          );
          if (!itemsRes.ok) return;
          const items = await itemsRes.json();
          if (!items?.length) return;

          if (meta.mode === "profile") {
            const profile = items[0];
            await adminClient.from("instagram_account_snapshots").insert({
              instagram_account_id: meta.accountId,
              followers_count: profile.followersCount ?? null,
              following_count: profile.followsCount ?? null,
              posts_count: profile.postsCount ?? null,
              bio: profile.biography ?? null,
              is_verified: profile.verified ?? false,
              profile_pic_url: profile.profilePicUrlHD ?? profile.profilePicUrl ?? null,
              apify_run_id: runId,
            });
            const posts = profile.latestPosts ?? [];
            const result = await upsertPosts(adminClient, meta.accountId, runId, posts);
            apifyPostsSaved += result.postsSaved;
          } else {
            // Reels scan
            const result = await upsertPosts(adminClient, meta.accountId, runId, items);
            apifyPostsSaved += result.postsSaved;
          }
        } catch (e) {
          errors.push(`Apify finalize ${runId}: ${e}`);
        }
      }));
    }

    apifyRunsTimedOut = remaining.size;

    // Update total_views for every account after all scans
    await Promise.allSettled(
      [...accountIds].map((accountId) => updateTotalViews(adminClient, accountId))
    );
  }

  return NextResponse.json({
    message: "Collection complete.",
    gms_collected: gmsCollected,
    tracking_collected: trackingCollected,
    apify_posts_saved: apifyPostsSaved,
    apify_runs_started: apifyRunsStarted,
    apify_runs_timed_out: apifyRunsTimedOut,
    settings_present: settingsPresent,
    details,
    errors: errors.length > 0 ? errors : undefined,
    collected_at: new Date().toISOString(),
  });
}
