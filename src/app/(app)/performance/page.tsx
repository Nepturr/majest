"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PeriodDropdown } from "@/components/period-dropdown";
import { useAuth } from "@/components/auth-provider";
import { PostMetadataPanel } from "@/components/post-metadata-panel";
import type { PostForPanel, PostMetadata } from "@/components/post-metadata-panel";
import type { IgAccountData, IgAvailableAccount, IgPerformanceResponse, IgReel } from "@/app/api/performance/instagram/route";
import { Eye, Users, Heart, MessageCircle, Share2, TrendingUp, Film, Play, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
type Period = "today" | "yesterday" | "week" | "month" | "inception";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  month: "Last 30 days",
  inception: "Since inception",
};

const ACCOUNT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#10b981",
  "#f59e0b", "#ef4444", "#06b6d4", "#f97316",
  "#84cc16", "#a855f7", "#14b8a6", "#fb923c",
];

type PerfSortKey = "views" | "likes" | "shares" | "engagement" | "comments" | "recent";
type PerfFilterType = "all" | "reels" | "carousels";

const LS_PERIOD_KEY = "perf_ig_period";
const LS_ACCOUNTS_KEY = "perf_ig_selected_accounts";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes(".supabase.co/storage/")) return url;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (d > 30) return `${Math.floor(d / 30)}mo`;
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return "now";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// IgAvatar
// ─────────────────────────────────────────────────────────────
function IgAvatar({ url, handle, size = 28 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(9, size * 0.38), color: "#fff", fontWeight: 700, flexShrink: 0 }}>
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={proxyImg(url)!} alt={handle} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} />;
}

// ─────────────────────────────────────────────────────────────
// Mini Area Chart (same as accounts/[id])
// ─────────────────────────────────────────────────────────────
type ChartPoint = { date: string; value: number };

