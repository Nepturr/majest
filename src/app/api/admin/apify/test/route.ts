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

/** GET /api/admin/apify/test?handle=username
 *  Sans handle : vérifie la clé (GET /v2/users/me)
 *  Avec handle  : lance un reel scraper sur ce compte et retourne les 3 premiers items bruts
 *                 pour diagnostiquer ce que l'acteur renvoie vraiment.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "apify_api_key")
    .single();

  const apiKey = setting?.value;
  if (!apiKey) {
    return NextResponse.json({ error: "Apify API key not configured." }, { status: 400 });
  }

  const handle = req.nextUrl.searchParams.get("handle");

  // ── Mode diagnostic : lance reel scraper sur le handle et attend ──────────
  if (handle) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs?token=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: [handle.replace(/^@/, "")], resultsLimit: 5 }),
        }
      );
      if (!runRes.ok) {
        const b = await runRes.json().catch(() => ({}));
        return NextResponse.json({ error: b?.error?.message ?? `Apify ${runRes.status}` }, { status: 502 });
      }
      const runData = await runRes.json();
      const run = runData?.data ?? runData;
      const runId: string = run.id;

      // Attendre max 3 min
      let status = run.status;
      let datasetId = run.defaultDatasetId;
      for (let i = 0; i < 36 && status !== "SUCCEEDED" && status !== "FAILED"; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`);
        const sd = await s.json();
        status = sd?.data?.status ?? sd?.status;
        datasetId = sd?.data?.defaultDatasetId ?? sd?.defaultDatasetId ?? datasetId;
      }

      // Fetch raw items
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&format=json&limit=5`
      );
      const items = await itemsRes.json().catch(() => []);

      return NextResponse.json({
        runId, status, datasetId,
        itemsCount: Array.isArray(items) ? items.length : "error",
        sample: Array.isArray(items) ? items.slice(0, 3).map((it: Record<string, unknown>) => ({
          shortCode: it.shortCode,
          type: it.type,
          productType: it.productType,
          videoViewCount: it.videoViewCount,
          videoDuration: it.videoDuration,
          timestamp: it.timestamp,
        })) : items,
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Mode vérification clé ────────────────────────────────────
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${apiKey}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.error?.message ?? `Apify returned ${res.status}.` },
        { status: 400 }
      );
    }

    const body = await res.json();
    const user = body?.data ?? body;

    return NextResponse.json({
      ok: true,
      username: user.username ?? null,
      plan: user.plan ?? null,
      actorRunsCount: user.profile?.actorRunsCount ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach Apify API." }, { status: 500 });
  }
}
