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

/**
 * GET /api/admin/ofapi/accounts
 * Returns all connected OF accounts from the OFAPI console,
 * enriched with assignment info from our DB.
 */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  // 1. Get OFAPI key
  const { data: row } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "ofapi_api_key")
    .single();

  if (!row?.value) {
    return NextResponse.json(
      { error: "OnlyFansAPI key not configured. Add it in Admin → API." },
      { status: 400 }
    );
  }

  // 2. Fetch connected accounts from OFAPI
  let ofAccounts: Array<{
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  }> = [];

  try {
    const res = await fetch("https://app.onlyfansapi.com/api/accounts", {
      headers: { Authorization: `Bearer ${row.value}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.message ?? `OnlyFansAPI returned HTTP ${res.status}` },
        { status: 400 }
      );
    }

    const body = await res.json();
    // Handle both { data: [...] } and direct array responses
    const raw = Array.isArray(body) ? body : (body?.data ?? []);

    ofAccounts = raw.map((a: Record<string, unknown>) => ({
      id: (a.id ?? a.account_id ?? "") as string,
      username: (a.username ?? a.login ?? "") as string,
      name: (a.name ?? a.display_name ?? null) as string | null,
      avatar: (a.avatar ?? a.avatar_url ?? null) as string | null,
    }));
  } catch {
    return NextResponse.json(
      { error: "Network error — could not reach OnlyFansAPI." },
      { status: 502 }
    );
  }

  // 3. Get all existing assignments from our DB
  const { data: existing } = await adminClient
    .from("accounts")
    .select("ofapi_account_id, model_id, models(name)")
    .not("ofapi_account_id", "is", null);

  const assignmentMap = new Map<string, { modelId: string; modelName: string }>();
  for (const row of existing ?? []) {
    if (row.ofapi_account_id) {
      assignmentMap.set(row.ofapi_account_id, {
        modelId: row.model_id,
        modelName: (row.models as { name: string } | null)?.name ?? "Unknown",
      });
    }
  }

  // 4. Enrich with assignment info
  const accounts = ofAccounts.map((a) => {
    const assignment = assignmentMap.get(a.id) ?? null;
    return {
      ...a,
      isAssigned: !!assignment,
      assignedToModelId: assignment?.modelId ?? null,
      assignedToModelName: assignment?.modelName ?? null,
    };
  });

  return NextResponse.json({ accounts });
}
