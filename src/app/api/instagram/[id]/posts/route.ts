import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function verifyAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

type Period = "today" | "week" | "month" | "inception";

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  switch (period) {
    case "today": return today;
    case "week": {
      const d = new Date(today);
      const dow = today.getUTCDay();
      d.setUTCDate(today.getUTCDate() - (dow === 0 ? 6 : dow - 1));
      return d;
    }
    case "month":
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    case "inception":
      return null; // all-time, no start cutoff
  }
}

/**
 * GET /api/instagram/[id]/posts
 * Paramètres :
 *   limit  : nombre max (défaut 200, max 500)
 *   type   : filtre post_type
 *   period : today | week | month | inception → calcule views_delta (latest - start)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10),
    500
  );
  const type = req.nextUrl.searchParams.get("type");
  const periodParam = (req.nextUrl.searchParams.get("period") ?? "inception") as Period;
  const periodStart = getPeriodStart(periodParam);
  const periodStartIso = periodStart?.toISOString() ?? null;

  const adminClient = createAdminClient();

  let query = adminClient
    .from("instagram_posts")
    .select("*")
    .eq("instagram_account_id", id)
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (type && ["Image", "Video", "Reel", "Sidecar"].includes(type)) {
    query = query.eq("post_type", type);
  }

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!posts || posts.length === 0) return NextResponse.json({ posts: [] });

  const postIds = posts.map((p) => p.id);

  // Fetch ALL snapshots for these posts (sorted newest first)
  const { data: allSnapshots } = await adminClient
    .from("instagram_post_snapshots")
    .select("post_id, likes_count, comments_count, views_count, plays_count, collected_at")
    .in("post_id", postIds)
    .order("collected_at", { ascending: false });

  const snaps = allSnapshots ?? [];

  // Latest snapshot per post
  const latestByPost = new Map<string, typeof snaps[number]>();
  // Snapshot closest to period start (at or before)
  const startByPost = new Map<string, typeof snaps[number]>();

  for (const snap of snaps) {
    if (!latestByPost.has(snap.post_id)) {
      latestByPost.set(snap.post_id, snap);
    }
    // Best period-start snapshot: latest one that is <= periodStartIso
    if (periodStartIso && snap.collected_at <= periodStartIso) {
      if (!startByPost.has(snap.post_id)) {
        startByPost.set(snap.post_id, snap);
      }
    }
  }

  const enriched = posts.map((post) => {
    const latest = latestByPost.get(post.id) ?? null;
    const startSnap = startByPost.get(post.id) ?? null;

    // Views delta for the period (views_count is cumulative all-time from Instagram)
    const latestViews = latest?.views_count ?? latest?.plays_count ?? null;
    const startViews = startSnap?.views_count ?? startSnap?.plays_count ?? null;

    let views_delta: number | null = null;
    if (latestViews != null) {
      if (periodParam === "inception" || startViews == null) {
        // inception or no prior snapshot → show total
        views_delta = latestViews;
      } else {
        views_delta = Math.max(0, latestViews - startViews);
      }
    }

    return {
      ...post,
      latest_snapshot: latest,
      views_delta,
      has_period_start: startSnap != null,
    };
  });

  return NextResponse.json({ posts: enriched, period: periodParam, period_start: periodStartIso });
}
