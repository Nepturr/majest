"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Heart, MessageCircle, Eye, RefreshCw,
  ExternalLink, TrendingUp, Film, Image as ImageIcon,
  Layers, Play, Users, PenLine, Share2, DollarSign,
  MousePointerClick, UserCheck, Link2,
} from "lucide-react";
import { PostMetadataPanel, hasMetadata } from "@/components/post-metadata-panel";
import type { PostForPanel, PostMetadata } from "@/components/post-metadata-panel";
import type { AccountAnalytics } from "@/app/api/instagram/[id]/analytics/route";
import { PeriodDropdown } from "@/components/period-dropdown";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "inception";
type SortKey = "views" | "likes" | "engagement" | "recent" | "comments" | "shares";
type TypeFilter = "all" | "Reel" | "Video" | "Image" | "Sidecar";

interface PostSnapshot {
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  views_count: number | null;
  plays_count: number | null;
  collected_at: string;
}

interface Post {
  id: string;
  shortcode: string;
  post_type: "Image" | "Video" | "Reel" | "Sidecar";
  url: string;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  latest_snapshot: PostSnapshot | null;
  views_delta: number | null;
  has_period_start: boolean;
}

interface AccountSnap {
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  profile_pic_url: string | null;
  collected_at: string;
}

interface Account {
  id: string;
  instagram_handle: string;
  niche: string | null;
  status: string;
  latest_snapshot?: AccountSnap | null;
  model?: { name: string; avatar_url: string | null } | null;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today",     label: "Today" },
  { key: "week",      label: "7 Days" },
  { key: "month",     label: "30 Days" },
  { key: "inception", label: "All Time" },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, compact = true): string {
  if (n == null) return "—";
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toFixed(0)}`;
}

function engagementRate(post: Post): number | null {
  const snap = post.latest_snapshot;
  if (!snap) return null;
  const interactions = (snap.likes_count ?? 0) + (snap.comments_count ?? 0);
  const views = snap.views_count ?? snap.plays_count;
  if (!views || views === 0) return null;
  return (interactions / views) * 100;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 365) return `${Math.floor(d / 365)}y`;
  if (d > 30) return `${Math.floor(d / 30)}mo`;
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  // Supabase storage URLs are already public — no proxy needed
  if (url.includes(".supabase.co/storage/")) return url;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function PostTypeIcon({ type, cls = "w-3 h-3" }: { type: Post["post_type"]; cls?: string }) {
  if (type === "Reel") return <Film className={cls} />;
  if (type === "Video") return <Play className={cls} />;
  if (type === "Sidecar") return <Layers className={cls} />;
  return <ImageIcon className={cls} />;
}

// ─────────────────────────────────────────────────────────────
// Interactive Chart components
// ─────────────────────────────────────────────────────────────

type ChartPoint = { date: string; value: number };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Interactive area/line chart with hover tooltip */
function AreaChart({
  data,
  color = "#3b82f6",
  height = 72,
  formatValue = (v: number) => fmt(v),
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
    return (
      <div className="flex items-center justify-center text-zinc-700 text-[10px]" style={{ height }}>
        Not enough data yet
      </div>
    );
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
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          setHovIdx(Math.max(0, Math.min(data.length - 1, Math.round(x * (data.length - 1)))));
        }}
        onMouseLeave={() => setHovIdx(null)}
      >
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
            <line x1={hov.x.toFixed(1)} y1="0" x2={hov.x.toFixed(1)} y2={H}
              stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={hov.x.toFixed(1)} cy={hov.y.toFixed(1)} r="3.5"
              fill={color} stroke="#09090b" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {hov && (
        <div
          className="absolute pointer-events-none z-20 bg-zinc-900/95 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm"
          style={{ bottom: "calc(100% + 6px)", left: `${tooltipLeft}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-semibold text-white whitespace-nowrap">{formatValue(hov.value)}</p>
          <p className="text-zinc-500 whitespace-nowrap mt-0.5">{fmtDate(hov.date)}</p>
        </div>
      )}
    </div>
  );
}

