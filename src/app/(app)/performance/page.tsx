"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FunnelAccount } from "@/app/api/performance/funnel/route";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Period = "today" | "yesterday" | "week" | "month";

interface Model { id: string; name: string; avatar_url: string | null; }

interface FunnelData {
  accounts: FunnelAccount[];
  models: Model[];
  period: Period;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(num: number | null | undefined, den: number | null | undefined, decimals = 1): string {
  if (!num || !den || den === 0) return "—";
  return `${((num / den) * 100).toFixed(decimals)}%`;
}

function delta(n: number | null): string {
  if (n == null) return "—";
  return n >= 0 ? `+${fmt(n)}` : fmt(n);
}

type Color = "green" | "yellow" | "red" | "neutral";

function rateColor(rate: number | null, thresholds: [number, number]): Color {
  if (rate == null) return "neutral";
  if (rate >= thresholds[0]) return "green";
  if (rate >= thresholds[1]) return "yellow";
  return "red";
}

const colorClasses: Record<Color, string> = {
  green: "text-emerald-400 bg-emerald-400/10",
  yellow: "text-amber-400 bg-amber-400/10",
  red: "text-red-400 bg-red-400/10",
  neutral: "text-zinc-500 bg-zinc-800/60",
};

// ─────────────────────────────────────────────────────────────
// IgAvatar
// ─────────────────────────────────────────────────────────────
function IgAvatar({ url, handle, size = 32 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    const initials = handle.slice(0, 2).toUpperCase();
    const style = { width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(10, size * 0.35), color: "#fff", fontWeight: 700, flexShrink: 0 };
    return <div style={style}>{initials}</div>;
  }
  return <img src={url} alt={handle} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} />;
}

// ─────────────────────────────────────────────────────────────
// Funnel Chart (Shopify-style SVG)
// ─────────────────────────────────────────────────────────────
interface ChartStage {
  label: string;
  sublabel?: string;
  value: number;
  pct: number; // % relative to first stage
}

