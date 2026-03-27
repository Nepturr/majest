"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import { PhoneConfigContent } from "@/components/phone-config";
import { useAuth } from "@/components/auth-provider";
import type { Phone, PhoneGroup } from "@/types";
import {
  Settings, X, Smartphone, RefreshCw, Loader2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Home, ArrowLeft, LayoutGrid, Lock, Camera, RotateCcw,
  Send, WifiOff, Maximize2,
} from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Hotkeys config ─── */
const HOTKEYS = [
  { label: "Home", key: "WIN+h", icon: Home },
  { label: "Back", key: "TAB+b", icon: ArrowLeft },
  { label: "Switcher", key: "AppSwitch", icon: LayoutGrid },
  { label: "Lock", key: "TAB+l", icon: Lock },
  { label: "Screenshot", key: "shift+win+3", icon: Camera },
  { label: "Reboot", key: "CTRL+ALT+SHIFT+WIN+r", icon: RotateCcw },
];

/* ═══════════════════════════════════════════
   PHONE PAGE
═══════════════════════════════════════════ */
export default function PhonePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [controlPhone, setControlPhone] = useState<Phone | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const loadPhones = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/phone/devices");
    const data = await res.json();
    setPhones(data.phones ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPhones(); }, [loadPhones]);

  // Group phones by phone group
  const groups = phones.reduce((acc, phone) => {
    const key = phone.group?.id ?? "__ungrouped";
    if (!acc[key]) acc[key] = { group: phone.group ?? null, phones: [] };
    acc[key].phones.push(phone);
    return acc;
  }, {} as Record<string, { group: PhoneGroup | null; phones: Phone[] }>);

  const onlineCount = phones.length; // will be enriched by screenshot attempts

  return (
    <ProtectedPage pageId="phone">
      <div className="flex flex-col h-full min-h-0">
          <Header
          title="Phones"
          subtitle={`${phones.length} device${phones.length !== 1 ? "s" : ""} accessible`}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowConfig(true)}
                  className="h-8 w-8 rounded-lg border border-border hover:bg-accent/10 hover:border-accent/30 flex items-center justify-center transition-colors"
                  title="Phone Farm Settings"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={loadPhones}
                disabled={loading}
                className="h-8 w-8 rounded-lg border border-border hover:bg-accent/10 flex items-center justify-center transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : phones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-accent-light" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold">No devices accessible</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isAdmin
                    ? "Add devices in Settings (gear icon) and configure the Mini PC IP."
                    : "Ask an admin to grant you access to devices."}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowConfig(true)}
                  className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Open Settings
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groups).map(([key, { group, phones: groupPhones }]) => (
                <div key={key}>
                  {/* Group header */}
                  {group ? (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.name}</p>
                      <span className="text-xs text-muted-foreground">· {groupPhones.length}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Other</p>
                    </div>
                  )}

                  {/* Phone cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {groupPhones.map((phone) => (
                      <PhoneCard
                        key={phone.id}
                        phone={phone}
                        onControl={() => setControlPhone(phone)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control drawer */}
      {controlPhone && (
        <PhoneControlDrawer
          phone={controlPhone}
          onClose={() => setControlPhone(null)}
        />
      )}

      {/* Config modal (admin only) */}
      {showConfig && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold">Phone Farm Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage devices, groups, and access permissions</p>
              </div>
              <button onClick={() => setShowConfig(false)} className="p-1.5 rounded-lg hover:bg-muted-foreground/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PhoneConfigContent />
            </div>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}

/* ═══════════════════════════════════════════
   PHONE CARD (grid thumbnail)
═══════════════════════════════════════════ */
function PhoneCard({ phone, onControl }: { phone: Phone; onControl: () => void }) {
  const [img, setImg] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScreenshot = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/phone/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneId: phone.id }),
      });
      const data = await res.json();
      setOnline(data.online ?? false);
      if (data.img) setImg(data.img);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [phone.id, loading]);

  useEffect(() => {
    fetchScreenshot();
    intervalRef.current = setInterval(fetchScreenshot, 6000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.id]);

  const aspectRatio = phone.width && phone.height ? phone.width / phone.height : 390 / 844;

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-accent/30 transition-all hover:shadow-lg">
      {/* Screen preview */}
      <div
        className="relative bg-background/50 overflow-hidden"
        style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
      >
        <div className="absolute inset-0">
          {img ? (
            <img
              src={`data:image/jpeg;base64,${img}`}
              alt={phone.label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {loading && online === null ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : online === false ? (
                <div className="flex flex-col items-center gap-1.5">
                  <WifiOff className="w-5 h-5 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground/40">Offline</span>
                </div>
              ) : (
                <Smartphone className="w-6 h-6 text-muted-foreground/20" />
              )}
            </div>
          )}

          {/* Offline overlay */}
          {img && online === false && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <WifiOff className="w-5 h-5 text-white/60" />
                <span className="text-[10px] text-white/60">Offline</span>
              </div>
            </div>
          )}

          {/* Status dot */}
          <div className="absolute top-2 right-2">
            <span className={cn(
              "w-2 h-2 rounded-full border border-black/30 block",
              online === null ? "bg-muted-foreground/50" :
              online ? "bg-success shadow-[0_0_6px_#22c55e]" : "bg-danger"
            )} />
          </div>

          {/* Open overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={onControl}
              className="bg-white/90 hover:bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Control
            </button>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-xs font-semibold truncate">{phone.label}</p>
        <div className="flex items-center justify-between">
          {phone.group ? (
            <span className="text-[10px] font-medium" style={{ color: (phone.group as PhoneGroup).color }}>
              {(phone.group as PhoneGroup).name}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">No group</span>
          )}
          {phone.model && (
            <span className="text-[10px] text-muted-foreground truncate ml-2">{phone.model}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PHONE CONTROL DRAWER
═══════════════════════════════════════════ */
function PhoneControlDrawer({ phone, onClose }: { phone: Phone; onClose: () => void }) {
  const [img, setImg] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phoneWidth = phone.width ?? 390;
  const phoneHeight = phone.height ?? 844;

  const fetchScreenshot = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch("/api/phone/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneId: phone.id }),
      });
      const data = await res.json();
      setOnline(data.online ?? false);
      if (data.img) setImg(data.img);
    } catch {
      setOnline(false);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [phone.id]);

  useEffect(() => {
    fetchScreenshot(true);
    intervalRef.current = setInterval(() => fetchScreenshot(false), 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.id]);

  const sendAction = useCallback(async (type: string, params: Record<string, unknown> = {}) => {
    try {
      const res = await fetch("/api/phone/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneId: phone.id, type, ...params }),
      });
      const data = await res.json();
      if (!data.ok) {
        setActionFeedback(`Error: ${data.error ?? data.message ?? "Action failed"}`);
        setTimeout(() => setActionFeedback(null), 3000);
      }
    } catch {
      setActionFeedback("Connection error");
      setTimeout(() => setActionFeedback(null), 3000);
    }
  }, [phone.id]);

  const handleScreenClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const x = Math.round(relX * phoneWidth);
    const y = Math.round(relY * phoneHeight);
    sendAction("click", { x, y });
  }, [phoneWidth, phoneHeight, sendAction]);

  const handleSendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    await sendAction("type", { text: text.trim() });
    setText("");
    setSending(false);
  };

  const aspectRatio = phoneWidth / phoneHeight;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[600px] bg-card border-l border-border z-50 flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                online === null ? "bg-muted-foreground/50" : online ? "bg-success shadow-[0_0_6px_#22c55e]" : "bg-danger"
              )} />
              <p className="text-sm font-semibold">{phone.label}</p>
            </div>
            {phone.group && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${(phone.group as PhoneGroup).color}20`, color: (phone.group as PhoneGroup).color }}>
                {(phone.group as PhoneGroup).name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchScreenshot(true)}
              disabled={refreshing}
              className="h-8 w-8 rounded-lg border border-border hover:bg-accent/10 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", refreshing && "animate-spin")} />
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted-foreground/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">

          {/* Left: Phone screen */}
          <div className="flex-1 flex flex-col items-center justify-center bg-background/50 p-4 min-w-0">
            <div className="relative" style={{ maxWidth: "100%", maxHeight: "100%" }}>
              <div
                className="relative bg-background border-2 border-border rounded-[20px] overflow-hidden shadow-2xl"
                style={{ width: `min(280px, 100%)`, aspectRatio: `${aspectRatio}` }}
              >
                {img ? (
                  <img
                    src={`data:image/jpeg;base64,${img}`}
                    alt={phone.label}
                    className="w-full h-full object-cover cursor-crosshair select-none"
                    onClick={handleScreenClick}
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    {online === false ? (
                      <>
                        <WifiOff className="w-8 h-8 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground/60">Device offline</p>
                      </>
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
                Click on screen to tap · {phoneWidth}×{phoneHeight}
              </p>
            </div>

            {/* Action feedback */}
            {actionFeedback && (
              <div className="mt-2 text-xs text-danger bg-danger/10 border border-danger/20 px-3 py-1.5 rounded-lg max-w-xs text-center">
                {actionFeedback}
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className="w-[200px] border-l border-border flex flex-col shrink-0 overflow-y-auto">

            {/* Quick Actions */}
            <div className="p-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
              <div className="grid grid-cols-2 gap-1.5">
                {HOTKEYS.map((hk) => {
                  const Icon = hk.icon;
                  return (
                    <button
                      key={hk.key}
                      onClick={() => sendAction("hotkey", { key: hk.key })}
                      className="flex flex-col items-center gap-1 py-2 px-1 bg-background border border-border rounded-lg hover:bg-card hover:border-accent/30 transition-all text-center"
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground leading-none">{hk.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Swipe */}
            <div className="p-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Swipe</p>
              <div className="grid grid-cols-3 gap-1">
                <div />
                <button onClick={() => sendAction("swipe", { direction: "up" })} className="h-8 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-card hover:border-accent/30 transition-all">
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                </button>
                <div />
                <button onClick={() => sendAction("swipe", { direction: "left" })} className="h-8 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-card hover:border-accent/30 transition-all">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="h-8 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-border" />
                </div>
                <button onClick={() => sendAction("swipe", { direction: "right" })} className="h-8 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-card hover:border-accent/30 transition-all">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <div />
                <button onClick={() => sendAction("swipe", { direction: "down" })} className="h-8 bg-background border border-border rounded-lg flex items-center justify-center hover:bg-card hover:border-accent/30 transition-all">
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                <div />
              </div>
            </div>

            {/* Type text */}
            <div className="p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type Text</p>
              <div className="space-y-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                  placeholder="Type here…"
                  rows={3}
                  className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground"
                />
                <button
                  onClick={handleSendText}
                  disabled={!text.trim() || sending}
                  className="w-full h-8 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
