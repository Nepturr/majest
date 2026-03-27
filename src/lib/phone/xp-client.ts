// iMouseXP API client — port 9911, HTTP POST JSON
// Format: { fun: "/endpoint", msgid: 0, data: { id: "MAC", ...params } }
// Response success: status === 200 && data.code === 0

export interface XPResponse {
  status: number;
  fun: string;
  data: Record<string, unknown>;
  message?: string;
}

export interface XPScreenshotResponse extends XPResponse {
  data: {
    code: number;
    img?: string; // base64 encoded image
    message?: string;
  };
}

export async function callXP(
  ip: string,
  fun: string,
  data: Record<string, unknown> = {}
): Promise<XPResponse> {
  const res = await fetch(`http://${ip}:9911/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fun, msgid: 0, data }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`XP HTTP ${res.status}`);
  return res.json();
}

export function isXPSuccess(res: XPResponse): boolean {
  return res.status === 200 && (res.data?.code as number) === 0;
}

// Convenience wrappers
export const xp = {
  screenshot: (ip: string, mac: string) =>
    callXP(ip, "/device/screenshot", { id: mac }),

  deviceList: (ip: string) =>
    callXP(ip, "/device/list", {}),

  click: (ip: string, mac: string, x: number, y: number) =>
    callXP(ip, "/mouse/click", { id: mac, x, y, button: "left" }),

  swipe: (ip: string, mac: string, direction: "up" | "down" | "left" | "right", len = 0.8) =>
    callXP(ip, "/mouse/swipe", { id: mac, direction, len }),

  swipeCoords: (ip: string, mac: string, sx: number, sy: number, ex: number, ey: number) =>
    callXP(ip, "/mouse/swipe", { id: mac, sx, sy, ex, ey }),

  type: (ip: string, mac: string, text: string) =>
    callXP(ip, "/key/sendkey", { id: mac, key: text }),

  hotkey: (ip: string, mac: string, fnKey: string) =>
    callXP(ip, "/key/sendkey", { id: mac, fn_key: fnKey }),
};
