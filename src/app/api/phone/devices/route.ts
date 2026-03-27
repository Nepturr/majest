import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET /api/phone/devices — returns phones accessible to the current user */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  // Check role
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Admins see all active phones
  if (isAdmin) {
    const { data, error } = await db
      .from("phones")
      .select("*, group:phone_groups(id, name, color)")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ phones: data ?? [] });
  }

  // Regular users: fetch their access entries
  const { data: accessEntries } = await db
    .from("phone_access")
    .select("phone_id, group_id")
    .eq("user_id", user.id);

  const directPhoneIds = (accessEntries ?? [])
    .filter((a) => a.phone_id !== null)
    .map((a) => a.phone_id as string);

  const accessGroupIds = (accessEntries ?? [])
    .filter((a) => a.group_id !== null)
    .map((a) => a.group_id as string);

  // Fetch phones by direct access OR by group access
  const conditions: string[] = [];
  if (directPhoneIds.length > 0) conditions.push(`id.in.(${directPhoneIds.join(",")})`);
  if (accessGroupIds.length > 0) conditions.push(`group_id.in.(${accessGroupIds.join(",")})`);

  if (conditions.length === 0) {
    return NextResponse.json({ phones: [] });
  }

  const { data: phones, error } = await db
    .from("phones")
    .select("*, group:phone_groups(id, name, color)")
    .eq("status", "active")
    .or(conditions.join(","))
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phones: phones ?? [] });
}
