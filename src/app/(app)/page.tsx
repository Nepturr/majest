"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ProtectedPage } from "@/components/protected-page";
import { PeriodDropdown } from "@/components/period-dropdown";
import {
  Eye, Heart, MessageCircle, Share2, Users, Film,
  AtSign, TrendingUp, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { DashboardOverview, DashboardPeriod, TopPost, TopAccount } from "@/app/api/dashboard/overview/route";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
  return n.toLocaleString();
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function delta(n: number | null): string {
  if (n == null) return "";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmt(n)}`;
}

function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes(".supabase.co/storage/")) return url;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "inception", label: "All time" },
];

// ─────────────────────────────────────────────────────────────
// Interactive chart components
// ─────────────────────────────────────────────────────────────

type ChartPoint = { date: string; value: number };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AreaChart({
  data, color = "#3b82f6", height = 100, formatValue = (v: number) => fmt(v), gradId = "da",
}: {
  data: ChartPoint[]; color?: string; height?: number; formatValue?: (v: number) => string; gradId?: string;
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-zinc-700 text-xs" style={{ height }}>
        Not enough data yet
      </div>
    );
  }

  const W = 400, H = height, pad = 6;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals, min + 1);
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - pad - ((d.value - min) / (max - min)) * (H - pad * 2),
    ...d,
  }));
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${W} ${H} L 0 ${H} Z`;
  const gid = `${gradId}-${color.replace(/\W/g, "")}`;
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
        onMouseLeave={() => setHovIdx(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="90%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gid})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {hov && (
          <>
            <line x1={hov.x.toFixed(1)} y1="0" x2={hov.x.toFixed(1)} y2={H}
              stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={hov.x.toFixed(1)} cy={hov.y.toFixed(1)} r="3.5"
              fill={color} stroke="#09090b" strokeWidth="1.5" />
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

function BarChart({
  data, color = "#8b5cf6", height = 100, formatValue = (v: number) => fmt(v), gradId = "db",
}: {
  data: ChartPoint[]; color?: string; height?: number; formatValue?: (v: number) => string; gradId?: string;
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-zinc-700 text-xs" style={{ height }}>
        No data yet
      </div>
    );
  }

  const W = 400, H = height, gap = 2;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max((W - gap * (data.length - 1)) / data.length, 2);

  const hov = hovIdx != null ? data[hovIdx] : null;
  const tooltipLeft = hovIdx != null
    ? Math.max(5, Math.min(95, ((hovIdx * (barW + gap) + barW / 2) / W) * 100))
    : 50;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full cursor-crosshair" preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width * W;
          setHovIdx(Math.max(0, Math.min(data.length - 1, Math.floor(x / (barW + gap)))));
        }}
        onMouseLeave={() => setHovIdx(null)}
      >
        <defs>
          <linearGradient id={`${gradId}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const bh = Math.max((d.value / max) * H, 1.5);
          return (
            <rect key={i} x={i * (barW + gap)} y={H - bh} width={barW} height={bh}
              fill={i === hovIdx ? color : `url(#${gradId}-g)`}
              opacity={i === hovIdx ? 1 : 0.75} rx="1" />
          );
        })}
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
// Stat card
// ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, deltaVal, icon, accent = "blue", suffix,
}: {
  label: string;
  value: string;
  deltaVal?: number | null;
  icon: React.ReactNode;
  accent?: "blue" | "violet" | "cyan" | "emerald" | "amber" | "rose";
  suffix?: string;
}) {
  const colors = {
    blue:    { bg: "bg-blue-950/40",   border: "hover:border-blue-800/60",   icon: "text-blue-400",    val: "text-white" },
    violet:  { bg: "bg-violet-950/40", border: "hover:border-violet-800/60", icon: "text-violet-400",  val: "text-white" },
    cyan:    { bg: "bg-cyan-950/40",   border: "hover:border-cyan-800/60",   icon: "text-cyan-400",    val: "text-white" },
    emerald: { bg: "bg-emerald-950/40",border: "hover:border-emerald-800/60",icon: "text-emerald-400", val: "text-white" },
    amber:   { bg: "bg-amber-950/40",  border: "hover:border-amber-800/60",  icon: "text-amber-400",   val: "text-white" },
    rose:    { bg: "bg-rose-950/40",   border: "hover:border-rose-800/60",   icon: "text-rose-400",    val: "text-white" },
  };
  const c = colors[accent];
  const hasDelta = deltaVal != null;
  const isPos = (deltaVal ?? 0) >= 0;

  return (
    <div className={`rounded-xl border border-zinc-800 ${c.border} ${c.bg} p-4 flex flex-col gap-3 transition-all`}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${c.icon}`}>
          {icon}
          {label}
        </div>
        {hasDelta && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
            isPos
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-rose-500/15 text-rose-400"
          }`}>
            {delta(deltaVal)}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold tracking-tight leading-none ${c.val}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-zinc-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Post thumbnail with error fallback
// ─────────────────────────────────────────────────────────────

function PostThumb({ url, type, size = 40 }: { url: string | null; type: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{ width: size, height: size * (16 / 9) }}
        className="rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
        <Film className="w-4 h-4 text-zinc-600" />
      </div>
    );
  }
  return (
    <img src={proxyImg(url)!} alt="" onError={() => setErr(true)}
      style={{ width: size, height: size * (16 / 9), objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
  );
}

function AccountAvatar({ url, handle, size = 36 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img src={proxyImg(url)!} alt={handle} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback((p: DashboardPeriod) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetch(`/api/dashboard/overview?period=${p}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") setLoading(false); });
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const viewsChartData: ChartPoint[] = (data?.daily ?? []).map((d) => ({ date: d.date, value: d.views }));
  const engChartData: ChartPoint[] = (data?.daily ?? []).map((d) => ({ date: d.date, value: d.engagement }));

  return (
    <ProtectedPage pageId="dashboard">
      <div className="flex-1 px-6 py-6 max-w-screen-2xl mx-auto w-full space-y-6">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Overview across all accounts</p>
          </div>
          <PeriodDropdown
            value={period}
            onChange={(v) => setPeriod(v as DashboardPeriod)}
            options={PERIODS}
          />
        </div>

        {/* ── Stat cards ────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 h-24 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Total Videos"
              value={fmt(data.total_posts, 0)}
              icon={<Film className="w-3 h-3" />}
              accent="violet"
            />
            <StatCard
              label="Active Accounts"
              value={String(data.active_accounts)}
              icon={<AtSign className="w-3 h-3" />}
              accent="blue"
            />
            <StatCard
              label="Total Views"
              value={fmt(data.total_views)}
              deltaVal={data.total_views_delta}
              icon={<Eye className="w-3 h-3" />}
              accent="cyan"
            />
            <StatCard
              label="Followers"
              value={fmt(data.total_followers)}
              icon={<Users className="w-3 h-3" />}
              accent="emerald"
            />
            <StatCard
              label="Total Likes"
              value={fmt(data.total_likes)}
              icon={<Heart className="w-3 h-3" />}
              accent="rose"
            />
            <StatCard
              label="Total Comments"
              value={fmt(data.total_comments)}
              icon={<MessageCircle className="w-3 h-3" />}
              accent="amber"
            />
            <StatCard
              label="Avg Engagement"
              value={fmtPct(data.avg_engagement_rate)}
              icon={<TrendingUp className="w-3 h-3" />}
              accent="blue"
              suffix="%"
            />
            <StatCard
              label="Total Shares"
              value={fmt(data.total_shares)}
              icon={<Share2 className="w-3 h-3" />}
              accent="violet"
            />
          </div>
        ) : null}

        {/* ── Charts row ────────────────────────────────────── */}
        {!loading && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Views (bar) */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Views</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Daily views across all accounts</p>
                </div>
                <span className="text-xs font-mono text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded-lg">
                  {PERIODS.find((p) => p.key === period)?.label}
                </span>
              </div>
              {viewsChartData.length > 0 ? (
                <>
                  <BarChart data={viewsChartData} color="#8b5cf6" height={120} gradId="dv" />
                  <div className="flex justify-between text-[10px] text-zinc-700 mt-2 px-0.5">
                    <span>{fmtDate(viewsChartData[0].date)}</span>
                    <span>{fmtDate(viewsChartData.at(-1)!.date)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center text-zinc-700 text-xs h-28">
                  No data for this period
                </div>
              )}
            </div>

            {/* Engagement (area) */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Engagement</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Avg engagement rate per day</p>
                </div>
                <span className="text-xs font-mono text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded-lg">
                  {fmtPct(data.avg_engagement_rate)} avg
                </span>
              </div>
              {engChartData.length > 0 ? (
                <>
                  <AreaChart
                    data={engChartData} color="#10b981" height={120}
                    formatValue={(v) => `${v.toFixed(2)}%`} gradId="de"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-700 mt-2 px-0.5">
                    <span>{fmtDate(engChartData[0].date)}</span>
                    <span>{fmtDate(engChartData.at(-1)!.date)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center text-zinc-700 text-xs h-28">
                  No data for this period
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom row: Top Videos + Top Accounts ─────────── */}
        {!loading && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Top Videos */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-400" />
                  Top Videos
                </p>
                <span className="text-xs text-zinc-500">by views</span>
              </div>
              <div className="space-y-2">
                {data.top_posts.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-4 text-center">No posts yet</p>
                ) : data.top_posts.map((post) => (
                  <TopVideoRow key={post.id} post={post} />
                ))}
              </div>
            </div>

            {/* Top Accounts */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Top Accounts
                </p>
                <span className="text-xs text-zinc-500">by total views</span>
              </div>
              <div className="space-y-2">
                {data.top_accounts.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-4 text-center">No accounts yet</p>
                ) : data.top_accounts.map((acc, i) => (
                  <TopAccountRow key={acc.id} account={acc} rank={i + 1} />
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!loading && data?.active_accounts === 0 && (
          <div className="border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <AtSign className="w-5 h-5 text-zinc-500" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">No accounts yet</h3>
            <p className="text-xs text-zinc-500 mb-4">Add Instagram accounts to start tracking.</p>
            <Link href="/accounts"
              className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors">
              Add accounts
            </Link>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function TopVideoRow({ post }: { post: TopPost }) {
  const caption = post.caption
    ? post.caption.replace(/#\w+/g, "").trim().slice(0, 55) + (post.caption.length > 55 ? "…" : "")
    : "—";

  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/50 transition-colors group">
      <PostThumb url={post.thumbnail_url} type={post.post_type} size={32} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate">{caption}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">@{post.account_handle}</p>
      </div>
      <div className="flex items-center gap-3 text-[11px] shrink-0">
        <span className="flex items-center gap-1 text-zinc-400">
          <Eye className="w-3 h-3" />{fmt(post.views)}
        </span>
        <span className="flex items-center gap-1 text-zinc-600">
          <Heart className="w-3 h-3" />{fmt(post.likes)}
        </span>
        <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors">
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </a>
  );
}

function TopAccountRow({ account, rank }: { account: TopAccount; rank: number }) {
  return (
    <Link href={`/accounts/${account.id}`}
      className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/50 transition-colors">
      <span className="text-[11px] text-zinc-700 w-4 text-right shrink-0">{rank}</span>
      <AccountAvatar url={account.profile_pic_url} handle={account.handle} size={34} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate">@{account.handle}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{fmt(account.posts_count, 0)} posts</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-xs font-semibold text-zinc-300">{fmt(account.total_views)}</span>
        <span className="text-[11px] text-zinc-600">{fmtPct(account.avg_er)} ER</span>
      </div>
    </Link>
  );
}
