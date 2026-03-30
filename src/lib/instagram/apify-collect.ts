/**
 * Shared Apify Instagram collection logic.
 * Used by the manual collect route, the daily cron, and the initial auto-scan.
 */

const APIFY_BASE = "https://api.apify.com/v2";
const PROFILE_ACTOR = "apify~instagram-scraper";
const REELS_ACTOR = "apify~instagram-reel-scraper";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApifyPost {
  shortCode?: string;
  type?: string;
  productType?: string;
  url?: string;
  caption?: string;
  displayUrl?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoDuration?: number;
}

export interface ApifyProfile {
  username?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  verified?: boolean;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  latestPosts?: ApifyPost[];
}

export function mapPostType(post: ApifyPost): "Image" | "Video" | "Reel" | "Sidecar" {
  if (post.productType === "clips") return "Reel";
  if (post.productType === "igtv") return "Video";
  const t = (post.type ?? "").toLowerCase();
  if (t === "video") return "Video";
  if (t === "sidecar" || t === "graphsidecar") return "Sidecar";
  return "Image";
}

// ── Apify helpers ─────────────────────────────────────────────────────────────

/** Start an Apify run and return its runId. */
export async function startApifyRun(
  actor: "profile" | "reels",
  handle: string,
  apiKey: string,
  resultsLimit = 200
): Promise<string> {
  const actorId = actor === "reels" ? REELS_ACTOR : PROFILE_ACTOR;
  const payload =
    actor === "reels"
      ? { username: [handle], resultsLimit }
      : { directUrls: [`https://www.instagram.com/${handle}/`], resultsType: "details", resultsLimit };

  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Apify start ${actor} failed: ${res.status}`);
  const data = await res.json();
  return (data?.data ?? data)?.id as string;
}

/** Poll until the run completes. Returns run data or throws on timeout/failure. */
export async function waitForRun(
  runId: string,
  apiKey: string,
  deadlineMs = 270_000,
  pollIntervalMs = 8_000
): Promise<{ defaultDatasetId: string; finishedAt: string }> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`);
    if (!res.ok) continue;
    const run = (await res.json())?.data ?? {};
    if (run.status === "FAILED") throw new Error("Apify run FAILED");
    if (run.status === "SUCCEEDED") return run;
  }
  throw new Error("Apify run timed out");
}

/** Fetch dataset items after run succeeds. */
export async function fetchDataset(datasetId: string, apiKey: string): Promise<unknown[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json&limit=500`
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

// ── DB helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const THUMBNAIL_BUCKET = "post-thumbnails";

/**
 * Download a thumbnail image and upload it to Supabase Storage.
 * Returns the permanent public URL, or null on failure.
 */
async function cacheThumbnail(
  adminClient: AdminClient,
  shortcode: string,
  cdnUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(cdnUrl, {
      headers: {
        Referer: "https://www.instagram.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${shortcode}.${ext}`;
    const buf = Buffer.from(await res.arrayBuffer());

    const { error } = await adminClient.storage
      .from(THUMBNAIL_BUCKET)
      .upload(path, buf, { contentType, upsert: true });

    if (error) return null;

    return `${SUPABASE_URL}/storage/v1/object/public/${THUMBNAIL_BUCKET}/${path}`;
  } catch {
    return null;
  }
}

