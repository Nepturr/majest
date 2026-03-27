import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { xp } from "@/lib/phone/xp-client";

async function getAccessContext(userId: string, phoneId: string) {
  const db = createAdminClient();

  const [{ data: profile }, { data: phone }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).single(),
    db.from("phones").select("device_id, group_id, width, height").eq("id", phoneId).single(),
  ]);

  if (!phone) return null;
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    // Check direct or group access
    const { data: access } = await db
      .from("phone_access")
      .select("id")
      .eq("user_id", userId)
      .or(`phone_id.eq.${phoneId}${phone.group_id ? `,group_id.eq.${phone.group_id}` : ""}`)
      .limit(1);
    if (!access || access.length === 0) return null;
  }

  const { data: setting } = await db.from("settings").select("value").eq("key", "mini_pc_ip").single();
  return { deviceId: phone.device_id, ip: setting?.value ?? "", phone };
}

/** POST /api/phone/screenshot — proxy screenshot from iMouseXP */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phoneId } = await req.json();
  if (!phoneId) return NextResponse.json({ error: "phoneId required" }, { status: 400 });

  const ctx = await getAccessContext(user.id, phoneId);
  if (!ctx) return NextResponse.json({ error: "Forbidden or phone not found" }, { status: 403 });
  if (!ctx.ip) return NextResponse.json({ error: "Mini PC IP not configured" }, { status: 503 });

  try {
    const res = await xp.screenshot(ctx.ip, ctx.deviceId);
    if (res.status !== 200 || (res.data?.code as number) !== 0) {
      return NextResponse.json({
        error: (res.data?.message as string) ?? "Screenshot failed",
        code: res.data?.code,
        online: false,
      }, { status: 200 });
    }
    return NextResponse.json({
      img: res.data?.img ?? null,
      online: true,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Connection failed",
      online: false,
    }, { status: 200 });
  }
}
