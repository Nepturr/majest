import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

/** GET /api/admin/ofapi/test — Verifies the stored OnlyFansAPI key works */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "ofapi_api_key")
    .single();

  if (!row?.value) {
    return NextResponse.json({ error: "No API key configured." }, { status: 400 });
  }

  try {
    // POST a client session — validates auth without needing an account_id
    const res = await fetch("https://app.onlyfansapi.com/api/client-sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${row.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        display_name: "MajestGPT connection test",
        client_reference_id: "majest-test",
        proxy_country: "us",
      }),
    });

    // 401 = bad key, anything else means the key is recognized
    if (res.status === 401) {
      return NextResponse.json({ error: "Invalid API key." }, { status: 400 });
    }

    const data = await res.json().catch(() => ({}));

    // Check credits balance from response meta
    const balance: number = data?._meta?._credits?.balance ?? null;

    return NextResponse.json({
      success: true,
      balance,
    });
  } catch {
    return NextResponse.json(
      { error: "Network error — could not reach OnlyFansAPI." },
      { status: 502 }
    );
  }
}
