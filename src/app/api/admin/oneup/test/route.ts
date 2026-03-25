import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "oneup_api_key")
    .single();

  if (!setting?.value) {
    return NextResponse.json({ error: "OneUp API key not configured" }, { status: 400 });
  }

  const res = await fetch(
    `https://www.oneupapp.io/api/listcategory?apiKey=${setting.value}`
  );
  const json = await res.json();

  if (!res.ok || json.error) {
    return NextResponse.json({ error: "Invalid OneUp API key", details: json }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    categoryCount: (json.data ?? []).length,
  });
}
