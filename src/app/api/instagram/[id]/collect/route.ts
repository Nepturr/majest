import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const APIFY_PROFILE_ACTOR = "apify~instagram-scraper";
const APIFY_REELS_ACTOR  = "apify~instagram-reel-scraper"; // scraper dédié réels
const APIFY_BASE = "https://api.apify.com/v2";

async function verifyAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

async function getApifyKey(): Promise<string | null> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "apify_api_key")
    .single();
  return data?.value ?? null;
}

// ─────────────────────────────────────────────────────────────
// POST /api/instagram/[id]/collect
// Body: { mode?: "profile" | "reels" }
//   profile (default) : resultsType "details" → profil + 12 derniers posts
//   reels             : scrape l'onglet /reels/ → jusqu'à 200 réels
// ─────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const adminClient = createAdminClient();

  const { data: igAccount, error: igError } = await adminClient
    .from("instagram_accounts")
    .select("id, instagram_handle")
    .eq("id", id)
    .single();

  if (igError || !igAccount) {
    return NextResponse.json({ error: "Instagram account not found." }, { status: 404 });
  }

  const apiKey = await getApifyKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Apify API key not configured." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: "profile" | "reels" = body.mode === "reels" ? "reels" : "profile";

  const handle = igAccount.instagram_handle.replace(/^@/, "");

  // Profile mode → instagram-scraper : détails profil + ~12 derniers posts
  // Reels mode   → instagram-reel-scraper : jusqu'à 200 réels de l'onglet Réels
  const actor = mode === "reels" ? APIFY_REELS_ACTOR : APIFY_PROFILE_ACTOR;
  const runPayload =
    mode === "reels"
      ? {
          username: [handle],   // instagram-reel-scraper accepte un tableau de handles
          resultsLimit: 200,
        }
      : {
          directUrls: [`https://www.instagram.com/${handle}/`],
          resultsType: "details",
          resultsLimit: 50,
        };

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${actor}/runs?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runPayload),
    }
  );

  if (!runRes.ok) {
    const errBody = await runRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: errBody?.error?.message ?? `Apify error ${runRes.status}` },
      { status: 502 }
    );
  }

  const runData = await runRes.json();
  const run = runData?.data ?? runData;

  return NextResponse.json({
    runId: run.id,
    mode,
    status: run.status,
    datasetId: run.defaultDatasetId ?? null,
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/instagram/[id]/collect?runId=xxx
// Vérifie le statut. Si SUCCEEDED → persiste les données.
// Détecte automatiquement le mode via la structure des items.
// ─────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId query param is required." }, { status: 400 });
  }

  const apiKey = await getApifyKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Apify API key not configured." }, { status: 400 });
  }

  // /actor-runs/{runId} = endpoint générique indépendant de l'actor
  const statusRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`
  );
  if (!statusRes.ok) {
    return NextResponse.json({ error: "Failed to fetch run status from Apify." }, { status: 502 });
  }
  const statusData = await statusRes.json();
  const run = statusData?.data ?? statusData;
  const status: string = run.status;

  if (status !== "SUCCEEDED") {
    return NextResponse.json({ runId, status, snapshotSaved: false, postsSaved: 0 });
  }

  const datasetId: string = run.defaultDatasetId;
  // clean=true élimine agressivement des items — on l'enlève et on pagine
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json&limit=500`
  );
  if (!itemsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch Apify dataset." }, { status: 502 });
  }
  const items: ApifyItem[] = await itemsRes.json();

  if (!items || items.length === 0) {
    // Retourne aussi le datasetId pour diagnostic
    return NextResponse.json({ runId, status, snapshotSaved: false, postsSaved: 0, datasetId, itemsRaw: 0 });
  }

  const adminClient = createAdminClient();
  let snapshotSaved = false;
  let postsSaved = 0;
  let upsertErrors: string[] = [];

  // Detect mode: profile scan has `followersCount` at root
  const isProfileScan = "followersCount" in items[0] || "latestPosts" in items[0];

  if (isProfileScan) {
    // ── Profile scan ──────────────────────────────────────────
    const profile = items[0] as ApifyInstagramProfile;

    const { error: snapErr } = await adminClient
      .from("instagram_account_snapshots")
      .insert({
        instagram_account_id: id,
        followers_count: profile.followersCount ?? null,
        following_count: profile.followsCount ?? null,
        posts_count: profile.postsCount ?? null,
        bio: profile.biography ?? null,
        is_verified: profile.verified ?? false,
        profile_pic_url: profile.profilePicUrlHD ?? profile.profilePicUrl ?? null,
        apify_run_id: runId,
      });

    if (!snapErr) snapshotSaved = true;

    const posts: ApifyPost[] = profile.latestPosts ?? [];
    const result = await upsertPosts(adminClient, id, runId, posts);
    postsSaved = result.postsSaved;
    upsertErrors = result.errors;
  } else {
    // ── Reels / posts scan ────────────────────────────────────
    const posts = items as ApifyPost[];
    const result = await upsertPosts(adminClient, id, runId, posts);
    postsSaved = result.postsSaved;
    upsertErrors = result.errors;
    snapshotSaved = false;
  }

  return NextResponse.json({
    runId,
    status,
    snapshotSaved,
    postsSaved,
    itemsRaw: items.length,
    datasetId,
    // Premiers erreurs pour diagnostic (max 5)
    errors: upsertErrors.slice(0, 5),
    finishedAt: run.finishedAt ?? null,
  });
}