/** Upsert posts + snapshots. Returns the number of posts successfully saved. */
export async function upsertPosts(
  adminClient: AdminClient,
  accountId: string,
  runId: string,
  posts: ApifyPost[]
): Promise<{ postsSaved: number; errors: string[] }> {
  let postsSaved = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  // Track which posts need thumbnail caching (CDN URLs expire; store permanently)
  const toCache: Array<{ id: string; shortcode: string; cdnUrl: string }> = [];

  for (const post of posts) {
    const sc = post.shortCode ?? (post as Record<string, unknown>).shortcode as string | undefined;
    if (!sc) {
      errors.push(`item without shortCode: ${JSON.stringify(Object.keys(post))}`);
      continue;
    }

    // Check if we already have a permanent storage URL for this post
    const { data: existing } = await adminClient
      .from("instagram_posts")
      .select("thumbnail_url")
      .eq("shortcode", sc)
      .single();

    const alreadyCached = existing?.thumbnail_url?.includes("supabase.co/storage");

    const { data: upsertedPost, error: upsertErr } = await adminClient
      .from("instagram_posts")
      .upsert(
        {
          instagram_account_id: accountId,
          shortcode: sc,
          post_type: mapPostType(post),
          url: post.url ?? `https://www.instagram.com/p/${sc}/`,
          caption: post.caption ?? null,
          // Keep existing storage URL if we have one, otherwise use CDN URL for now
          thumbnail_url: alreadyCached ? existing!.thumbnail_url : (post.displayUrl ?? null),
          posted_at: post.timestamp ?? null,
          video_duration: post.videoDuration != null ? Math.round(post.videoDuration) : null,
          last_seen_at: now,
          is_active: true,
        },
        { onConflict: "shortcode", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (upsertErr || !upsertedPost?.id) {
      errors.push(`upsert post ${sc}: ${upsertErr?.message ?? "no id"}`);
      continue;
    }

    const { error: snapErr } = await adminClient.from("instagram_post_snapshots").insert({
      post_id: upsertedPost.id,
      likes_count: post.likesCount ?? null,
      comments_count: post.commentsCount ?? null,
      shares_count: post.sharesCount ?? null,
      views_count: post.videoViewCount ?? null,
      plays_count: post.videoPlayCount ?? null,
      apify_run_id: runId,
    });
    if (snapErr && !snapErr.message?.includes("duplicate") && !snapErr.code?.includes("23505")) {
      errors.push(`snapshot ${sc}: ${snapErr.message}`);
    }

    postsSaved++;

    if (post.videoDuration != null) {
      await adminClient
        .from("instagram_post_metadata")
        .upsert(
          { post_id: upsertedPost.id, duration_seconds: Math.round(post.videoDuration) },
          { onConflict: "post_id", ignoreDuplicates: false }
        );
    }

    // Queue thumbnail cache if CDN URL is fresh and not yet stored permanently
    if (!alreadyCached && post.displayUrl) {
      toCache.push({ id: upsertedPost.id, shortcode: sc, cdnUrl: post.displayUrl });
    }
  }

  // Cache thumbnails to Supabase Storage in parallel batches of 5
  for (let i = 0; i < toCache.length; i += 5) {
    await Promise.allSettled(
      toCache.slice(i, i + 5).map(async ({ id, shortcode, cdnUrl }) => {
        const permanentUrl = await cacheThumbnail(adminClient, shortcode, cdnUrl);
        if (permanentUrl) {
          await adminClient
            .from("instagram_posts")
            .update({ thumbnail_url: permanentUrl })
            .eq("id", id);
        }
      })
    );
  }

  return { postsSaved, errors };
}

/**
 * After saving posts, compute total views across all active posts
 * and write it back to the account's latest snapshot.
 */
export async function updateTotalViews(adminClient: AdminClient, accountId: string): Promise<void> {
  try {
    const { data: postIds } = await adminClient
      .from("instagram_posts")
      .select("id")
      .eq("instagram_account_id", accountId)
      .eq("is_active", true);

    if (!postIds?.length) return;

    const ids = postIds.map((p: { id: string }) => p.id);
    const { data: snaps } = await adminClient
      .from("instagram_post_snapshots")
      .select("post_id, views_count, plays_count, collected_at")
      .in("post_id", ids)
      .order("collected_at", { ascending: false });

    // Latest snapshot per post
    const latestByPost = new Map<string, { views_count: number | null; plays_count: number | null }>();
    for (const s of snaps ?? []) {
      if (!latestByPost.has(s.post_id)) latestByPost.set(s.post_id, s);
    }

    const totalViews = [...latestByPost.values()].reduce(
      (sum, s) => sum + (s.views_count ?? s.plays_count ?? 0),
      0
    );

    const { data: latestSnap } = await adminClient
      .from("instagram_account_snapshots")
      .select("id")
      .eq("instagram_account_id", accountId)
      .order("collected_at", { ascending: false })
      .limit(1)
      .single();

    if (latestSnap?.id) {
      await adminClient
        .from("instagram_account_snapshots")
        .update({ total_views: totalViews })
        .eq("id", latestSnap.id);
    }
  } catch {
    // Non-fatal — analytics data is best-effort
  }
}

/** Full profile + reels scan for a single account. Used for initial auto-scan. */
export async function runFullScan(
  adminClient: AdminClient,
  accountId: string,
  handle: string,
  apifyKey: string
): Promise<void> {
  // 1. Profile scan
  try {
    const profileRunId = await startApifyRun("profile", handle, apifyKey, 50);
    const profileRun = await waitForRun(profileRunId, apifyKey, 180_000);
    const profileItems = (await fetchDataset(profileRun.defaultDatasetId, apifyKey)) as ApifyProfile[];

    if (profileItems?.length) {
      const profile = profileItems[0];
      await adminClient.from("instagram_account_snapshots").insert({
        instagram_account_id: accountId,
        followers_count: profile.followersCount ?? null,
        following_count: profile.followsCount ?? null,
        posts_count: profile.postsCount ?? null,
        bio: profile.biography ?? null,
        is_verified: profile.verified ?? false,
        profile_pic_url: profile.profilePicUrlHD ?? profile.profilePicUrl ?? null,
        apify_run_id: profileRunId,
      });
      if (profile.latestPosts?.length) {
        await upsertPosts(adminClient, accountId, profileRunId, profile.latestPosts);
      }
    }
  } catch {
    // Continue even if profile scan fails
  }

  // 2. Reels scan
  try {
    const reelsRunId = await startApifyRun("reels", handle, apifyKey, 200);
    const reelsRun = await waitForRun(reelsRunId, apifyKey, 270_000);
    const reelItems = (await fetchDataset(reelsRun.defaultDatasetId, apifyKey)) as ApifyPost[];
    if (reelItems?.length) {
      await upsertPosts(adminClient, accountId, reelsRunId, reelItems);
    }
  } catch {
    // Non-fatal
  }

  // 3. Update total_views in the account snapshot
  await updateTotalViews(adminClient, accountId);
}
