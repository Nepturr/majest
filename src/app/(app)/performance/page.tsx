"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PeriodDropdown } from "@/components/period-dropdown";
import { useAuth } from "@/components/auth-provider";
import type { IgAccountData, IgAvailableAccount, IgPerformanceResponse } from "@/app/api/performance/instagram/route";

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

// ─────────────────────────────────────────────────────────────
// IgAvatar
// ─────────────────────────────────────────────────────────────
function IgAvatar({ url, handle, size = 28 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div
        style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(9, size * 0.38), color: "#fff", fontWeight: 700, flexShrink: 0 }}
      >
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img src={`/api/proxy/image?url=${encodeURIComponent(url)}`} alt={handle} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} />
  );
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
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${isSelected ? "border-transparent" : "border-zinc-600"}`}
                  style={isSelected ? { background: color } : undefined}
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

interface MultiLineChartProps {
  lines: LineData[];
  label?: string;
  formatY?: (v: number) => string;
}

function MultiLineChart({ lines, label, formatY = fmt }: MultiLineChartProps) {
  const [hover, setHover] = useState<{ x: number; dateIdx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 800;
  const H = 200;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 32;

  // Collect all unique dates
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const line of lines) for (const p of line.points) set.add(p.date);
    return [...set].sort();
  }, [lines]);

  // Extent
  const allValues = lines.flatMap((l) => l.points.map((p) => p.value));
  const minV = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxV = allValues.length > 0 ? Math.max(...allValues) : 1;
  const range = maxV - minV || 1;

  const xScale = (i: number) => padL + (i / Math.max(allDates.length - 1, 1)) * (W - padL - padR);
  const yScale = (v: number) => padT + (1 - (v - minV) / range) * (H - padT - padB);

  // Hover date index
  const hoverDateIdx = hover?.dateIdx ?? null;
  const hoverDate = hoverDateIdx != null ? allDates[hoverDateIdx] : null;

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || allDates.length === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const relX = svgX - padL;
    const totalW = W - padL - padR;
    const frac = Math.max(0, Math.min(1, relX / totalW));
    const idx = Math.round(frac * (allDates.length - 1));
    setHover({ x: xScale(idx), dateIdx: idx });
  }, [allDates, xScale]);

  if (lines.length === 0 || allDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Aucune donnée disponible</div>
    );
  }

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: padT + (1 - f) * (H - padT - padB),
    label: formatY(Math.round(minV + f * range)),
  }));

  // X axis ticks (max 6)
  const xTickStep = Math.max(1, Math.floor(allDates.length / 6));
  const xTicks = allDates
    .filter((_, i) => i % xTickStep === 0 || i === allDates.length - 1)
    .map((d, _, arr) => ({ date: d, x: xScale(allDates.indexOf(d)) }));
  void xTicks;

  return (
    <div className="relative">
      {label && <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-3">{label}</p>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 200 }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#27272a" strokeWidth="1" />
            <text x={padL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#52525b">{t.label}</text>
          </g>
        ))}

        {/* Lines */}
        {lines.map((line) => {
          const pts = allDates.map((date) => {
            const found = line.points.find((p) => p.date === date);
            return found ? { x: xScale(allDates.indexOf(date)), y: yScale(found.value), hasData: true } : null;
          });

          // Build path segments (connect only adjacent non-null points)
          const segments: string[] = [];
          let current = "";
          for (const pt of pts) {
            if (!pt) { if (current) { segments.push(current); current = ""; } continue; }
            current += current ? ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
          }
          if (current) segments.push(current);

          return (
            <g key={line.accountId}>
              {segments.map((seg, i) => (
                <path key={i} d={seg} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
              ))}
              {/* Dots at data points */}
              {pts.map((pt, i) =>
                pt ? (
                  <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill={line.color} opacity="0.7" />
                ) : null
              )}
            </g>
          );
        })}

        {/* Hover vertical line */}
        {hover && (
          <line
            x1={hover.x} y1={padT} x2={hover.x} y2={H - padB}
            stroke="#52525b" strokeWidth="1" strokeDasharray="3 2"
          />
        )}

        {/* Hover dots */}
        {hover && lines.map((line) => {
          const found = hoverDate ? line.points.find((p) => p.date === hoverDate) : null;
          if (!found) return null;
          return (
            <circle key={line.accountId} cx={hover.x} cy={yScale(found.value)} r="4" fill={line.color} stroke="#18181b" strokeWidth="2" />
          );
        })}

        {/* X axis dates */}
        {allDates
          .filter((_, i) => i % Math.max(1, Math.floor(allDates.length / 5)) === 0 || i === allDates.length - 1)
          .map((date) => {
            const i = allDates.indexOf(date);
            const d = new Date(date);
            const label = `${d.getDate()}/${d.getMonth() + 1}`;
            return (
              <text key={date} x={xScale(i)} y={H - padB + 14} textAnchor="middle" fontSize="9" fill="#52525b">{label}</text>
            );
          })}
      </svg>

      {/* Tooltip */}
      {hover && hoverDate && (
        <div
          className="absolute top-0 pointer-events-none z-10"
          style={{ left: `${(hover.x / W) * 100}%`, transform: hover.x > W * 0.65 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
        >
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
// Stat cards row
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
// Reel card
// ─────────────────────────────────────────────────────────────
function ReelCard({ reel, color }: { reel: IgAccountData["top_reels"][number]; color: string }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={reel.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all block"
      style={{ aspectRatio: "9/16" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {reel.thumbnail_url ? (
        <img src={`/api/proxy/image?url=${encodeURIComponent(reel.thumbnail_url)}`} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" className="w-8 h-8">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      )}

      {/* Account color strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />

      {/* Bottom views */}
      {!hover && reel.views != null && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
          <p className="text-white text-[10px] font-semibold">👁 {fmt(reel.views)}</p>
        </div>
      )}

      {/* Hover overlay */}
      {hover && (
        <div className="absolute inset-0 bg-black/80 flex flex-col justify-end p-2 gap-0.5">
          {reel.views != null && <p className="text-white text-[10px] font-bold">{fmt(reel.views)} vues</p>}
          {reel.likes != null && <p className="text-zinc-300 text-[10px]">♥ {fmt(reel.likes)}</p>}
          {reel.comments != null && <p className="text-zinc-400 text-[10px]">💬 {fmt(reel.comments)}</p>}
          {reel.shares != null && reel.shares > 0 && <p className="text-zinc-400 text-[10px]">↗ {fmt(reel.shares)}</p>}
          {reel.engagement_rate != null && (
            <p className="text-emerald-400 text-[10px] font-semibold">{reel.engagement_rate.toFixed(1)}% ER</p>
          )}
          {reel.posted_at && (
            <p className="text-zinc-600 text-[9px] mt-1">
              {new Date(reel.posted_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            </p>
          )}
        </div>
      )}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { profile } = useAuth();

  // Restore period from localStorage
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window === "undefined") return "week";
    return (localStorage.getItem(LS_PERIOD_KEY) as Period) ?? "week";
  });

  const [availableAccounts, setAvailableAccounts] = useState<IgAvailableAccount[]>([]);
  const [data, setData] = useState<Record<string, IgAccountData>>({});
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Restore selected accounts from localStorage
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(LS_ACCOUNTS_KEY);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // Color assignment per account (stable)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    availableAccounts.forEach((a, i) => {
      map.set(a.id, ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]);
    });
    return map;
  }, [availableAccounts]);

  // Fetch available accounts on mount
  useEffect(() => {
    fetch(`/api/performance/instagram?period=${period}`)
      .then((r) => r.json())
      .then((json: IgPerformanceResponse) => {
        const accs = json.available_accounts ?? [];
        setAvailableAccounts(accs);
        // If no saved selection, select all by default
        setSelectedIds((prev) => {
          if (prev.size > 0) {
            // Filter to only keep valid IDs
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

  // Fetch data when selected accounts or period change
  useEffect(() => {
    if (availableAccounts.length === 0) return;
    if (selectedIds.size === 0) { setData({}); return; }

    const ids = [...selectedIds].join(",");
    setLoadingData(true);
    fetch(`/api/performance/instagram?period=${period}&ids=${ids}`)
      .then((r) => r.json())
      .then((json: IgPerformanceResponse) => {
        setData(json.data ?? {});
      })
      .finally(() => setLoadingData(false));
  }, [period, selectedIds, availableAccounts.length]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p as Period);
    localStorage.setItem(LS_PERIOD_KEY, p);
  };

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Build chart lines from selected accounts
  const selectedAccountData = [...selectedIds]
    .map((id) => data[id])
    .filter(Boolean) as IgAccountData[];

  const followerLines: LineData[] = selectedAccountData.map((a) => ({
    accountId: a.id,
    handle: a.instagram_handle,
    color: colorMap.get(a.id) ?? "#3b82f6",
    points: a.followers_history,
  }));

  const viewsLines: LineData[] = selectedAccountData
    .filter((a) => a.views_history.length > 0)
    .map((a) => ({
      accountId: a.id,
      handle: a.instagram_handle,
      color: colorMap.get(a.id) ?? "#3b82f6",
      points: a.views_history,
    }));

  // Collect all reels from selected accounts for the reels section
  const reelsByAccount = selectedAccountData
    .filter((a) => a.top_reels.length > 0)
    .map((a) => ({ account: a, color: colorMap.get(a.id) ?? "#3b82f6" }));

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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-zinc-700">
          <rect x="2" y="2" width="20" height="20" rx="5" /><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72M4 8.75c4.34.86 7.53 1.52 8.56 2.75" />
        </svg>
        <h2 className="text-lg font-semibold">Aucun compte assigné</h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          Demande à un administrateur de t&apos;assigner des comptes Instagram pour voir les performances.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Performance</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Analytics Instagram — évolution & réels</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <AccountSelector
              accounts={availableAccounts}
              selected={selectedIds}
              colors={colorMap}
              onChange={toggleAccount}
            />
            <PeriodDropdown
              value={period}
              onChange={handlePeriodChange}
              options={(["today", "yesterday", "week", "month", "inception"] as Period[]).map((p) => ({
                key: p,
                label: PERIOD_LABELS[p],
              }))}
            />
          </div>
        </div>

        {/* ── Selected account chips ───────────────────────────── */}
        {availableAccounts.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {availableAccounts.map((account) => {
              const isSelected = selectedIds.has(account.id);
              const color = colorMap.get(account.id) ?? "#3b82f6";
              return (
                <button
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    isSelected
                      ? "text-white border-transparent"
                      : "text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700"
                  }`}
                  style={isSelected ? { background: `${color}22`, borderColor: `${color}55` } : undefined}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: isSelected ? color : "#3f3f46" }} />
                  <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={18} />
                  <span className={isSelected ? "text-white" : "text-zinc-600"}>@{account.instagram_handle}</span>
                </button>
              );
            })}
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center h-48 text-zinc-600 text-sm gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Chargement des données…
          </div>
        ) : (
          <>
            {/* ── Stats cards ──────────────────────────────────── */}
            {selectedAccountData.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
                {selectedAccountData.map((account) => (
                  <AccountStatCard
                    key={account.id}
                    account={account}
                    color={colorMap.get(account.id) ?? "#3b82f6"}
                  />
                ))}
              </div>
            )}

            {/* ── Followers evolution chart ─────────────────────── */}
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
                <MultiLineChart
                  lines={followerLines.filter((l) => l.points.length > 0)}
                  formatY={fmt}
                />
              </div>
            )}

            {/* ── Total views evolution chart ───────────────────── */}
            {viewsLines.some((l) => l.points.length > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white">Évolution des vues totales</h2>
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
                <MultiLineChart
                  lines={viewsLines.filter((l) => l.points.length > 0)}
                  formatY={fmt}
                />
              </div>
            )}

            {/* ── Reels performance ─────────────────────────────── */}
            {reelsByAccount.length > 0 && (
              <div className="space-y-6">
                {reelsByAccount.map(({ account, color }) => (
                  <div key={account.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <IgAvatar url={account.profile_pic_url} handle={account.instagram_handle} size={24} />
                      <h3 className="text-sm font-semibold text-white">@{account.instagram_handle}</h3>
                      <span className="text-xs text-zinc-500 ml-auto">{account.top_reels.length} reel{account.top_reels.length !== 1 ? "s" : ""} — top par vues</span>
                    </div>
                    <div className="p-4">
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
                      >
                        {account.top_reels.slice(0, 12).map((reel) => (
                          <ReelCard key={reel.id} reel={reel} color={color} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {selectedAccountData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 opacity-40">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72M4 8.75c4.34.86 7.53 1.52 8.56 2.75" />
                </svg>
                <p className="text-sm">Aucune donnée pour la sélection</p>
                <p className="text-xs mt-1">Sélectionne au moins un compte et lance une collecte.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