// ─────────────────────────────────────────────────────────────
// Helper: upsert posts + snapshots
// ─────────────────────────────────────────────────────────────
async function upsertPosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  accountId: string,
  runId: string,
  posts: ApifyPost[]
): Promise<{ postsSaved: number; errors: string[] }> {
  let postsSaved = 0;
  const errors: string[] = [];

  for (const post of posts) {
    // Le champ peut être shortCode (camelCase) ou shortcode (lowercase selon l'acteur)
    const sc = post.shortCode ?? (post as Record<string, unknown>).shortcode as string | undefined;
    if (!sc) {
      errors.push(`item sans shortCode: ${JSON.stringify(Object.keys(post))}`);
      continue;
    }

    const postType = mapPostType(post);

    const { data: upsertedPost, error: upsertErr } = await adminClient
      .from("instagram_posts")
      .upsert(
        {
          instagram_account_id: accountId,
          shortcode: sc,
          post_type: postType,
          url: post.url ?? `https://www.instagram.com/p/${sc}/`,
          caption: post.caption ?? null,
          thumbnail_url: post.displayUrl ?? null,
          posted_at: post.timestamp ?? null,
          video_duration: post.videoDuration != null ? Math.round(post.videoDuration) : null,
          last_seen_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "shortcode", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (upsertErr || !upsertedPost?.id) {
      errors.push(`upsert post ${sc}: ${upsertErr?.message ?? "no id returned"}`);
      continue;
    }

    const { error: snapErr } = await adminClient
      .from("instagram_post_snapshots")
      .insert({
        post_id: upsertedPost.id,
        likes_count: post.likesCount ?? null,
        comments_count: post.commentsCount ?? null,
        views_count: post.videoViewCount ?? null,
        plays_count: post.videoPlayCount ?? null,
        apify_run_id: runId,
      });

    if (snapErr) {
      // Snapshot en doublon (même run déjà sauvegardé) — on ignore, le post est ok
      if (!snapErr.message?.includes("duplicate") && !snapErr.code?.includes("23505")) {
        errors.push(`snapshot ${sc}: ${snapErr.message}`);
      }
    }

    postsSaved++;

    // Auto-persist duration_seconds
    if (post.videoDuration != null) {
      await adminClient
        .from("instagram_post_metadata")
        .upsert(
          { post_id: upsertedPost.id, duration_seconds: Math.round(post.videoDuration) },
          { onConflict: "post_id", ignoreDuplicates: false }
        );
    }
  }
  return { postsSaved, errors };
}

// ── Types ────────────────────────────────────────────────────
type ApifyItem = ApifyInstagramProfile | ApifyPost;

interface ApifyPost {
  shortCode?: string;
  type?: string;
  productType?: string;
  url?: string;
  caption?: string;
  displayUrl?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoDuration?: number; // durée en secondes (réels/vidéos)
}

interface ApifyInstagramProfile {
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

function mapPostType(post: ApifyPost): "Image" | "Video" | "Reel" | "Sidecar" {
  if (post.productType === "clips") return "Reel";
  if (post.productType === "igtv") return "Video";
  const t = (post.type ?? "").toLowerCase();
  if (t === "video") return "Video";
  if (t === "sidecar" || t === "graphsidecar") return "Sidecar";
  return "Image";
}
