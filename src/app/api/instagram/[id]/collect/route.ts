import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { upsertPosts as sharedUpsertPosts, mapPostType } from "@/lib/instagram/apify-collect";

const APIFY_PROFILE_ACTOR = "apify~instagram-scraper";
const APIFY_REELS_ACTOR  = "apify~instagram-reel-scraper";
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
    return NextResponse.json({ runId, status, snapshotSaved: false, postsSaved: 0 });
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
    const result = await sharedUpsertPosts(adminClient, id, runId, posts);
    postsSaved = result.postsSaved;
    upsertErrors = result.errors;
  } else {
    // ── Reels / posts scan ────────────────────────────────────
    const posts = items as ApifyPost[];
    const result = await sharedUpsertPosts(adminClient, id, runId, posts);
    postsSaved = result.postsSaved;
    upsertErrors = result.errors;
    snapshotSaved = false;
  }

  return NextResponse.json({
    runId,
    status,
    snapshotSaved,
    postsSaved,
    finishedAt: run.finishedAt ?? null,
    // debug info (hidden from UI but useful in logs)
    _debug: upsertErrors.length > 0 ? { errors: upsertErrors.slice(0, 3), itemsRaw: items.length } : undefined,
  });
}

// ── Types ────────────────────────────────────────────────────
type ApifyItem = ApifyInstagramProfile | ApifyPost;

// Re-use types from shared module (compatible shape)
type ApifyPost = Parameters<typeof sharedUpsertPosts>[3][number];

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
