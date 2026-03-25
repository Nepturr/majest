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

/** GET /api/admin/settings?keys=gms_api_key,other_key */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = req.nextUrl.searchParams.get("keys")?.split(",").filter(Boolean);

  const adminClient = createAdminClient();
  const query = adminClient.from("settings").select("key, value");
  if (keys?.length) query.in("key", keys);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return as a plain object { key: value }
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.key] = row.value;

  return NextResponse.json({ settings: result });
}

/** POST /api/admin/settings  body: { key: string, value: string } */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value are required." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
