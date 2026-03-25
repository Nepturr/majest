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

/** GET /api/instagram/[id]/posts?limit=30&type=Video
 *  Retourne les posts d'un compte IG avec le dernier snapshot de métriques joint.
 *  Triés du plus récent au plus ancien.
 *  Paramètres :
 *    - limit  : nombre max de posts (défaut 30, max 100)
 *    - type   : filtre sur post_type ("Image" | "Video" | "Sidecar")
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10),
    100
  );
  const type = req.nextUrl.searchParams.get("type");

  const adminClient = createAdminClient();

  let query = adminClient
    .from("instagram_posts")
    .select("*")
    .eq("instagram_account_id", id)
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (type && ["Image", "Video", "Sidecar"].includes(type)) {
    query = query.eq("post_type", type);
  }

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  // Récupérer le dernier snapshot pour chaque post
  const postIds = posts.map((p) => p.id);
  const { data: allSnapshots } = await adminClient
    .from("instagram_post_snapshots")
    .select("*")
    .in("post_id", postIds)
    .order("collected_at", { ascending: false });

  // On garde uniquement le snapshot le plus récent par post
  const latestByPost = new Map<string, Record<string, unknown>>();
  for (const snap of allSnapshots ?? []) {
    if (!latestByPost.has(snap.post_id)) {
      latestByPost.set(snap.post_id, snap);
    }
  }

  const enriched = posts.map((post) => ({
    ...post,
    latest_snapshot: latestByPost.get(post.id) ?? null,
  }));

  return NextResponse.json({ posts: enriched });
}
