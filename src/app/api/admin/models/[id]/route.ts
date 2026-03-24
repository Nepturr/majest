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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, avatar_url, persona, lora_id, lora_thumbnail_url, brand_notes, status } = body;

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (name !== undefined) updates.name = name.trim();
  if (avatar_url !== undefined) updates.avatar_url = avatar_url?.trim() || null;
  if (persona !== undefined) updates.persona = persona?.trim() || null;
  if (lora_id !== undefined) updates.lora_id = lora_id?.trim() || null;
  if (lora_thumbnail_url !== undefined) updates.lora_thumbnail_url = lora_thumbnail_url?.trim() || null;
  if (brand_notes !== undefined) updates.brand_notes = brand_notes?.trim() || null;
  if (status !== undefined) updates.status = status;

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("models")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ model: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("models").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
