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

/** GET /api/admin/phone-groups */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: groups, error } = await db
    .from("phone_groups")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with phone count
  const { data: phones } = await db.from("phones").select("group_id");
  const countMap: Record<string, number> = {};
  for (const p of phones ?? []) {
    if (p.group_id) countMap[p.group_id] = (countMap[p.group_id] ?? 0) + 1;
  }

  const enriched = (groups ?? []).map((g) => ({ ...g, phone_count: countMap[g.id] ?? 0 }));
  return NextResponse.json({ groups: enriched });
}

/** POST /api/admin/phone-groups */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, color, sort_order } = body;
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("phone_groups")
    .insert({ name: name.trim(), color: color ?? "#6366f1", sort_order: sort_order ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data }, { status: 201 });
}