function FunnelChart({ stages }: { stages: ChartStage[] }) {
  if (stages.length === 0) return null;

  const barW = 90;
  const gap = 50;
  const maxH = 160;
  const padTop = 56;
  const padBottom = 48;
  const totalW = stages.length * barW + (stages.length - 1) * gap;
  const totalH = padTop + maxH + padBottom;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      className="w-full"
      style={{ maxHeight: 280 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {stages.map((stage, i) => {
        const bh = Math.max(4, (stage.pct / 100) * maxH);
        const bx = i * (barW + gap);
        const by = padTop + maxH - bh;
        const next = stages[i + 1];

        return (
          <g key={i}>
            {/* Connecting trapezoid to next bar */}
            {next && (() => {
              const nextBh = Math.max(4, (next.pct / 100) * maxH);
              const nextBy = padTop + maxH - nextBh;
              const x1 = bx + barW;
              const x2 = bx + barW + gap;
              return (
                <path
                  d={`M ${x1} ${by} L ${x2} ${nextBy} L ${x2} ${padTop + maxH} L ${x1} ${padTop + maxH} Z`}
                  fill="rgba(59,130,246,0.15)"
                />
              );
            })()}

            {/* Bar */}
            <rect x={bx} y={by} width={barW} height={bh} rx="4" fill="#3b82f6" />

            {/* % above bar */}
            <text
              x={bx + barW / 2}
              y={by - 10}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#60a5fa"
            >
              {stage.pct.toFixed(stage.pct < 1 ? 2 : 1)}%
            </text>

            {/* Conversion arrow between bars */}
            {next && (
              <text
                x={bx + barW + gap / 2}
                y={padTop + maxH / 2 + 4}
                textAnchor="middle"
                fontSize="10"
                fill="#52525b"
              >
                ▶
              </text>
            )}

            {/* Stage label bottom */}
            <text
              x={bx + barW / 2}
              y={padTop + maxH + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#a1a1aa"
              fontWeight="500"
            >
              {stage.label}
            </text>

            {/* Value bottom */}
            <text
              x={bx + barW / 2}
              y={padTop + maxH + 32}
              textAnchor="middle"
              fontSize="11"
              fill="#71717a"
            >
              {fmt(stage.value)}
            </text>

            {/* Conv rate from previous */}
            {i > 0 && (
              <text
                x={bx + barW / 2}
                y={padTop - 12}
                textAnchor="middle"
                fontSize="9"
                fill="#52525b"
              >
                {pct(stage.value, stages[i - 1].value, 1)} conv.
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
      <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RateBadge
// ─────────────────────────────────────────────────────────────
function RateBadge({ rate, thresholds }: { rate: number | null; thresholds: [number, number] }) {
  if (rate == null) return <span className="text-xs text-zinc-600">—</span>;
  const c = rateColor(rate, thresholds);
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colorClasses[c]}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Account Row (expandable)
// ─────────────────────────────────────────────────────────────
function AccountRow({ account }: { account: FunnelAccount }) {
  const [open, setOpen] = useState(false);

  const ig = account.instagram;
  const gms = account.gms;
  const track = account.tracking;

  const followers = ig.followers_current;
  // CTR = clicks / views (if available) or clicks / followers
  const funnelBase = ig.views_delta ?? followers;
  const bioCtr = gms && funnelBase ? (gms.clicks / funnelBase) * 100 : null;
  const trackCtr = gms && gms.clicks > 0 ? ((track?.clicks_delta ?? 0) / gms.clicks) * 100 : null;
  const subRate = track && track.clicks_delta > 0 ? (track.subscribers_delta / track.clicks_delta) * 100 : null;

  return (
    <>
      <tr
        className="border-b border-zinc-800 hover:bg-zinc-900/60 cursor-pointer transition-colors"
        onClick={() => setOpen(!open)}
      >
        {/* Account */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <IgAvatar url={ig.profile_pic_url} handle={account.instagram_handle} size={32} />
            <div>
              <p className="text-sm font-medium text-white leading-none">@{account.instagram_handle}</p>
              {account.model && (
                <p className="text-xs text-zinc-500 mt-0.5">{account.model.name}</p>
              )}
            </div>
          </div>
        </td>

        {/* Views / Followers */}
        <td className="px-4 py-3 text-right">
          {ig.views_delta != null ? (
            <>
              <p className="text-sm font-semibold text-white">{fmt(ig.views_delta)} <span className="text-xs font-normal text-zinc-500">vues</span></p>
              <p className="text-xs text-zinc-500 mt-0.5">{fmt(followers)} followers</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">{fmt(followers)}</p>
              <p className="text-xs text-zinc-600 mt-0.5">pas de vues</p>
            </>
          )}
        </td>

        {/* Bio clicks */}
        <td className="px-4 py-3 text-right">
          <p className="text-sm font-semibold text-white">{fmt(gms?.clicks)}</p>
          <div className="mt-0.5">
            <RateBadge rate={bioCtr} thresholds={[3, 1]} />
          </div>
        </td>

        {/* Track clicks */}
        <td className="px-4 py-3 text-right">
          <p className="text-sm font-semibold text-white">{fmt(track?.clicks_delta)}</p>
          <div className="mt-0.5">
            <RateBadge rate={trackCtr} thresholds={[30, 10]} />
          </div>
        </td>

        {/* Subscribers */}
        <td className="px-4 py-3 text-right">
          <p className="text-sm font-semibold text-white">{fmt(track?.subscribers_delta)}</p>
          <div className="mt-0.5">
            <RateBadge rate={subRate} thresholds={[5, 2]} />
          </div>
        </td>

        {/* Chevron */}
        <td className="px-3 py-3 text-zinc-600">
          <span
            className="transition-transform inline-block"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ›
          </span>
        </td>
      </tr>

      {open && (
        <tr className="bg-zinc-900/40 border-b border-zinc-800">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Avg Likes</p>
                <p className="text-white font-medium">{fmt(ig.avg_likes)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Avg Views</p>
                <p className="text-white font-medium">{fmt(ig.avg_views)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Avg Comments</p>
                <p className="text-white font-medium">{fmt(ig.avg_comments)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Tier 1 Audience</p>
                <p className="text-white font-medium">
                  {account.gms?.tier1_pct != null ? `${account.gms.tier1_pct}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Posts in DB</p>
                <p className="text-white font-medium">{ig.total_posts_in_db}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Total Track Clicks</p>
                <p className="text-white font-medium">{fmt(track?.clicks_total)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Total Subs (OF link)</p>
                <p className="text-white font-medium">{fmt(track?.subscribers_total)}</p>
              </div>
              {account.niche && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Niche</p>
                  <p className="text-white font-medium">{account.niche}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
};

export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>("week");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: Period) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/funnel?period=${p}`, { signal: abortRef.current.signal });
      if (res.ok) {
        const json = await res.json();
        setData({ accounts: json.accounts ?? [], models: json.models ?? [], period: json.period ?? p });
      }
    } catch {
      // aborted or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const handleCollect = async () => {
    setCollecting(true);
    setCollectMsg(null);
    try {
      const res = await fetch("/api/collect/daily", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setCollectMsg(`Collecte terminée — GMS: ${json.gms_accounts_collected ?? 0}, Tracking: ${json.tracking_accounts_collected ?? 0}`);
        load(period);
      } else {
        setCollectMsg(json.error ?? "Erreur lors de la collecte");
      }
    } catch {
      setCollectMsg("Erreur réseau");
    } finally {
      setCollecting(false);
    }
  };

  // Filter by model
  const accounts = selectedModelId
    ? (data?.accounts ?? []).filter((a) => a.model?.id === selectedModelId)
    : (data?.accounts ?? []);

  // Aggregate KPIs
  const totalFollowers = accounts.reduce((s, a) => s + (a.instagram.followers_current ?? 0), 0);
  const totalViews = accounts.reduce((s, a) => s + (a.instagram.views_delta ?? 0), 0);
  const hasViewData = accounts.some((a) => a.instagram.views_delta != null);
  const totalBioClicks = accounts.reduce((s, a) => s + (a.gms?.clicks ?? 0), 0);
  const totalTrackClicks = accounts.reduce((s, a) => s + (a.tracking?.clicks_delta ?? 0), 0);
  const totalSubs = accounts.reduce((s, a) => s + (a.tracking?.subscribers_delta ?? 0), 0);

  // Use views as top of funnel if available, otherwise followers
  const funnelTop = hasViewData ? totalViews : totalFollowers;
  const funnelTopLabel = hasViewData ? "Views" : "Followers";
  const globalBioCtr = funnelTop > 0 ? (totalBioClicks / funnelTop) * 100 : null;
  const globalTrackCtr = totalBioClicks > 0 ? (totalTrackClicks / totalBioClicks) * 100 : null;
  const globalSubRate = totalTrackClicks > 0 ? (totalSubs / totalTrackClicks) * 100 : null;

  // Funnel chart stages
  const chartStages: ChartStage[] = [
    { label: funnelTopLabel, value: funnelTop, pct: 100 },
    { label: "Bio Clicks", value: totalBioClicks, pct: funnelTop > 0 ? (totalBioClicks / funnelTop) * 100 : 0 },
    { label: "Track Clicks", value: totalTrackClicks, pct: funnelTop > 0 ? (totalTrackClicks / funnelTop) * 100 : 0 },
    { label: "Subscribers", value: totalSubs, pct: funnelTop > 0 ? (totalSubs / funnelTop) * 100 : 0 },
  ].filter((s) => s.value > 0 || s.label === funnelTopLabel);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Performance</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Funnel complet — données depuis la DB</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Collect button */}
            <button
              onClick={handleCollect}
              disabled={collecting}
              className="text-sm px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {collecting ? (
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M4 4v5h5M20 20v-5h-5"/>
                  <path d="M4 9a9 9 0 0115 0M20 15a9 9 0 01-15 0"/>
                </svg>
              )}
              {collecting ? "Collecte…" : "Collecter maintenant"}
            </button>

            {/* Period selector */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-0.5">
              {(["yesterday", "today", "week", "month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all font-medium ${
                    period === p
                      ? "bg-blue-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {collectMsg && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300">
            {collectMsg}
          </div>
        )}

        {/* ── Model chips ──────────────────────────────────────── */}
        {(data?.models ?? []).length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedModelId(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                selectedModelId === null
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white"
              }`}
            >
              All
            </button>
            {(data?.models ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModelId(m.id === selectedModelId ? null : m.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  selectedModelId === m.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white"
                }`}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[9px] font-bold text-white">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {m.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
            <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Chargement…
          </div>
        ) : (
          <>
            {/* ── KPI cards (like OF earnings) ─────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <KpiCard
                label={hasViewData ? "Views" : "Followers"}
                value={hasViewData ? fmt(totalViews) : fmt(totalFollowers)}
                sub={hasViewData
                  ? `${fmt(totalFollowers)} followers au total`
                  : "Sync un compte pour voir les vues"
                }
                color="bg-indigo-500/10 text-indigo-400"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              />
              <KpiCard
                label="Bio Clicks"
                value={fmt(totalBioClicks)}
                sub={globalBioCtr != null ? `CTR ${globalBioCtr.toFixed(1)}%` : "Pas de données GMS"}
                color="bg-sky-500/10 text-sky-400"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                }
              />
              <KpiCard
                label="Tracking Clicks"
                value={fmt(totalTrackClicks)}
                sub={globalTrackCtr != null ? `CTR ${globalTrackCtr.toFixed(1)}%` : "Pas de données OFAPI"}
                color="bg-violet-500/10 text-violet-400"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                }
              />
              <KpiCard
                label="New Subscribers"
                value={fmt(totalSubs)}
                sub={globalSubRate != null ? `Conv. ${globalSubRate.toFixed(1)}%` : "Pas de données OFAPI"}
                color="bg-emerald-500/10 text-emerald-400"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                }
              />
            </div>

            {/* ── Funnel chart ─────────────────────────────────── */}
            {totalFollowers > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Conversion Rate</h2>
                    <p className="text-3xl font-bold text-white mt-1">
                      {pct(totalSubs, totalFollowers, 2)}
                      {globalSubRate != null && (
                        <span className="text-sm text-zinc-500 font-normal ml-2">follower → sub</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <p>{PERIOD_LABELS[period]}</p>
                    {selectedModelId && data?.models.find(m => m.id === selectedModelId) && (
                      <p className="mt-0.5 text-zinc-400">{data.models.find(m => m.id === selectedModelId)!.name}</p>
                    )}
                  </div>
                </div>

                {/* Stage summary row */}
                <div className="flex gap-6 mb-6 flex-wrap">
                  <div>
                    <p className="text-xs text-zinc-500">{funnelTopLabel}</p>
                    <p className="text-sm font-semibold text-white">100%</p>
                    <p className="text-xs text-zinc-500">{fmt(funnelTop)}</p>
                  </div>
                  <div className="text-zinc-700 self-center">›</div>
                  <div>
                    <p className="text-xs text-zinc-500">Bio clicks</p>
                    <p className="text-sm font-semibold text-white">
                      {globalBioCtr != null ? `${globalBioCtr.toFixed(2)}%` : "—"}
                    </p>
                    <p className="text-xs text-zinc-500">{fmt(totalBioClicks)}</p>
                  </div>
                  <div className="text-zinc-700 self-center">›</div>
                  <div>
                    <p className="text-xs text-zinc-500">Track clicks</p>
                    <p className="text-sm font-semibold text-white">
                      {globalTrackCtr != null ? `${globalTrackCtr.toFixed(2)}%` : "—"}
                    </p>
                    <p className="text-xs text-zinc-500">{fmt(totalTrackClicks)}</p>
                  </div>
                  <div className="text-zinc-700 self-center">›</div>
                  <div>
                    <p className="text-xs text-zinc-500">Subscribers</p>
                    <p className="text-sm font-semibold text-white">
                      {pct(totalSubs, totalFollowers, 2)}
                    </p>
                    <p className="text-xs text-zinc-500">{fmt(totalSubs)}</p>
                  </div>
                </div>

                <FunnelChart stages={chartStages} />
              </div>
            )}

            {/* ── Per-account table ────────────────────────────── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white">Par compte</h2>
                <p className="text-xs text-zinc-500">{accounts.length} compte{accounts.length !== 1 ? "s" : ""} • {PERIOD_LABELS[period]}</p>
              </div>

              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 opacity-40">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                  <p className="text-sm">Aucun compte pour cette période</p>
                  <p className="text-xs mt-1">Lance une collecte pour récupérer les données.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
                        <th className="px-4 py-2.5 text-left font-medium">Compte</th>
                        <th className="px-4 py-2.5 text-right font-medium">Views / Followers</th>
                        <th className="px-4 py-2.5 text-right font-medium">Bio Clicks</th>
                        <th className="px-4 py-2.5 text-right font-medium">Track Clicks</th>
                        <th className="px-4 py-2.5 text-right font-medium">Subscribers</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a) => (
                        <AccountRow key={a.id} account={a} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
