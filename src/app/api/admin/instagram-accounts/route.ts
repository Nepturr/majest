import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

/** GET /api/admin/instagram-accounts */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("instagram_accounts")
    .select(`
      *,
      model:models(name, avatar_url),
      of_account:accounts(of_username, of_avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}

/** POST /api/admin/instagram-accounts */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    model_id,
    of_account_id,
    instagram_handle,
    oneup_social_network_id,
    oneup_social_network_name,
    oneup_category_id,
    get_my_social_link_id,
    get_my_social_link_name,
    of_tracking_link_id,
    of_tracking_link_url,
    niche,
    status,
  } = body;

  if (!model_id || !instagram_handle) {
    return NextResponse.json(
      { error: "model_id and instagram_handle are required." },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Check duplicate instagram_handle
  const { data: existing } = await adminClient
    .from("instagram_accounts")
    .select("id")
    .eq("instagram_handle", instagram_handle.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Account @${instagram_handle.trim()} already exists.` },
      { status: 409 }
    );
  }

  const { data, error } = await adminClient
    .from("instagram_accounts")
    .insert({
      model_id,
      of_account_id: of_account_id || null,
      instagram_handle: instagram_handle.trim(),
      oneup_social_network_id: oneup_social_network_id || null,
      oneup_social_network_name: oneup_social_network_name || null,
      oneup_category_id: oneup_category_id || null,
      get_my_social_link_id: get_my_social_link_id || null,
      get_my_social_link_name: get_my_social_link_name || null,
      of_tracking_link_id: of_tracking_link_id || null,
      of_tracking_link_url: of_tracking_link_url || null,
      niche: niche || null,
      status: status ?? "active",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("oneup_social_network_id"))
        return NextResponse.json({ error: "This OneUp account is already assigned." }, { status: 409 });
      if (error.message.includes("get_my_social_link_id"))
        return NextResponse.json({ error: "This GetMySocial link is already assigned." }, { status: 409 });
      if (error.message.includes("of_tracking_link_id"))
        return NextResponse.json({ error: "This tracking link is already assigned." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
