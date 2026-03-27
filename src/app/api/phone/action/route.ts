import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { xp } from "@/lib/phone/xp-client";

async function getAccessContext(userId: string, phoneId: string) {
  const db = createAdminClient();
  const [{ data: profile }, { data: phone }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).single(),
    db.from("phones").select("device_id, group_id").eq("id", phoneId).single(),
  ]);

  if (!phone) return null;
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    const { data: access } = await db
      .from("phone_access")
      .select("id")
      .eq("user_id", userId)
      .or(`phone_id.eq.${phoneId}${phone.group_id ? `,group_id.eq.${phone.group_id}` : ""}`)
      .limit(1);
    if (!access || access.length === 0) return null;
  }

  const { data: setting } = await db.from("settings").select("value").eq("key", "mini_pc_ip").single();
  return { deviceId: phone.device_id, ip: setting?.value ?? "" };
}

type ActionType = "click" | "swipe" | "type" | "hotkey";

/**
 * POST /api/phone/action
 * Body: { phoneId, type, ...params }
 *   click:   { x, y }
 *   swipe:   { direction: "up"|"down"|"left"|"right", len?: number }
 *            OR { sx, sy, ex, ey } for custom coordinates
 *   type:    { text }
 *   hotkey:  { key }  — e.g. "WIN+h", "WIN+SHIFT+3"
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { phoneId, type, ...params } = body as { phoneId: string; type: ActionType } & Record<string, unknown>;

  if (!phoneId || !type) return NextResponse.json({ error: "phoneId and type required" }, { status: 400 });

  const ctx = await getAccessContext(user.id, phoneId);
  if (!ctx) return NextResponse.json({ error: "Forbidden or phone not found" }, { status: 403 });
  if (!ctx.ip) return NextResponse.json({ error: "Mini PC IP not configured" }, { status: 503 });

  try {
    let res;
    switch (type) {
      case "click":
        res = await xp.click(ctx.ip, ctx.deviceId, params.x as number, params.y as number);
        break;
      case "swipe":
        if (params.sx !== undefined) {
          res = await xp.swipeCoords(ctx.ip, ctx.deviceId, params.sx as number, params.sy as number, params.ex as number, params.ey as number);
        } else {
          res = await xp.swipe(ctx.ip, ctx.deviceId, params.direction as "up" | "down" | "left" | "right", (params.len as number) ?? 0.8);
        }
        break;
      case "type":
        res = await xp.type(ctx.ip, ctx.deviceId, params.text as string);
        break;
      case "hotkey":
        res = await xp.hotkey(ctx.ip, ctx.deviceId, params.key as string);
        break;
      default:
        return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
    }

    const ok = res.status === 200 && (res.data?.code as number) === 0;
    return NextResponse.json({ ok, code: res.data?.code, message: res.data?.message });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, { status: 200 });
  }
}
