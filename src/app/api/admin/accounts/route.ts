import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

/** GET /api/admin/accounts?model_id=xxx */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const modelId = req.nextUrl.searchParams.get("model_id");
  const adminClient = createAdminClient();

  const query = adminClient
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (modelId) query.eq("model_id", modelId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data });
}

/** POST /api/admin/accounts — Link an OF account to a model */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { model_id, ofapi_account_id, of_username, of_avatar_url } = await req.json();

  if (!model_id || !ofapi_account_id) {
    return NextResponse.json(
      { error: "model_id and ofapi_account_id are required." },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Check if already assigned
  const { data: existing } = await adminClient
    .from("accounts")
    .select("id, model_id, models(name)")
    .eq("ofapi_account_id", ofapi_account_id)
    .maybeSingle();

  if (existing) {
    const modelName = (existing.models as { name: string } | null)?.name ?? "another model";
    return NextResponse.json(
      { error: `This account is already linked to ${modelName}.` },
      { status: 409 }
    );
  }

  const { data, error } = await adminClient
    .from("accounts")
    .insert({
      model_id,
      ofapi_account_id,
      of_username: of_username ?? null,
      of_avatar_url: of_avatar_url ?? null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This OF account is already linked to a model." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
