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

/**
 * GET /api/admin/gms/test
 * - Vérifie la clé API GMS (/api/v2/links)
 * - Optionnel: ?linkId=xxx → appelle l'endpoint analytics overview pour ce lien
 *   et retourne la réponse brute (pour déboguer les champs renvoyés)
 * - Si linkId absent, essaie avec le 1er compte IG ayant un get_my_social_link_id
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "gms_api_key")
    .single();

  if (!row?.value) {
    return NextResponse.json({ error: "No API key configured." }, { status: 400 });
  }

  const apiKey = row.value as string;

  // ── 1. Vérifier la clé ──────────────────────────────────────
  let linkCount = 0;
  try {
    const res = await fetch("https://getmysocial.com/api/v2/links?limit=10", {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.error?.message ?? `HTTP ${res.status}` },
        { status: 400 }
      );
    }

    const data = await res.json();
    linkCount = data?.meta?.pagination?.totalItems ?? data?.data?.length ?? 0;
  } catch {
    return NextResponse.json({ error: "Network error — could not reach GetMySocial." }, { status: 502 });
  }

  // ── 2. Debug analytics pour un linkId ───────────────────────
  let linkId = req.nextUrl.searchParams.get("linkId");

  // Si pas de linkId dans la query, cherche le premier compte IG configuré
  if (!linkId) {
    const { data: acc } = await adminClient
      .from("instagram_accounts")
      .select("get_my_social_link_id, instagram_handle")
      .not("get_my_social_link_id", "is", null)
      .limit(1)
      .single();
    if (acc?.get_my_social_link_id) {
      linkId = acc.get_my_social_link_id;
    }
  }

  let analyticsDebug: Record<string, unknown> | null = null;

  if (linkId) {
    try {
      const [overviewRes, countriesRes] = await Promise.all([
        fetch(
          `https://getmysocial.com/api/v2/analytics/overview?scope=link&linkId=${linkId}`,
          { headers: { "x-api-key": apiKey } }
        ),
        fetch(
          `https://getmysocial.com/api/v2/analytics/dimensions/countries?scope=link&linkId=${linkId}`,
          { headers: { "x-api-key": apiKey } }
        ),
      ]);

      const overviewStatus = overviewRes.status;
      const overviewRaw = await overviewRes.json().catch(() => null);

      const countriesStatus = countriesRes.status;
      const countriesRaw = await countriesRes.json().catch(() => null);

      // Essayer clé alternative Bearer
      const bearerRes = await fetch(
        `https://getmysocial.com/api/v2/analytics/overview?scope=link&linkId=${linkId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const bearerStatus = bearerRes.status;
      const bearerRaw = await bearerRes.json().catch(() => null);

      analyticsDebug = {
        linkId,
        overview: { status: overviewStatus, body: overviewRaw },
        countries: { status: countriesStatus, body: countriesRaw },
        bearer_attempt: { status: bearerStatus, body: bearerRaw },
      };
    } catch (e) {
      analyticsDebug = { error: String(e) };
    }
  }

  return NextResponse.json({ success: true, linkCount, analyticsDebug });
}
