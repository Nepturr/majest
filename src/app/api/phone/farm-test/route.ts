import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { callXP } from "@/lib/phone/xp-client";

/** POST /api/phone/farm-test — admin only, test XP connection */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ip } = await req.json();
  if (!ip) return NextResponse.json({ error: "ip required" }, { status: 400 });

  try {
    const res = await callXP(ip, "/device/list", {});
    if (res.status === 200) {
      const devices = res.data ?? {};
      const deviceCount = typeof devices === "object" ? Object.keys(devices).length : 0;
      return NextResponse.json({ ok: true, deviceCount });
    }
    return NextResponse.json({ ok: false, error: `Code ${res.status}` });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" });
  }
}