/** Interactive bar chart with hover tooltip */
function BarChart({
  data,
  color = "#6366f1",
  height = 56,
  formatValue = (v: number) => fmt(v),
  gradId = "bc",
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  gradId?: string;
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-zinc-700 text-[10px]" style={{ height }}>
        No data yet
      </div>
    );
  }

  const W = 300, H = height;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = 2;
  const barW = Math.max((W - gap * (data.length - 1)) / data.length, 2);

  const hov = hovIdx != null ? data[hovIdx] : null;
  const tooltipLeft = hovIdx != null
    ? Math.max(5, Math.min(95, ((hovIdx * (barW + gap) + barW / 2) / W) * 100))
    : 50;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.floor(x / (barW + gap));
          setHovIdx(Math.max(0, Math.min(data.length - 1, idx)));
        }}
        onMouseLeave={() => setHovIdx(null)}
      >
        <defs>
          <linearGradient id={`${gradId}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const bh = Math.max((d.value / max) * H, 1.5);
          const isHov = i === hovIdx;
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={H - bh}
              width={barW}
              height={bh}
              fill={isHov ? color : `url(#${gradId}-g)`}
              opacity={isHov ? 1 : 0.7}
              rx="1"
            />
          );
        })}
      </svg>
      {hov && (
        <div
          className="absolute pointer-events-none z-20 bg-zinc-900/95 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm"
          style={{ bottom: "calc(100% + 6px)", left: `${tooltipLeft}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-semibold text-white whitespace-nowrap">{formatValue(hov.value)}</p>
          <p className="text-zinc-500 whitespace-nowrap mt-0.5">{fmtDate(hov.date)}</p>
        </div>
      )}
    </div>
  );
}

/** SVG donut chart */
const DONUT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#6b7280"];

function DonutChart({ data }: { data: Array<{ country: string; pct: number; count: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!data.length || total === 0) {
    return (
      <div className="flex items-center justify-center text-zinc-700 text-[10px] h-full">
        No country data
      </div>
    );
  }

  const R = 36;
  const cx = 50;
  const cy = 50;
  const sw = 16;
  const gap = 0.02; // small gap between segments (radians)

  let angle = -Math.PI / 2;
  const segments = data.map((d, i) => {
    const sweep = (d.count / total) * (2 * Math.PI) - gap;
    const startAngle = angle + gap / 2;
    angle += (d.count / total) * (2 * Math.PI);
    const endAngle = startAngle + sweep;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const large = sweep > Math.PI ? 1 : 0;

    return {
      d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      country: d.country,
      pct: d.pct,
    };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-20 h-20 shrink-0">
        {segments.map((seg, i) => (
          <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={sw} />
        ))}
      </svg>
      <div className="flex flex-col gap-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-zinc-400 truncate">{seg.country}</span>
            <span className="text-zinc-600 ml-auto pl-1">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "blue",
  chart,
}: {
  label: string;
  value: string;
  sub?: string | null;
  icon: React.ReactNode;
  accent?: "blue" | "violet" | "cyan" | "emerald" | "amber" | "indigo";
  chart?: React.ReactNode;
}) {
  const accents = {
    blue:    { bg: "bg-blue-600/8",    border: "border-blue-500/15",   text: "text-blue-400",    val: "text-blue-200" },
    violet:  { bg: "bg-violet-600/8",  border: "border-violet-500/15", text: "text-violet-400",  val: "text-violet-200" },
    cyan:    { bg: "bg-cyan-600/8",    border: "border-cyan-500/15",   text: "text-cyan-400",    val: "text-cyan-200" },
    emerald: { bg: "bg-emerald-600/8", border: "border-emerald-500/15",text: "text-emerald-400", val: "text-emerald-200" },
    amber:   { bg: "bg-amber-600/8",   border: "border-amber-500/15",  text: "text-amber-400",   val: "text-amber-200" },
    indigo:  { bg: "bg-indigo-600/8",  border: "border-indigo-500/15", text: "text-indigo-400",  val: "text-indigo-200" },
  };
  const a = accents[accent];

  return (
    <div className={`rounded-2xl border ${a.bg} ${a.border} p-4 flex flex-col gap-2 min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium ${a.text}`}>
          {icon}
          {label}
        </div>
        {sub && <span className="text-[10px] text-zinc-600 shrink-0">{sub}</span>}
      </div>
      <p className={`text-2xl font-bold leading-none ${a.val}`}>{value}</p>
      {chart && <div className="mt-1">{chart}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// IgAvatar
// ─────────────────────────────────────────────────────────────
function IgAvatar({ url, handle, size = 56 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={proxyImg(url)!} alt={handle} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} />;
}

// ─────────────────────────────────────────────────────────────
// ReelCard
// ─────────────────────────────────────────────────────────────
function ReelCard({ post, metaMap, onOpenMeta }: {
  post: Post;
  metaMap: Map<string, PostMetadata>;
  onOpenMeta: (post: Post) => void;
}) {
  const [thumbErr, setThumbErr] = useState(false);
  const snap = post.latest_snapshot;
  const views = post.views_delta ?? snap?.views_count ?? snap?.plays_count;
  const er = engagementRate(post);
  const stale = post.last_seen_at
    ? Date.now() - new Date(post.last_seen_at).getTime() > 14 * 86400000
    : false;
  const inactive = !post.is_active || stale;
  const hasMeta = hasMetadata(metaMap.get(post.id) ?? null);

  return (
    <div
      className={`group flex flex-col rounded-2xl overflow-hidden border transition-all cursor-pointer select-none ${
        inactive
          ? "border-zinc-800/60 opacity-40 grayscale bg-zinc-900/50"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5"
      }`}
      onClick={() => onOpenMeta(post)}
    >
      {/* Thumbnail — with error fallback for expired CDN URLs */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: "9/16" }}>
        {post.thumbnail_url && !thumbErr ? (
          <img
            src={proxyImg(post.thumbnail_url)!}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setThumbErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800/80">
            <PostTypeIcon type={post.post_type} cls="w-10 h-10 text-zinc-700" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-semibold">
          <PostTypeIcon type={post.post_type} />
          {post.post_type}
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {hasMeta && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-900" />}
          {inactive && (
            <span className="bg-orange-700/90 rounded-full px-1.5 py-0.5 text-[9px] text-white font-medium">
              {!post.is_active ? "deleted" : "stale"}
            </span>
          )}
        </div>

        {views != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-2.5">
            <span className="flex items-center gap-1 text-white text-sm font-bold">
              <Eye className="w-3.5 h-3.5 opacity-80" />
              {fmt(views)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-2 text-white">
            <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <PenLine className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">Analyse</span>
          </div>
        </div>

        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-2.5 flex-1 min-h-0">
        <p className={`text-xs leading-relaxed line-clamp-3 ${post.caption ? "text-zinc-400" : "text-zinc-700 italic"}`}>
          {post.caption ?? "No caption"}
        </p>
        <div className="flex items-center gap-2.5 text-[11px] text-zinc-600 mt-auto pt-1 border-t border-zinc-800 flex-wrap">
          {snap?.likes_count != null && (
            <span className="flex items-center gap-0.5 text-zinc-500">
              <Heart className="w-3 h-3" /> {fmt(snap.likes_count)}
            </span>
          )}
          {snap?.comments_count != null && (
            <span className="flex items-center gap-0.5 text-zinc-500">
              <MessageCircle className="w-3 h-3" /> {fmt(snap.comments_count)}
            </span>
          )}
          {snap?.shares_count != null && (
            <span className="flex items-center gap-0.5 text-sky-500/70">
              <Share2 className="w-3 h-3" /> {fmt(snap.shares_count)}
            </span>
          )}
          {er != null && (
            <span className="flex items-center gap-0.5 text-emerald-500/70">
              <TrendingUp className="w-3 h-3" /> {er.toFixed(1)}%
            </span>
          )}
          <span className="ml-auto text-zinc-700 text-[10px]">{relativeTime(post.posted_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sort / Type options
// ─────────────────────────────────────────────────────────────
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views",      label: "Views" },
  { key: "likes",      label: "Likes" },
  { key: "shares",     label: "Shares" },
  { key: "engagement", label: "ER" },
  { key: "comments",   label: "Comments" },
  { key: "recent",     label: "Recent" },
];

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "Reel",    label: "Reels" },
  { key: "Video",   label: "Videos" },
  { key: "Image",   label: "Photos" },
  { key: "Sidecar", label: "Carousels" },
];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [analytics, setAnalytics] = useState<AccountAnalytics | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [sort, setSort] = useState<SortKey>("views");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [scanningReels, setScanningReels] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [activeMetaPost, setActiveMetaPost] = useState<Post | null>(null);
  const [metaMap, setMetaMap] = useState<Map<string, PostMetadata>>(new Map());
  const scanResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAccount = useCallback(async () => {
    setLoadingAcc(true);
    try {
      const res = await fetch("/api/admin/instagram-accounts");
      if (res.ok) {
        const data = await res.json();
        const found = (data.accounts ?? []).find((a: Account) => a.id === id);
        if (found) setAccount(found);
      }
    } finally { setLoadingAcc(false); }
  }, [id]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/instagram/${id}/posts?limit=500&period=inception`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } finally { setLoadingPosts(false); }
  }, [id]);

  const loadAnalytics = useCallback(async (p: Period) => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/instagram/${id}/analytics?period=${p}`);
      if (res.ok) setAnalytics(await res.json());
    } finally { setLoadingAnalytics(false); }
  }, [id]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadAnalytics(period); }, [loadAnalytics, period]);

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

  function showScanMsg(msg: string) {
    setScanResult(msg);
    if (scanResultTimer.current) clearTimeout(scanResultTimer.current);
    scanResultTimer.current = setTimeout(() => setScanResult(null), 6000);
  }

  async function runApifyScan(mode: "profile" | "reels"): Promise<{ status: string; postsSaved?: number; snapshotSaved?: boolean; error?: string } | null> {
    const res = await fetch(`/api/instagram/${id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const startData = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "FAILED", error: startData.error ?? `Error ${res.status}` };
    const { runId } = startData;
    if (!runId) return { status: "FAILED", error: "No runId from Apify" };

    let attempts = 0;
    while (attempts < 60) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await fetch(`/api/instagram/${id}/collect?runId=${runId}`);
      if (s.ok) {
        const d = await s.json();
        if (d.status === "SUCCEEDED" || d.status === "FAILED") return d;
      }
      attempts++;
    }
    return { status: "FAILED", error: "Timeout (> 5 min)" };
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await runApifyScan("profile");
      if (r?.error) showScanMsg(`Error: ${r.error}`);
      else { showScanMsg("Profile synced ✓"); loadAccount(); loadPosts(); loadAnalytics(period); }
    } finally { setSyncing(false); }
  };

  const handleScanReels = async () => {
    setScanningReels(true);
    showScanMsg("Scanning… (2–4 min)");
    try {
      const r = await runApifyScan("reels");
      if (r?.error) showScanMsg(`Error: ${r.error}`);
      else if (r?.status === "SUCCEEDED") {
        const saved = r.postsSaved ?? 0;
        if (saved === 0) showScanMsg("0 reels — private account or Apify quota reached");
        else { showScanMsg(`${saved} reels saved ✓`); loadPosts(); loadAnalytics(period); }
      } else {
        showScanMsg("Scan failed — check Apify key in Admin");
      }
    } finally { setScanningReels(false); }
  };

  // ── Filtrage + tri ─────────────────────────────────────────
  const filtered = posts.filter((p) => typeFilter === "all" || p.post_type === typeFilter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a.views_delta ?? a.latest_snapshot?.views_count ?? a.latest_snapshot?.plays_count ?? 0;
    const bv = b.views_delta ?? b.latest_snapshot?.views_count ?? b.latest_snapshot?.plays_count ?? 0;
    switch (sort) {
      case "views":      return bv - av;
      case "likes":      return (b.latest_snapshot?.likes_count ?? 0) - (a.latest_snapshot?.likes_count ?? 0);
      case "shares":     return (b.latest_snapshot?.shares_count ?? 0) - (a.latest_snapshot?.shares_count ?? 0);
      case "comments":   return (b.latest_snapshot?.comments_count ?? 0) - (a.latest_snapshot?.comments_count ?? 0);
      case "engagement": return (engagementRate(b) ?? 0) - (engagementRate(a) ?? 0);
      default:           return (b.posted_at ?? "").localeCompare(a.posted_at ?? "");
    }
  });

  const snap = account?.latest_snapshot;
  const withViews = posts.filter((p) => (p.latest_snapshot?.views_count ?? p.latest_snapshot?.plays_count) != null);
  const totalViews = withViews.reduce((s, p) => s + (p.latest_snapshot?.views_count ?? p.latest_snapshot?.plays_count ?? 0), 0);
  const avgViews = withViews.length > 0 ? Math.round(totalViews / withViews.length) : null;
  const postsWithLikes = posts.filter((p) => p.latest_snapshot?.likes_count != null);
  const avgLikes = postsWithLikes.length > 0
    ? Math.round(postsWithLikes.reduce((s, p) => s + (p.latest_snapshot?.likes_count ?? 0), 0) / postsWithLikes.length)
    : null;
  const postsWithEr = posts.filter((p) => engagementRate(p) != null);
  const avgEr = postsWithEr.length > 0
    ? postsWithEr.reduce((s, p) => s + (engagementRate(p) ?? 0), 0) / postsWithEr.length
    : null;
  const typeCounts = (["Reel", "Video", "Image", "Sidecar"] as const).map((t) => ({
    key: t, count: posts.filter((p) => p.post_type === t).length,
  }));

  const isBusy = syncing || scanningReels;
  const st = analytics?.stats;

  // Chart data (values only)
  // Pass full ChartPoint arrays for interactive hover tooltips
  const followersChartData: ChartPoint[] = analytics?.followers_history ?? [];
  const viewsChartData: ChartPoint[] = analytics?.views_history ?? [];
  const bioChartData: ChartPoint[] = analytics?.bio_clicks_history ?? [];

  // Period label for sub-text
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ── Sticky top bar ──────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {loadingAcc ? (
            <div className="w-40 h-5 bg-zinc-800 rounded animate-pulse" />
          ) : account && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <IgAvatar url={snap?.profile_pic_url ?? null} handle={account.instagram_handle} size={36} />
              <div className="min-w-0">
                <p className="font-bold text-white leading-none truncate">@{account.instagram_handle}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {fmt(snap?.followers_count)} followers
                  {account.model && <span className="ml-2 text-zinc-600">· {account.model.name}</span>}
                  {snap?.collected_at && <span className="ml-2 text-zinc-700">· synced {relativeTime(snap.collected_at)}</span>}
                </p>
              </div>
            </div>
          )}

          {scanResult && (
            <span className={`text-xs rounded-lg px-2.5 py-1 ${
              scanResult.includes("Error") || scanResult.includes("failed") || scanResult.includes("0 reels")
                ? "text-orange-400 bg-orange-900/20 border border-orange-700/30"
                : "text-emerald-400 bg-emerald-900/20 border border-emerald-700/30"
            }`}>
              {scanResult}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <a
              href={`https://instagram.com/${account?.instagram_handle ?? ""}`}
              target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-all"
              title="Open on Instagram"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={handleScanReels}
              disabled={isBusy}
              title="Scan Reels"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-700 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
            >
              <Film className={`w-3.5 h-3.5 ${scanningReels ? "animate-pulse" : ""}`} />
            </button>
            <button
              onClick={handleSync}
              disabled={isBusy}
              title="Sync profile"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6 max-w-screen-2xl mx-auto w-full space-y-6">

        {/* ── Period selector ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <PeriodDropdown
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS}
          />
        </div>

        {/* ── Stats cards ────────────────────────────────────── */}
        {loadingAnalytics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Views"
              value={fmt(st?.views_delta ?? st?.views_total)}
              sub={period !== "inception" && st?.views_delta != null ? `of ${fmt(st.views_total)} total` : null}
              icon={<Eye className="w-3 h-3" />}
              accent="blue"
              chart={viewsChartData.length >= 2 ? <AreaChart data={viewsChartData} color="#3b82f6" height={40} gradId="vc" /> : undefined}
            />
            <StatCard
              label="Followers"
              value={fmt(st?.followers_current)}
              sub={st?.followers_delta != null ? `${st.followers_delta > 0 ? "+" : ""}${fmt(st.followers_delta)} ${periodLabel}` : null}
              icon={<Users className="w-3 h-3" />}
              accent="violet"
              chart={followersChartData.length >= 2
                ? <AreaChart data={followersChartData} color="#8b5cf6" height={40} gradId="fc"
                    formatValue={(v) => v.toLocaleString()} />
                : undefined}
            />
            <StatCard
              label="Bio Clicks"
              value={st?.bio_clicks_na ? "N/A" : fmt(st?.bio_clicks)}
              sub={st?.bio_clicks_na ? "No full history — use a period" : periodLabel}
              icon={<Link2 className="w-3 h-3" />}
              accent={st?.bio_clicks_na ? "blue" : "cyan"}
              chart={!st?.bio_clicks_na && bioChartData.length >= 2 ? <BarChart data={bioChartData} color="#06b6d4" height={32} gradId="bc" /> : undefined}
            />
            <StatCard
              label={period === "inception" ? "Track Clicks (all-time)" : "Track Clicks"}
              value={st?.needs_more_data ? "—" : fmt(period === "inception" ? st?.track_clicks_total : st?.track_clicks_delta)}
              sub={st?.needs_more_data ? "Need 2+ collects" : period === "inception" ? "all-time" : periodLabel}
              icon={<MousePointerClick className="w-3 h-3" />}
              accent="indigo"
            />
            <StatCard
              label={period === "inception" ? "Subscribers (all-time)" : "Subscribers"}
              value={st?.needs_more_data ? "—" : fmt(period === "inception" ? st?.subscribers_total : st?.subscribers_delta)}
              sub={st?.needs_more_data ? "Need 2+ collects" : period === "inception" ? "all-time OF" : periodLabel}
              icon={<UserCheck className="w-3 h-3" />}
              accent="emerald"
            />
            <StatCard
              label={period === "inception" ? "Revenue (all-time)" : "Revenue"}
              value={st?.needs_more_data ? "—" : fmtMoney(period === "inception" ? st?.revenue_total : st?.revenue_delta)}
              sub={st?.needs_more_data ? "Need 2+ collects" : period === "inception" ? "all-time OF" : periodLabel}
              icon={<DollarSign className="w-3 h-3" />}
              accent="amber"
            />
            <StatCard
              label="LTV"
              value={st?.ltv != null ? `$${st.ltv.toFixed(2)}` : "—"}
              sub="revenue / sub (all-time)"
              icon={<TrendingUp className="w-3 h-3" />}
              accent="amber"
            />
            <StatCard
              label="Avg Views"
              value={fmt(avgViews)}
              sub={`${posts.length} posts in DB`}
              icon={<Eye className="w-3 h-3" />}
              accent="blue"
            />
          </div>
        )}

        {/* ── Charts row: trends + countries ─────────────────── */}
        {!loadingAnalytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Followers trend */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Followers over time
                </p>
                {followersChartData.length >= 2 && (
                  <div className="flex gap-3 text-[10px] text-zinc-600">
                    <span>{fmt(followersChartData[0].value)}</span>
                    <span className="text-zinc-400 font-medium">→ {fmt(followersChartData.at(-1)!.value)}</span>
                  </div>
                )}
              </div>
              <AreaChart data={followersChartData} color="#8b5cf6" height={80} gradId="ftl"
                formatValue={(v) => v.toLocaleString()} />
            </div>

            {/* Views trend */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium flex items-center gap-1.5">
                  <Eye className="w-3 h-3" /> Total views over time
                </p>
                {viewsChartData.length >= 2 && (
                  <div className="flex gap-3 text-[10px] text-zinc-600">
                    <span>{fmt(viewsChartData[0].value)}</span>
                    <span className="text-zinc-400 font-medium">→ {fmt(viewsChartData.at(-1)!.value)}</span>
                  </div>
                )}
              </div>
              <AreaChart data={viewsChartData} color="#3b82f6" height={80} gradId="vtl" />
            </div>

            {/* Country donut */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Audience countries
              </p>
              <DonutChart data={analytics?.country_breakdown ?? []} />
              {(analytics?.country_breakdown?.length ?? 0) === 0 && (
                <p className="text-[10px] text-zinc-700 text-center mt-2">
                  Collect GMS data to see countries
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Funnel bar ─────────────────────────────────────── */}
        {!loadingAnalytics && st && ((period === "inception" ? st.track_clicks_total : st.track_clicks_delta) ?? 0) > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Funnel {period === "inception" ? "(all-time)" : `(${periodLabel})`}
            </p>
            {(() => {
              const views  = (period === "inception" ? st.views_total : st.views_delta) ?? 0;
              // GMS bio clicks: N/A for inception
              const bio    = (!st.bio_clicks_na && st.bio_clicks != null) ? st.bio_clicks : null;
              const track  = (period === "inception" ? st.track_clicks_total : st.track_clicks_delta) ?? 0;
              const subs   = (period === "inception" ? st.subscribers_total : st.subscribers_delta) ?? 0;
              const rev    = st.revenue_total;
              const top    = Math.max(views, 1);
              const bar = (label: string, val: number, color: string) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500 w-24 text-right shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min((val / top) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-white w-16 shrink-0">{fmt(val)}</span>
                  <span className="text-[10px] text-zinc-600 w-10 shrink-0">
                    {top > 0 ? `${((val / top) * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
              );
              return (
                  <div className="space-y-2.5">
                  {bar("Views", views, "bg-blue-600")}
                  {bio != null && bio > 0 && bar("Bio Clicks", bio, "bg-indigo-500")}
                  {track > 0 && bar("Track Clicks", track, "bg-violet-500")}
                  {subs > 0 && bar("Subscribers", subs, "bg-emerald-500")}
                  {rev != null && rev > 0 && (
                    <div className="pt-2 mt-1 border-t border-zinc-800 flex items-center gap-6 text-xs">
                      <span className="text-zinc-500">Revenue</span>
                      <span className="font-semibold text-emerald-400">{fmtMoney(rev)}</span>
                      {subs > 0 && <span className="text-zinc-600">LTV {fmtMoney(st.ltv)}/sub</span>}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Content divider ────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">Content</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* ── Filters & Sort ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-wrap">
            {TYPE_OPTIONS.map((opt) => {
              const cnt = opt.key === "all" ? posts.length : typeCounts.find((t) => t.key === opt.key)?.count ?? 0;
              if (cnt === 0 && opt.key !== "all") return null;
              return (
                <button
                  key={opt.key}
                  onClick={() => setTypeFilter(opt.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
                    typeFilter === opt.key ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {opt.key === "Reel" && <Film className="w-3 h-3" />}
                  {opt.key === "Video" && <Play className="w-3 h-3" />}
                  {opt.key === "Image" && <ImageIcon className="w-3 h-3" />}
                  {opt.key === "Sidecar" && <Layers className="w-3 h-3" />}
                  {opt.label}
                  <span className="opacity-40">({cnt})</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Sort</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  sort === opt.key
                    ? "bg-zinc-700 border-zinc-600 text-white"
                    : "border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────────────── */}
        {loadingPosts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
                <div className="animate-pulse bg-zinc-800" style={{ aspectRatio: "9/16" }} />
                <div className="p-3.5 space-y-2">
                  <div className="h-2 bg-zinc-800 rounded" />
                  <div className="h-2 bg-zinc-800/60 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-700">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium text-zinc-500">No posts found</p>
            <p className="text-sm mt-1">Click the <Film className="inline w-3.5 h-3.5 mx-0.5" /> button to scan reels</p>
            <button
              onClick={handleScanReels}
              disabled={isBusy}
              className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Film className="w-4 h-4" />
              Scan Reels now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sorted.map((post) => (
              <ReelCard key={post.id} post={post} metaMap={metaMap} onOpenMeta={setActiveMetaPost} />
            ))}
          </div>
        )}
      </div>

      {/* ── Metadata panel ──────────────────────────────────── */}
      {activeMetaPost && (
        <PostMetadataPanel post={activeMetaPost as PostForPanel} onClose={handleCloseMeta} />
      )}
    </div>
  );
}