function AreaChart({
  data,
  color = "#3b82f6",
  height = 48,
  formatValue = fmt,
  gradId = "ac",
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  gradId?: string;
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  if (data.length < 2) {
    return <div className="flex items-center justify-center text-zinc-700 text-[10px]" style={{ height }}>Not enough data yet</div>;
  }
  const W = 300, H = height, pad = 6;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals, min + 1);
  const range = max - min;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - pad - ((d.value - min) / range) * (H - pad * 2),
    ...d,
  }));
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${W} ${H} L 0 ${H} Z`;
  const gid = `${gradId}-${color.replace(/[^a-z0-9]/gi, "")}`;
  const hov = hovIdx != null ? pts[hovIdx] : null;
  const tooltipLeft = hov ? Math.max(5, Math.min(95, (hov.x / W) * 100)) : 50;
  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full cursor-crosshair" preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          setHovIdx(Math.max(0, Math.min(data.length - 1, Math.round(x * (data.length - 1)))));
        }}
        onMouseLeave={() => setHovIdx(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="85%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gid})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {hov && (
          <>
            <line x1={hov.x.toFixed(1)} y1="0" x2={hov.x.toFixed(1)} y2={H} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={hov.x.toFixed(1)} cy={hov.y.toFixed(1)} r="3.5" fill={color} stroke="#09090b" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {hov && (
        <div className="absolute pointer-events-none z-20 bg-zinc-900/95 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm"
          style={{ bottom: "calc(100% + 6px)", left: `${tooltipLeft}%`, transform: "translateX(-50%)" }}>
          <p className="font-semibold text-white whitespace-nowrap">{formatValue(hov.value)}</p>
          <p className="text-zinc-500 whitespace-nowrap mt-0.5">{fmtDate(hov.date)}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Trend badge (arrow + %)
// ─────────────────────────────────────────────────────────────
function computeTrend(current: number | null | undefined, prev: number | null | undefined): { pct: number; up: boolean } | null {
  if (current == null || prev == null) return null;
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / Math.abs(prev)) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function TrendBadge({ current, prev }: { current: number | null | undefined; prev: number | null | undefined }) {
  const trend = computeTrend(current, prev);
  if (!trend) return null;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${trend.up ? "text-emerald-400" : "text-rose-400"}`}>
      {trend.up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {trend.pct}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card — same style as accounts/[id]
// ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, accent = "blue", chart, trendCurrent, trendPrev,
}: {
  label: string; value: string; sub?: string | null;
  icon: React.ReactNode;
  accent?: "blue" | "violet" | "cyan" | "emerald" | "amber" | "pink";
  chart?: React.ReactNode;
  trendCurrent?: number | null;
  trendPrev?: number | null;
}) {
  const accents = {
    blue:    { bg: "bg-blue-600/8",    border: "border-blue-500/15",   text: "text-blue-400",    val: "text-blue-200" },
    violet:  { bg: "bg-violet-600/8",  border: "border-violet-500/15", text: "text-violet-400",  val: "text-violet-200" },
    cyan:    { bg: "bg-cyan-600/8",    border: "border-cyan-500/15",   text: "text-cyan-400",    val: "text-cyan-200" },
    emerald: { bg: "bg-emerald-600/8", border: "border-emerald-500/15",text: "text-emerald-400", val: "text-emerald-200" },
    amber:   { bg: "bg-amber-600/8",   border: "border-amber-500/15",  text: "text-amber-400",   val: "text-amber-200" },
    pink:    { bg: "bg-pink-600/8",    border: "border-pink-500/15",   text: "text-pink-400",    val: "text-pink-200" },
  };
  const a = accents[accent];
  return (
    <div className={`rounded-2xl border ${a.bg} ${a.border} p-4 flex flex-col gap-2 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium ${a.text}`}>
          {icon}{label}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <TrendBadge current={trendCurrent} prev={trendPrev} />
          {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
        </div>
      </div>
      <p className={`text-2xl font-bold leading-none ${a.val}`}>{value}</p>
      {chart && <div className="mt-1">{chart}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Multi-line comparison chart
// ─────────────────────────────────────────────────────────────
interface LineData {
  accountId: string;
  handle: string;
  color: string;
  points: ChartPoint[];
}

function MultiLineChart({ lines, formatY = fmt }: { lines: LineData[]; formatY?: (v: number) => string }) {
  const [hover, setHover] = useState<{ x: number; dateIdx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 800, H = 180, padL = 52, padR = 16, padT = 12, padB = 28;

  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const line of lines) for (const p of line.points) set.add(p.date);
    return [...set].sort();
  }, [lines]);

  const allValues = lines.flatMap((l) => l.points.map((p) => p.value));
  const minV = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxV = allValues.length > 0 ? Math.max(...allValues) : 1;
  const range = maxV - minV || 1;
  const xScale = useCallback((i: number) => padL + (i / Math.max(allDates.length - 1, 1)) * (W - padL - padR), [allDates.length]);
  const yScale = useCallback((v: number) => padT + (1 - (v - minV) / range) * (H - padT - padB), [minV, range]);
  const hoverDate = hover?.dateIdx != null ? allDates[hover.dateIdx] : null;

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || allDates.length === 0) return;
    const frac = Math.max(0, Math.min(1, ((e.clientX - rect.left) / rect.width * W - padL) / (W - padL - padR)));
    const idx = Math.round(frac * (allDates.length - 1));
    setHover({ x: xScale(idx), dateIdx: idx });
  }, [allDates, xScale]);

  if (lines.length === 0 || allDates.length === 0) return <div className="flex items-center justify-center h-44 text-zinc-600 text-sm">No data available</div>;

  const yTicks = [0, 0.5, 1].map((f) => ({ y: padT + (1 - f) * (H - padT - padB), label: formatY(Math.round(minV + f * range)) }));

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }} onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#27272a" strokeWidth="1" />
            <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#52525b">{t.label}</text>
          </g>
        ))}
        {lines.map((line) => {
          const pts = allDates.map((date) => { const f = line.points.find((p) => p.date === date); return f ? { x: xScale(allDates.indexOf(date)), y: yScale(f.value) } : null; });
          const segs: string[] = []; let cur = "";
          for (const pt of pts) { if (!pt) { if (cur) { segs.push(cur); cur = ""; } continue; } cur += cur ? ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`; }
          if (cur) segs.push(cur);
          return (
            <g key={line.accountId}>
              {segs.map((seg, i) => <path key={i} d={seg} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />)}
              {pts.map((pt, i) => pt ? <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill={line.color} opacity="0.7" /> : null)}
            </g>
          );
        })}
        {hover && <line x1={hover.x} y1={padT} x2={hover.x} y2={H - padB} stroke="#52525b" strokeWidth="1" strokeDasharray="3 2" />}
        {hover && lines.map((line) => {
          const f = hoverDate ? line.points.find((p) => p.date === hoverDate) : null;
          if (!f) return null;
          return <circle key={line.accountId} cx={hover.x} cy={yScale(f.value)} r="4" fill={line.color} stroke="#18181b" strokeWidth="2" />;
        })}
        {allDates.filter((_, i) => i % Math.max(1, Math.floor(allDates.length / 5)) === 0 || i === allDates.length - 1).map((d) => {
          const dt = new Date(d);
          return <text key={d} x={xScale(allDates.indexOf(d))} y={H - padB + 12} textAnchor="middle" fontSize="9" fill="#52525b">{`${dt.getDate()}/${dt.getMonth() + 1}`}</text>;
        })}
      </svg>
      {hover && hoverDate && (
        <div className="absolute top-0 pointer-events-none z-10" style={{ left: `${(hover.x / W) * 100}%`, transform: hover.x > W * 0.65 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl min-w-[140px]">
            <p className="text-[10px] text-zinc-500 font-medium mb-2">{new Date(hoverDate).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</p>
            {lines.map((line) => {
              const f = line.points.find((p) => p.date === hoverDate);
              return (
                <div key={line.accountId} className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: line.color }} />
                  <span className="text-xs text-zinc-400 truncate max-w-[80px]">@{line.handle}</span>
                  <span className="text-xs text-white font-semibold ml-auto">{f ? formatY(f.value) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Account selector dropdown
// ─────────────────────────────────────────────────────────────
function AccountSelector({ accounts, selected, colors, onChange }: {
  accounts: IgAvailableAccount[]; selected: Set<string>;
  colors: Map<string, string>; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-sm font-medium text-white transition-all select-none">
        <Users className="w-3.5 h-3.5 text-zinc-400" />
        <span className="whitespace-nowrap">
          {selected.size === accounts.length ? "All accounts" : `${selected.size} / ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
        </span>
        <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 right-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-2 min-w-[220px]">
          <div className="px-3 pb-2 mb-1 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Accounts</span>
            <button onClick={() => { accounts.forEach((a) => { if (!selected.has(a.id)) onChange(a.id); }); setOpen(false); }} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">Select all</button>
          </div>
          {accounts.map((account) => {
            const isSel = selected.has(account.id);
            const color = colors.get(account.id) ?? "#3b82f6";
            return (
              <button key={account.id} onClick={() => onChange(account.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isSel ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}>
                <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0" style={isSel ? { background: color, borderColor: color } : { borderColor: "#52525b" }}>
                  {isSel && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={22} />
                <span className="truncate max-w-[130px]">@{account.instagram_handle}</span>
                <div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: isSel ? color : "#3f3f46" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reel Card — same style as accounts/[id]
// ─────────────────────────────────────────────────────────────
function ReelCard({ reel, color, onOpen }: { reel: IgReel; color: string; onOpen: (r: IgReel) => void }) {
  const [thumbErr, setThumbErr] = useState(false);
  const snap = reel.latest_snapshot;
  const er = reel.engagement_rate;
  return (
    <div className="group flex flex-col rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 transition-all cursor-pointer select-none" onClick={() => onOpen(reel)}>
      <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: "9/16" }}>
        <div className="absolute top-0 left-0 right-0 h-0.5 z-10" style={{ background: color }} />
        {reel.thumbnail_url && !thumbErr ? (
          <img src={proxyImg(reel.thumbnail_url)!} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={() => setThumbErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800/80">
            {reel.post_type === "Reel" ? <Film className="w-10 h-10 text-zinc-700" /> : <Play className="w-10 h-10 text-zinc-700" />}
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-semibold z-10">
          {reel.post_type === "Reel" ? <Film className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {reel.post_type}
        </div>
        {reel.views != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-2.5">
            <span className="flex items-center gap-1 text-white text-sm font-bold"><Eye className="w-3.5 h-3.5 opacity-80" />{fmt(reel.views)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center z-10">
          <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-2 text-white">
            <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            </div>
            <span className="text-xs font-semibold">Details</span>
          </div>
        </div>
        <a href={reel.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white z-20">
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      <div className="p-3.5 flex flex-col gap-2 flex-1 min-h-0">
        <p className={`text-xs leading-relaxed line-clamp-2 ${reel.caption ? "text-zinc-400" : "text-zinc-700 italic"}`}>{reel.caption ?? "No caption"}</p>
        <div className="flex items-center gap-2.5 text-[11px] text-zinc-600 mt-auto pt-1 border-t border-zinc-800 flex-wrap">
          {snap?.likes_count != null && <span className="flex items-center gap-0.5 text-zinc-500"><Heart className="w-3 h-3" /> {fmt(snap.likes_count)}</span>}
          {snap?.comments_count != null && <span className="flex items-center gap-0.5 text-zinc-500"><MessageCircle className="w-3 h-3" /> {fmt(snap.comments_count)}</span>}
          {reel.shares != null && reel.shares > 0 && <span className="flex items-center gap-0.5 text-sky-500/70"><Share2 className="w-3 h-3" /> {fmt(reel.shares)}</span>}
          {er != null && <span className="flex items-center gap-0.5 text-emerald-500/70"><TrendingUp className="w-3 h-3" /> {er.toFixed(1)}%</span>}
          <span className="ml-auto text-zinc-700 text-[10px]">{relativeTime(reel.posted_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { profile } = useAuth();
  const router = useRouter();

  const canViewAccounts = profile?.role === "admin" || profile?.allowed_pages?.includes("accounts");

  // fetchKey is bumped to re-trigger data fetching on back navigation (bfcache restore)
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setFetchKey((k) => k + 1);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === "undefined") return "week";
    return (localStorage.getItem(LS_PERIOD_KEY) as Period) ?? "week";
  });
  const [availableAccounts, setAvailableAccounts] = useState<IgAvailableAccount[]>([]);
  const [data, setData] = useState<Record<string, IgAccountData>>({});
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { const s = localStorage.getItem(LS_ACCOUNTS_KEY); if (s) return new Set(JSON.parse(s) as string[]); } catch { /* */ }
    return new Set();
  });
  const [activeMetaPost, setActiveMetaPost] = useState<PostForPanel | null>(null);
  const [metaMap, setMetaMap] = useState<Map<string, PostMetadata>>(new Map());

  const [sort, setSort] = useState<PerfSortKey>("recent");
  const [filter, setFilter] = useState<PerfFilterType>("all");

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    availableAccounts.forEach((a, i) => map.set(a.id, ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]));
    return map;
  }, [availableAccounts]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/performance/instagram?period=${period}`)
      .then((r) => r.json())
      .then((json: IgPerformanceResponse) => {
        const accs = json.available_accounts ?? [];
        setAvailableAccounts(accs);
        setSelectedIds((prev) => {
          if (prev.size > 0) { const v = new Set([...prev].filter((id) => accs.some((a) => a.id === id))); return v.size > 0 ? v : new Set(accs.map((a) => a.id)); }
          return new Set(accs.map((a) => a.id));
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  useEffect(() => {
    if (availableAccounts.length === 0) return;
    if (selectedIds.size === 0) { setData({}); return; }
    setLoadingData(true);
    fetch(`/api/performance/instagram?period=${period}&ids=${[...selectedIds].join(",")}`)
      .then((r) => r.json())
      .then((json: IgPerformanceResponse) => setData(json.data ?? {}))
      .finally(() => setLoadingData(false));
  }, [period, selectedIds, availableAccounts.length]);

  const handlePeriodChange = (p: string) => { setPeriod(p as Period); localStorage.setItem(LS_PERIOD_KEY, p); };
  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const handleOpenReel = useCallback((reel: IgReel) => {
    setActiveMetaPost({ id: reel.id, shortcode: reel.shortcode, post_type: reel.post_type, url: reel.url, caption: reel.caption, thumbnail_url: reel.thumbnail_url, posted_at: reel.posted_at, latest_snapshot: reel.latest_snapshot });
  }, []);

  const handleCloseMeta = useCallback(() => {
    const post = activeMetaPost;
    setActiveMetaPost(null);
    if (post) fetch(`/api/instagram/posts/${post.id}/metadata`).then((r) => r.json()).then((d) => { if (d.metadata) setMetaMap((prev) => new Map(prev).set(post.id, d.metadata)); }).catch(() => null);
  }, [activeMetaPost]);

  const selectedAccountData = [...selectedIds].map((id) => data[id]).filter(Boolean) as IgAccountData[];
  const followerLines: LineData[] = selectedAccountData.map((a) => ({ accountId: a.id, handle: a.instagram_handle, color: colorMap.get(a.id) ?? "#3b82f6", points: a.followers_history }));
  const viewsLines: LineData[] = selectedAccountData.filter((a) => a.views_history.length > 0).map((a) => ({ accountId: a.id, handle: a.instagram_handle, color: colorMap.get(a.id) ?? "#3b82f6", points: a.views_history }));

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
      </div>
    );
  }

  if (availableAccounts.length === 0 && profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <Film className="w-12 h-12 text-zinc-700" />
        <h2 className="text-lg font-semibold">No accounts assigned</h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs">Ask an admin to assign Instagram accounts to your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Performance</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Instagram analytics — growth &amp; reels</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <AccountSelector accounts={availableAccounts} selected={selectedIds} colors={colorMap} onChange={toggleAccount} />
            <PeriodDropdown value={period} onChange={handlePeriodChange}
              options={(["today", "yesterday", "week", "month", "inception"] as Period[]).map((p) => ({ key: p, label: PERIOD_LABELS[p] }))} />
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center h-48 text-zinc-600 text-sm gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
            Loading…
          </div>
        ) : (
          <>
            {/* Per-account stat card rows */}
            {selectedAccountData.map((account) => {
              const color = colorMap.get(account.id) ?? "#3b82f6";
              const s = account.stats;
              const fHistory = account.followers_history;
              const vHistory = account.views_history;
              const periodLabel = PERIOD_LABELS[period];
              return (
                <div key={account.id} className="mb-8">
                  {/* Account header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={28} />
                    <p className="font-semibold text-white">@{account.instagram_handle}</p>
                    {canViewAccounts && (
                      <a href={`/accounts/${account.id}`} onClick={() => router.refresh()} className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-800 hover:border-zinc-600 text-xs text-zinc-500 hover:text-white transition-all">
                        View account
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </a>
                    )}
                  </div>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <StatCard label="Unique Views" value={fmt(s.avg_views != null ? (s.avg_views * s.total_reels) : null)}
                      icon={<Eye className="w-3 h-3" />} accent="blue"
                      chart={vHistory.length >= 2 ? <AreaChart data={vHistory} color="#3b82f6" height={40} gradId={`vc-${account.id}`} /> : undefined} />
                    <StatCard label="Followers" value={fmt(s.followers_current)}
                      sub={s.followers_delta != null ? `${s.followers_delta > 0 ? "+" : ""}${fmt(s.followers_delta)} ${periodLabel}` : null}
                      icon={<Users className="w-3 h-3" />} accent="violet"
                      trendCurrent={s.followers_delta} trendPrev={s.followers_delta_prev}
                      chart={fHistory.length >= 2 ? <AreaChart data={fHistory} color="#8b5cf6" height={40} gradId={`fc-${account.id}`} formatValue={(v) => v.toLocaleString()} /> : undefined} />
                    <StatCard label="Avg Unique Views / reel" value={fmt(s.avg_views)}
                      sub={s.total_reels > 0 ? `on ${s.total_reels} reels` : null}
                      icon={<Eye className="w-3 h-3" />} accent="cyan" />
                    <StatCard label="Avg Likes / reel" value={fmt(s.avg_likes)}
                      sub={s.avg_comments != null ? `${fmt(s.avg_comments)} avg comments` : null}
                      icon={<Heart className="w-3 h-3" />} accent="pink" />
                  </div>
                </div>
              );
            })}

            {/* Multi-account comparison charts */}
            {followerLines.some((l) => l.points.length > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-violet-400" /> Followers over time</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    {followerLines.filter((l) => l.points.length > 0).map((l) => (
                      <div key={l.accountId} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                        <span className="text-[10px] text-zinc-400">@{l.handle}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mb-4">{PERIOD_LABELS[period]}</p>
                <MultiLineChart lines={followerLines.filter((l) => l.points.length > 0)} formatY={(v) => v.toLocaleString()} />
              </div>
            )}

            {viewsLines.some((l) => l.points.length > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /> Total views over time</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    {viewsLines.filter((l) => l.points.length > 0).map((l) => (
                      <div key={l.accountId} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                        <span className="text-[10px] text-zinc-400">@{l.handle}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mb-4">{PERIOD_LABELS[period]}</p>
                <MultiLineChart lines={viewsLines.filter((l) => l.points.length > 0)} />
              </div>
            )}

            {/* Sort / filter bar */}
            {selectedAccountData.some((a) => a.top_reels.length > 0) && (() => {
              const allReels = selectedAccountData.flatMap((a) => a.top_reels);
              const reelCount = allReels.filter((r) => r.post_type === "Reel" || r.post_type === "Video").length;
              const carouselCount = allReels.filter((r) => r.post_type === "Sidecar").length;
              const filterOptions: { key: PerfFilterType; label: string; count: number }[] = [
                { key: "all", label: "All", count: allReels.length },
                { key: "reels", label: "Reels", count: reelCount },
                { key: "carousels", label: "Carousels", count: carouselCount },
              ];
              const sortOptions: { key: PerfSortKey; label: string }[] = [
                { key: "views", label: "Unique Views" },
                { key: "likes", label: "Likes" },
                { key: "shares", label: "Shares" },
                { key: "engagement", label: "ER" },
                { key: "comments", label: "Comments" },
                { key: "recent", label: "Recent" },
              ];
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-1">
                  {/* Type filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {filterOptions.map((o) => (
                      <button key={o.key} onClick={() => setFilter(o.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === o.key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"}`}>
                        {o.key === "reels" && <Film className="w-3 h-3" />}
                        {o.key === "carousels" && <Share2 className="w-3 h-3" />}
                        {o.label}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${filter === o.key ? "bg-zinc-600 text-zinc-200" : "bg-zinc-800 text-zinc-600"}`}>{o.count}</span>
                      </button>
                    ))}
                  </div>
                  {/* Sort options */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wide font-medium mr-1">Sort</span>
                    {sortOptions.map((o) => (
                      <button key={o.key} onClick={() => setSort(o.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sort === o.key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Reels grid per account */}
            {selectedAccountData.filter((a) => a.top_reels.length > 0).map((account) => {
              const color = colorMap.get(account.id) ?? "#3b82f6";

              const filtered = account.top_reels.filter((r) => {
                if (filter === "reels") return r.post_type === "Reel" || r.post_type === "Video";
                if (filter === "carousels") return r.post_type === "Sidecar";
                return true;
              });

              const sorted = [...filtered].sort((a, b) => {
                switch (sort) {
                  case "likes":      return (b.latest_snapshot?.likes_count ?? 0) - (a.latest_snapshot?.likes_count ?? 0);
                  case "comments":   return (b.latest_snapshot?.comments_count ?? 0) - (a.latest_snapshot?.comments_count ?? 0);
                  case "shares":     return (b.shares ?? 0) - (a.shares ?? 0);
                  case "engagement": return (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0);
                  case "recent":     return new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime();
                  default:           return (b.views ?? 0) - (a.views ?? 0);
                }
              });

              if (sorted.length === 0) return null;

              return (
                <div key={account.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
                  <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={28} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">@{account.instagram_handle}</h3>
                      <p className="text-[11px] text-zinc-500">{sorted.length} post{sorted.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {sorted.map((reel) => (
                        <ReelCard key={reel.id} reel={reel} color={color} onOpen={handleOpenReel} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {selectedAccountData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <Film className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No data for current selection</p>
                <p className="text-xs mt-1">Select at least one account and run a collect.</p>
              </div>
            )}
          </>
        )}
      </div>

      {activeMetaPost && <PostMetadataPanel post={activeMetaPost} onClose={handleCloseMeta} />}
    </div>
  );
}
