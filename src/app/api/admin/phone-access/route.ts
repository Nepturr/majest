import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

/** GET /api/admin/phone-access */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("phone_access")
    .select(`
      *,
      phone:phones(id, label, device_id),
      group:phone_groups(id, name, color),
      profile:profiles(id, full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ access: data ?? [] });
}

/** POST /api/admin/phone-access — grant access */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { user_id, phone_id, group_id } = body;

  if (!user_id) return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  if (!phone_id && !group_id) return NextResponse.json({ error: "phone_id or group_id is required." }, { status: 400 });
  if (phone_id && group_id) return NextResponse.json({ error: "Provide either phone_id or group_id, not both." }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("phone_access")
    .insert({ user_id, phone_id: phone_id ?? null, group_id: group_id ?? null })
    .select(`*, phone:phones(id, label, device_id), group:phone_groups(id, name, color), profile:profiles(id, full_name, email)`)
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Access already granted." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ access: data }, { status: 201 });
}
