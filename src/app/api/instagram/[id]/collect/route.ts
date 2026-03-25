import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const APIFY_ACTOR = "apify~instagram-scraper";
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

  // Profile mode → détails + ~12 posts
  // Reels mode   → onglet /reels/ → 200 réels
  const runPayload =
    mode === "reels"
      ? {
          directUrls: [`https://www.instagram.com/${handle}/reels/`],
          resultsType: "posts",
          resultsLimit: 200,
        }
      : {
          directUrls: [`https://www.instagram.com/${handle}/`],
          resultsType: "details",
          resultsLimit: 50,
        };

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${apiKey}`,
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

  const statusRes = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs/${runId}?token=${apiKey}`
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
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&clean=true&format=json`
  );
  if (!itemsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch Apify dataset." }, { status: 502 });
  }
  const items: ApifyItem[] = await itemsRes.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ runId, status, snapshotSaved: false, postsSaved: 0 });
  }

  const adminClient = createAdminClient();
  let snapshotSaved = false;
  let postsSaved = 0;

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
    postsSaved = await upsertPosts(adminClient, id, runId, posts);
  } else {
    // ── Reels / posts scan ────────────────────────────────────
    // items IS the posts array directly
    const posts = items as ApifyPost[];
    postsSaved = await upsertPosts(adminClient, id, runId, posts);
    snapshotSaved = false; // no profile snapshot in reels mode
  }

  return NextResponse.json({
    runId,
    status,
    snapshotSaved,
    postsSaved,
    finishedAt: run.finishedAt ?? null,
  });
}

// ─────────────────────────────────────────────────────────────
// Helper: upsert posts + snapshots, returns count saved
// ─────────────────────────────────────────────────────────────
async function upsertPosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  accountId: string,
  runId: string,
  posts: ApifyPost[]
): Promise<number> {
  let count = 0;
  for (const post of posts) {
    if (!post.shortCode) continue;

    const postType = mapPostType(post);

    const { data: upsertedPost } = await adminClient
      .from("instagram_posts")
      .upsert(
        {
          instagram_account_id: accountId,
          shortcode: post.shortCode,
          post_type: postType,
          url: post.url ?? `https://www.instagram.com/p/${post.shortCode}/`,
          caption: post.caption ?? null,
          thumbnail_url: post.displayUrl ?? null,
          posted_at: post.timestamp ?? null,
          video_duration: post.videoDuration ?? null,
          last_seen_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "shortcode", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (!upsertedPost?.id) continue;

    const { error: postSnapErr } = await adminClient
      .from("instagram_post_snapshots")
      .insert({
        post_id: upsertedPost.id,
        likes_count: post.likesCount ?? null,
        comments_count: post.commentsCount ?? null,
        views_count: post.videoViewCount ?? null,
        plays_count: post.videoPlayCount ?? null,
        apify_run_id: runId,
      });

    if (!postSnapErr) count++;
  }
  return count;
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
