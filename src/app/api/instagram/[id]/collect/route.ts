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

// ─────────────────────────────────────────────
// POST /api/instagram/[id]/collect
// Lance un run Apify asynchrone pour scraper le compte IG.
// Retourne immédiatement { runId, datasetId, status: "RUNNING" }.
// ─────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const adminClient = createAdminClient();

  // Récupérer le handle du compte IG
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

  const handle = igAccount.instagram_handle.replace(/^@/, "");
  const profileUrl = `https://www.instagram.com/${handle}/`;

  // Lancer le run Apify (asynchrone)
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [profileUrl],
        resultsType: "details",
        resultsLimit: 30,
        proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
      }),
    }
  );

  if (!runRes.ok) {
    const body = await runRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: body?.error?.message ?? `Apify error ${runRes.status}` },
      { status: 502 }
    );
  }

  const runData = await runRes.json();
  const run = runData?.data ?? runData;

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    datasetId: run.defaultDatasetId ?? null,
  });
}

// ─────────────────────────────────────────────
// GET /api/instagram/[id]/collect?runId=xxx
// Vérifie le statut d'un run Apify.
// Si SUCCEEDED → récupère les données et les stocke en DB.
// Retourne { status, snapshotSaved, postsSaved }.
// ─────────────────────────────────────────────
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

  // Vérifier le statut du run
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

  // Récupérer les items du dataset
  const datasetId: string = run.defaultDatasetId;
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&clean=true&format=json`
  );
  if (!itemsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch Apify dataset." }, { status: 502 });
  }
  const items: ApifyInstagramProfile[] = await itemsRes.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ runId, status, snapshotSaved: false, postsSaved: 0 });
  }

  const profile = items[0];
  const adminClient = createAdminClient();
  let snapshotSaved = false;
  let postsSaved = 0;

  // ── 1. Insérer le snapshot du compte ────────────────────────
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

  // ── 2. Insérer les posts + leurs snapshots ──────────────────
  const posts: ApifyPost[] = profile.latestPosts ?? [];

  for (const post of posts) {
    if (!post.shortCode) continue;

    const postType = mapPostType(post.type);

    // Upsert du post (structure invariante)
    const { data: upsertedPost } = await adminClient
      .from("instagram_posts")
      .upsert(
        {
          instagram_account_id: id,
          shortcode: post.shortCode,
          post_type: postType,
          url: post.url ?? `https://www.instagram.com/p/${post.shortCode}/`,
          caption: post.caption ?? null,
          thumbnail_url: post.displayUrl ?? null,
          posted_at: post.timestamp ?? null,
        },
        { onConflict: "shortcode", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (!upsertedPost?.id) continue;

    // Snapshot des métriques à cet instant
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

    if (!postSnapErr) postsSaved++;
  }

  return NextResponse.json({
    runId,
    status,
    snapshotSaved,
    postsSaved,
    finishedAt: run.finishedAt ?? null,
  });
}

// ── Types Apify ──────────────────────────────────────────────
interface ApifyPost {
  shortCode?: string;
  type?: string;
  url?: string;
  caption?: string;
  displayUrl?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
}

interface ApifyInstagramProfile {
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  verified?: boolean;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  latestPosts?: ApifyPost[];
}

function mapPostType(type?: string): "Image" | "Video" | "Sidecar" {
  if (!type) return "Image";
  const t = type.toLowerCase();
  if (t === "video" || t === "reel") return "Video";
  if (t === "sidecar" || t === "graphsidecar") return "Sidecar";
  return "Image";
}
