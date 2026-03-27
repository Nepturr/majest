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

/** GET /api/admin/phones */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("phones")
    .select("*, group:phone_groups(id, name, color)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phones: data ?? [] });
}

/** POST /api/admin/phones */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { device_id, label, group_id, status, sort_order, width, height, model } = body;

  if (!device_id || !label) {
    return NextResponse.json({ error: "device_id and label are required." }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("phones")
    .insert({
      device_id: device_id.trim().toUpperCase(),
      label: label.trim(),
      group_id: group_id || null,
      status: status ?? "active",
      sort_order: sort_order ?? 0,
      width: width ?? null,
      height: height ?? null,
      model: model?.trim() || null,
    })
    .select("*, group:phone_groups(id, name, color)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A phone with this MAC address already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ phone: data }, { status: 201 });
}
