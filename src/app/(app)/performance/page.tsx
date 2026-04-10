"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PeriodDropdown } from "@/components/period-dropdown";
import { useAuth } from "@/components/auth-provider";
import { PostMetadataPanel } from "@/components/post-metadata-panel";
import type { PostForPanel, PostMetadata } from "@/components/post-metadata-panel";
import type { IgAccountData, IgAvailableAccount, IgPerformanceResponse, IgReel } from "@/app/api/performance/instagram/route";
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Film, Play } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────
type Period = "today" | "yesterday" | "week" | "month" | "inception";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  week: "7 derniers jours",
  month: "30 derniers jours",
  inception: "Depuis inception",
};

const ACCOUNT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#10b981",
  "#f59e0b", "#ef4444", "#06b6d4", "#f97316",
  "#84cc16", "#a855f7", "#14b8a6", "#fb923c",
];

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

function fmtDelta(n: number | null): string {
  if (n == null) return "";
  return n >= 0 ? `+${fmt(n)}` : fmt(n);
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
// Account selector dropdown
// ─────────────────────────────────────────────────────────────
interface AccountSelectorProps {
  accounts: IgAvailableAccount[];
  selected: Set<string>;
  colors: Map<string, string>;
  onChange: (id: string) => void;
}

function AccountSelector({ accounts, selected, colors, onChange }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  const selectedCount = selected.size;
  const total = accounts.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-sm font-medium text-white transition-all select-none"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-zinc-400">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
        <span className="whitespace-nowrap">
          {selectedCount === total ? "Tous les comptes" : `${selectedCount} / ${total} compte${total > 1 ? "s" : ""}`}
        </span>
        <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 right-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-2 min-w-[220px] overflow-hidden">
          <div className="px-3 pb-2 mb-1 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Comptes</span>
            <button
              onClick={() => { accounts.forEach((a) => { if (!selected.has(a.id)) onChange(a.id); }); setOpen(false); }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Tout sélectionner
            </button>
          </div>
          {accounts.map((account) => {
            const isSelected = selected.has(account.id);
            const color = colors.get(account.id) ?? "#3b82f6";
            return (
              <button
                key={account.id}
                onClick={() => onChange(account.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isSelected ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}
              >
                <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
                  style={isSelected ? { background: color, borderColor: color } : { borderColor: "#52525b" }}
                >
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-2.5 h-2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={22} />
                <span className="truncate max-w-[130px]">@{account.instagram_handle}</span>
                <div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: isSelected ? color : "#3f3f46" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Multi-line chart
// ─────────────────────────────────────────────────────────────
interface LineData {
  accountId: string;
  handle: string;
  color: string;
  points: Array<{ date: string; value: number }>;
}

function MultiLineChart({ lines, formatY = fmt }: { lines: LineData[]; formatY?: (v: number) => string }) {
  const [hover, setHover] = useState<{ x: number; dateIdx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 800, H = 200, padL = 52, padR = 16, padT = 16, padB = 32;

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
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(1, (svgX - padL) / (W - padL - padR)));
    const idx = Math.round(frac * (allDates.length - 1));
    setHover({ x: xScale(idx), dateIdx: idx });
  }, [allDates, xScale]);

  if (lines.length === 0 || allDates.length === 0) {
    return <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Aucune donnée disponible</div>;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: padT + (1 - f) * (H - padT - padB),
    label: formatY(Math.round(minV + f * range)),
  }));

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}
        onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#27272a" strokeWidth="1" />
            <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#52525b">{t.label}</text>
          </g>
        ))}

        {lines.map((line) => {
          const pts = allDates.map((date) => {
            const found = line.points.find((p) => p.date === date);
            return found ? { x: xScale(allDates.indexOf(date)), y: yScale(found.value) } : null;
          });
          const segments: string[] = [];
          let cur = "";
          for (const pt of pts) {
            if (!pt) { if (cur) { segments.push(cur); cur = ""; } continue; }
            cur += cur ? ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
          }
          if (cur) segments.push(cur);
          return (
            <g key={line.accountId}>
              {segments.map((seg, i) => <path key={i} d={seg} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />)}
              {pts.map((pt, i) => pt ? <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill={line.color} opacity="0.7" /> : null)}
            </g>
          );
        })}

        {hover && <line x1={hover.x} y1={padT} x2={hover.x} y2={H - padB} stroke="#52525b" strokeWidth="1" strokeDasharray="3 2" />}
        {hover && lines.map((line) => {
          const found = hoverDate ? line.points.find((p) => p.date === hoverDate) : null;
          if (!found) return null;
          return <circle key={line.accountId} cx={hover.x} cy={yScale(found.value)} r="4" fill={line.color} stroke="#18181b" strokeWidth="2" />;
        })}

        {allDates.filter((_, i) => i % Math.max(1, Math.floor(allDates.length / 5)) === 0 || i === allDates.length - 1).map((date) => {
          const d = new Date(date);
          return <text key={date} x={xScale(allDates.indexOf(date))} y={H - padB + 14} textAnchor="middle" fontSize="9" fill="#52525b">{`${d.getDate()}/${d.getMonth() + 1}`}</text>;
        })}
      </svg>

      {hover && hoverDate && (
        <div className="absolute top-0 pointer-events-none z-10" style={{ left: `${(hover.x / W) * 100}%`, transform: hover.x > W * 0.65 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl min-w-[140px]">
            <p className="text-[10px] text-zinc-500 font-medium mb-2">
              {new Date(hoverDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            </p>
            {lines.map((line) => {
              const found = line.points.find((p) => p.date === hoverDate);
              return (
                <div key={line.accountId} className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: line.color }} />
                  <span className="text-xs text-zinc-400 truncate max-w-[80px]">@{line.handle}</span>
                  <span className="text-xs text-white font-semibold ml-auto">{found ? formatY(found.value) : "—"}</span>
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
// Stat card (per account)
// ─────────────────────────────────────────────────────────────
function AccountStatCard({ account, color }: { account: IgAccountData; color: string }) {
  const s = account.stats;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={24} />
        <p className="text-sm font-medium text-white truncate">@{account.instagram_handle}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Followers</p>
          <p className="text-base font-bold text-white">{fmt(s.followers_current)}</p>
          {s.followers_delta != null && (
            <p className={`text-[10px] font-medium ${s.followers_delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {fmtDelta(s.followers_delta)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Moy. vues</p>
          <p className="text-base font-bold text-white">{fmt(s.avg_views)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Moy. likes</p>
          <p className="text-sm font-semibold text-white">{fmt(s.avg_likes)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Reels</p>
          <p className="text-sm font-semibold text-white">{s.total_reels}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reel card — same style as accounts/[id]
// ─────────────────────────────────────────────────────────────
function ReelCard({ reel, color, onOpen }: { reel: IgReel; color: string; onOpen: (reel: IgReel) => void }) {
  const [thumbErr, setThumbErr] = useState(false);
  const snap = reel.latest_snapshot;
  const er = reel.engagement_rate;

  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 transition-all cursor-pointer select-none"
      onClick={() => onOpen(reel)}
    >
      <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: "9/16" }}>
        {/* Account color strip */}
        <div className="absolute top-0 left-0 right-0 h-0.5 z-10" style={{ background: color }} />

        {reel.thumbnail_url && !thumbErr ? (
          <img
            src={proxyImg(reel.thumbnail_url)!}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setThumbErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800/80">
            {reel.post_type === "Reel" ? <Film className="w-10 h-10 text-zinc-700" /> : <Play className="w-10 h-10 text-zinc-700" />}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-semibold z-10">
          {reel.post_type === "Reel" ? <Film className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {reel.post_type}
        </div>

        {/* Views bottom */}
        {reel.views != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-2.5">
            <span className="flex items-center gap-1 text-white text-sm font-bold">
              <Eye className="w-3.5 h-3.5 opacity-80" />
              {fmt(reel.views)}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center z-10">
          <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-2 text-white">
            <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <span className="text-xs font-semibold">Détails</span>
          </div>
        </div>

        {/* Instagram link */}
        <a
          href={reel.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white z-20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Info footer */}
      <div className="p-3.5 flex flex-col gap-2 flex-1 min-h-0">
        <p className={`text-xs leading-relaxed line-clamp-2 ${reel.caption ? "text-zinc-400" : "text-zinc-700 italic"}`}>
          {reel.caption ?? "Pas de caption"}
        </p>
        <div className="flex items-center gap-2.5 text-[11px] text-zinc-600 mt-auto pt-1 border-t border-zinc-800 flex-wrap">
          {snap?.likes_count != null && (
            <span className="flex items-center gap-0.5 text-zinc-500"><Heart className="w-3 h-3" /> {fmt(snap.likes_count)}</span>
          )}
          {snap?.comments_count != null && (
            <span className="flex items-center gap-0.5 text-zinc-500"><MessageCircle className="w-3 h-3" /> {fmt(snap.comments_count)}</span>
          )}
          {reel.shares != null && reel.shares > 0 && (
            <span className="flex items-center gap-0.5 text-sky-500/70"><Share2 className="w-3 h-3" /> {fmt(reel.shares)}</span>
          )}
          {er != null && (
            <span className="flex items-center gap-0.5 text-emerald-500/70"><TrendingUp className="w-3 h-3" /> {er.toFixed(1)}%</span>
          )}
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
    try {
      const saved = localStorage.getItem(LS_ACCOUNTS_KEY);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // Metadata panel state
  const [activeMetaPost, setActiveMetaPost] = useState<PostForPanel | null>(null);
  const [metaMap, setMetaMap] = useState<Map<string, PostMetadata>>(new Map());

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    availableAccounts.forEach((a, i) => { map.set(a.id, ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]); });
    return map;
  }, [availableAccounts]);

  // Fetch available accounts on mount
  useEffect(() => {
    fetch(`/api/performance/instagram?period=${period}`)
      .then((r) => r.json())
      .then((json: IgPerformanceResponse) => {
        const accs = json.available_accounts ?? [];
        setAvailableAccounts(accs);
        setSelectedIds((prev) => {
          if (prev.size > 0) {
            const valid = new Set([...prev].filter((id) => accs.some((a) => a.id === id)));
            return valid.size > 0 ? valid : new Set(accs.map((a) => a.id));
          }
          return new Set(accs.map((a) => a.id));
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data when selection/period changes
  useEffect(() => {
    if (availableAccounts.length === 0) return;
    if (selectedIds.size === 0) { setData({}); return; }
    const ids = [...selectedIds].join(",");
    setLoadingData(true);
    fetch(`/api/performance/instagram?period=${period}&ids=${ids}`)
      .then((r) => r.json())
      .then((json: IgPerformanceResponse) => setData(json.data ?? {}))
      .finally(() => setLoadingData(false));
  }, [period, selectedIds, availableAccounts.length]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p as Period);
    localStorage.setItem(LS_PERIOD_KEY, p);
  };

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const handleOpenReel = useCallback((reel: IgReel) => {
    const post: PostForPanel = {
      id: reel.id,
      shortcode: reel.shortcode,
      post_type: reel.post_type,
      url: reel.url,
      caption: reel.caption,
      thumbnail_url: reel.thumbnail_url,
      posted_at: reel.posted_at,
      latest_snapshot: reel.latest_snapshot,
    };
    setActiveMetaPost(post);
  }, []);

  const handleCloseMeta = useCallback(() => {
    const post = activeMetaPost;
    setActiveMetaPost(null);
    if (post) {
      fetch(`/api/instagram/posts/${post.id}/metadata`)
        .then((r) => r.json())
        .then((d) => { if (d.metadata) setMetaMap((prev) => new Map(prev).set(post.id, d.metadata)); })
        .catch(() => null);
    }
  }, [activeMetaPost]);

  const selectedAccountData = [...selectedIds]
    .map((id) => data[id])
    .filter(Boolean) as IgAccountData[];

  const followerLines: LineData[] = selectedAccountData.map((a) => ({
    accountId: a.id, handle: a.instagram_handle, color: colorMap.get(a.id) ?? "#3b82f6", points: a.followers_history,
  }));

  const viewsLines: LineData[] = selectedAccountData
    .filter((a) => a.views_history.length > 0)
    .map((a) => ({
      accountId: a.id, handle: a.instagram_handle, color: colorMap.get(a.id) ?? "#3b82f6", points: a.views_history,
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (availableAccounts.length === 0 && profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <Film className="w-12 h-12 text-zinc-700" />
        <h2 className="text-lg font-semibold">Aucun compte assigné</h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          Demande à un admin de t&apos;assigner des comptes Instagram.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Performance</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Analytics Instagram — évolution &amp; réels</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <AccountSelector accounts={availableAccounts} selected={selectedIds} colors={colorMap} onChange={toggleAccount} />
            <PeriodDropdown
              value={period}
              onChange={handlePeriodChange}
              options={(["today", "yesterday", "week", "month", "inception"] as Period[]).map((p) => ({ key: p, label: PERIOD_LABELS[p] }))}
            />
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center h-48 text-zinc-600 text-sm gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Chargement…
          </div>
        ) : (
          <>
            {/* ── Stat cards ──────────────────────────────────── */}
            {selectedAccountData.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
                {selectedAccountData.map((account) => (
                  <AccountStatCard key={account.id} account={account} color={colorMap.get(account.id) ?? "#3b82f6"} />
                ))}
              </div>
            )}

            {/* ── Followers chart ─────────────────────────────── */}
            {followerLines.some((l) => l.points.length > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white">Évolution des abonnés</h2>
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
                <MultiLineChart lines={followerLines.filter((l) => l.points.length > 0)} />
              </div>
            )}

            {/* ── Views chart ──────────────────────────────────── */}
            {viewsLines.some((l) => l.points.length > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white">Vues totales cumulées</h2>
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

            {/* ── Reels par compte ─────────────────────────────── */}
            {selectedAccountData.filter((a) => a.top_reels.length > 0).length > 0 && (
              <div className="space-y-8">
                {selectedAccountData
                  .filter((a) => a.top_reels.length > 0)
                  .map((account) => {
                    const color = colorMap.get(account.id) ?? "#3b82f6";
                    return (
                      <div key={account.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                          <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={28} />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white">@{account.instagram_handle}</h3>
                            <p className="text-[11px] text-zinc-500">{account.top_reels.length} reel{account.top_reels.length !== 1 ? "s" : ""} • triés par vues</p>
                          </div>
                          <a
                            href={`/accounts/${account.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-400 hover:text-white transition-all"
                          >
                            Voir compte
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </a>
                        </div>
                        <div className="p-5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {account.top_reels.map((reel) => (
                              <ReelCard
                                key={reel.id}
                                reel={reel}
                                color={color}
                                onOpen={handleOpenReel}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {selectedAccountData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <Film className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Aucune donnée pour la sélection</p>
                <p className="text-xs mt-1">Sélectionne au moins un compte et lance une collecte.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Metadata panel ──────────────────────────────────── */}
      {activeMetaPost && (
        <PostMetadataPanel post={activeMetaPost} onClose={handleCloseMeta} />
      )}
    </div>
  );
}
