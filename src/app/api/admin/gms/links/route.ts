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

/** GET /api/admin/gms/links
 *  Returns all GetMySocial links with isAssigned flag.
 */
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data: setting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "gms_api_key")
    .single();

  if (!setting?.value) {
    return NextResponse.json({ error: "GetMySocial API key not configured." }, { status: 400 });
  }

  const res = await fetch("https://getmysocial.com/api/v2/links", {
    headers: { "x-api-key": setting.value },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `GMS API error: HTTP ${res.status}` }, { status: 502 });
  }

  const json = await res.json();
  const rawLinks: Record<string, unknown>[] = json.data ?? json.links ?? json ?? [];

  // Get already-assigned GMS link IDs from our DB
  const { data: assigned } = await adminClient
    .from("instagram_accounts")
    .select("get_my_social_link_id")
    .not("get_my_social_link_id", "is", null);

  const assignedIds = new Set((assigned ?? []).map((r) => r.get_my_social_link_id));

  const links = rawLinks.map((link) => {
    const id = (link._id ?? link.id ?? "") as string;

    // Try every plausible title field
    const title = (
      link.title ??
      link.name ??
      link.label ??
      link.alias ??
      link.slug ??
      link.username ??
      link.handle ??
      link.page_title ??
      link.pageTitle
    ) as string | undefined;

    // Try every plausible URL field
    const url = (
      link.shortUrl ??
      link.short_url ??
      link.shortlink ??
      link.short_link ??
      link.url ??
      link.destination ??
      link.redirect_url ??
      link.link
    ) as string | undefined;

    // Best display: title if meaningful, else the URL slug, else short ID
    const displayTitle = title?.trim()
      ? title.trim()
      : url?.trim()
      ? url.replace(/^https?:\/\//, "")   // strip protocol for cleaner display
      : id.slice(0, 12) + "…";

    return {
      id,
      title: displayTitle,
      url: url ?? null,
      isAssigned: assignedIds.has(id),
    };
  });

  return NextResponse.json({ links });
}
