import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function verifyAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

type Params = Promise<{ postId: string }>;

/**
 * GET /api/instagram/posts/[postId]/metadata
 * Retourne les métadonnées créatives d'un post.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("instagram_post_metadata")
    .select("*")
    .eq("post_id", postId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ metadata: data ?? null });
}

/**
 * PUT /api/instagram/posts/[postId]/metadata
 * Upsert les métadonnées créatives d'un post.
 * Body: Partial<PostMetadata>
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Params }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const body = await req.json().catch(() => ({}));

  // Whitelist des champs autorisés
  const allowed = [
    "outfit", "backdrop", "lighting", "shot_type", "duration_seconds", "contrast_level",
    "hook_type", "hook_description",
    "content_description", "energy_level", "editing_pace",
    "music_name", "audio_type",
    "tested_variable", "notes",
  ] as const;

  const payload: Record<string, unknown> = { post_id: postId };
  for (const key of allowed) {
    if (key in body) payload[key] = body[key] === "" ? null : body[key];
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("instagram_post_metadata")
    .upsert(payload, { onConflict: "post_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ metadata: data });
}
