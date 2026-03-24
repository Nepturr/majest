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

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("models")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ models: data });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, avatar_url, persona, lora_id, lora_thumbnail_url, brand_notes, status } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("models")
    .insert({
      name: name.trim(),
      avatar_url: avatar_url?.trim() || null,
      persona: persona?.trim() || null,
      lora_id: lora_id?.trim() || null,
      lora_thumbnail_url: lora_thumbnail_url?.trim() || null,
      brand_notes: brand_notes?.trim() || null,
      status: status ?? "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ model: data }, { status: 201 });
}
