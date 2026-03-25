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

/** GET /api/instagram/[id]/snapshots?limit=30
 *  Retourne l'historique des snapshots de compte (évolution followers etc.)
 *  triés du plus récent au plus ancien.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "90", 10),
    365
  );

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("instagram_account_snapshots")
    .select("*")
    .eq("instagram_account_id", id)
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ snapshots: data ?? [] });
}
