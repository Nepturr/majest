"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Heart, MessageCircle, Eye, RefreshCw,
  ExternalLink, TrendingUp, Film, Image as ImageIcon,
  Layers, Play, Users, PenLine,
} from "lucide-react";
import { PostMetadataPanel, hasMetadata } from "@/components/post-metadata-panel";
import type { PostForPanel, PostMetadata } from "@/components/post-metadata-panel";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "inception";
type SortKey = "views" | "likes" | "engagement" | "recent" | "comments";
type TypeFilter = "all" | "Reel" | "Video" | "Image" | "Sidecar";

interface PostSnapshot {
  likes_count: number | null;
  comments_count: number | null;
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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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
  if (d > 30) return `${Math.floor(d / 30)}mo`;
  if (d > 0) return `${d}j`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function PostTypeIcon({ type, cls = "w-3 h-3" }: { type: Post["post_type"]; cls?: string }) {
  if (type === "Reel") return <Film className={cls} />;
  if (type === "Video") return <Play className={cls} />;
  if (type === "Sidecar") return <Layers className={cls} />;
  return <ImageIcon className={cls} />;
}

// ─────────────────────────────────────────────────────────────
// IgAvatar
// ─────────────────────────────────────────────────────────────
function IgAvatar({ url, handle, size = 64 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = handle.slice(0, 2).toUpperCase();
  if (!url || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
        {initials}
      </div>
    );
  }
  return (
    <img src={proxyImg(url) ?? url} alt={handle} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} />
  );
}

// ─────────────────────────────────────────────────────────────
// ReelCard — thumbnail + caption + metrics
// ─────────────────────────────────────────────────────────────
function ReelCard({
  post,
  metaMap,
  onOpenMeta,
}: {
  post: Post;
  metaMap: Map<string, PostMetadata>;
  onOpenMeta: (post: Post) => void;
}) {
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
      className={`group flex flex-col rounded-xl overflow-hidden bg-zinc-900 border transition-all cursor-pointer ${
        inactive
          ? "border-zinc-800 opacity-40 grayscale"
          : "border-zinc-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5"
      }`}
      onClick={() => onOpenMeta(post)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "9/16" }}>
        {post.thumbnail_url ? (
          <img
            src={proxyImg(post.thumbnail_url)!}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
            <PostTypeIcon type={post.post_type} cls="w-8 h-8" />
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-2">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 text-white text-[10px] font-medium">
            <PostTypeIcon type={post.post_type} />
            <span>{post.post_type}</span>
          </div>
          <div className="flex items-center gap-1">
            {hasMeta && (
              <div className="w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black/50" title="Metadata remplie" />
            )}
            {inactive && (
              <span className="bg-orange-700/80 rounded-full px-1.5 py-0.5 text-[9px] text-white">
                {!post.is_active ? "supprimé" : "stale"}
              </span>
            )}
          </div>
        </div>

        {/* Views always visible at bottom */}
        {views != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2.5 pt-6 pb-2">
            <div className="flex items-center gap-1 text-white text-xs font-semibold">
              <Eye className="w-3 h-3 opacity-80" />
              {fmt(views)}
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex flex-col items-center gap-1.5 text-white text-xs">
            <PenLine className="w-5 h-5" />
            <span className="font-medium">Analyser</span>
          </div>
        </div>

        {/* IG link */}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white"
          title="Voir sur Instagram"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Info below thumbnail */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Caption */}
        {post.caption && (
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
            {post.caption}
          </p>
        )}
        {!post.caption && (
          <p className="text-xs text-zinc-700 italic">Pas de description</p>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-auto">
          {snap?.likes_count != null && (
            <span className="flex items-center gap-0.5">
              <Heart className="w-3 h-3" /> {fmt(snap.likes_count)}
            </span>
          )}
          {snap?.comments_count != null && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" /> {fmt(snap.comments_count)}
            </span>
          )}
          {er != null && (
            <span className="flex items-center gap-0.5 text-emerald-500/80">
              <TrendingUp className="w-3 h-3" /> {er.toFixed(1)}%
            </span>
          )}
          <span className="ml-auto text-zinc-700 text-[10px]">
            {relativeTime(post.posted_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, accent = false,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${accent ? "bg-blue-600/10 border-blue-500/30" : "bg-zinc-900 border-zinc-800"}`}>
      <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold ${accent ? "text-blue-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Period options
// ─────────────────────────────────────────────────────────────
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "inception", label: "Depuis inception" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Vues" },
  { key: "likes", label: "Likes" },
  { key: "engagement", label: "ER" },
  { key: "recent", label: "Récent" },
  { key: "comments", label: "Commentaires" },
];

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "Reel", label: "Réels" },
  { key: "Video", label: "Vidéos" },
  { key: "Image", label: "Photos" },
  { key: "Sidecar", label: "Carrousels" },
];

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [period, setPeriod] = useState<Period>("inception");
  const [sort, setSort] = useState<SortKey>("views");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [scanningReels, setScanningReels] = useState(false);
  const [reelsScanResult, setReelsScanResult] = useState<{ postsSaved: number } | null>(null);

  // Metadata panel
  const [activeMetaPost, setActiveMetaPost] = useState<Post | null>(null);
  const [metaMap, setMetaMap] = useState<Map<string, PostMetadata>>(new Map());

  const loadAccount = useCallback(async () => {
    setLoadingAcc(true);
    try {
      const res = await fetch("/api/admin/instagram-accounts");
      if (res.ok) {
        const data = await res.json();
        const found = (data.accounts ?? data ?? []).find((a: Account) => a.id === id);
        if (found) setAccount(found);
      }
    } finally {
      setLoadingAcc(false);
    }
  }, [id]);

  const loadPosts = useCallback(async (p: Period) => {
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/instagram/${id}/posts?limit=500&period=${p}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, [id]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { loadPosts(period); }, [loadPosts, period]);

  const handleCloseMeta = useCallback(() => {
    const post = activeMetaPost;
    setActiveMetaPost(null);
    if (post) {
      fetch(`/api/instagram/posts/${post.id}/metadata`)
        .then((r) => r.json())
        .then((d) => {
          if (d.metadata) setMetaMap((prev) => new Map(prev).set(post.id, d.metadata));
        })
        .catch(() => null);
    }
  }, [activeMetaPost]);

  async function runApifyScan(mode: "profile" | "reels") {
    const startRes = await fetch(`/api/instagram/${id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!startRes.ok) return null;
    const { runId } = await startRes.json();
    let attempts = 0;
    while (attempts < 40) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(`/api/instagram/${id}/collect?runId=${runId}`);
      if (statusRes.ok) {
        const s = await statusRes.json();
        if (s.status === "SUCCEEDED" || s.status === "FAILED") return s;
      }
      attempts++;
    }
    return null;
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      await runApifyScan("profile");
      loadAccount();
      loadPosts(period);
    } finally { setSyncing(false); }
  };

  const handleScanReels = async () => {
    setScanningReels(true);
    setReelsScanResult(null);
    try {
      const result = await runApifyScan("reels");
      if (result) setReelsScanResult({ postsSaved: result.postsSaved ?? 0 });
      loadPosts(period);
    } finally { setScanningReels(false); }
  };

  // ── Filter & Sort ──────────────────────────────────────────
  const filtered = posts.filter((p) => typeFilter === "all" || p.post_type === typeFilter);

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "views":
        return (b.views_delta ?? b.latest_snapshot?.views_count ?? b.latest_snapshot?.plays_count ?? 0)
             - (a.views_delta ?? a.latest_snapshot?.views_count ?? a.latest_snapshot?.plays_count ?? 0);
      case "likes":
        return (b.latest_snapshot?.likes_count ?? 0) - (a.latest_snapshot?.likes_count ?? 0);
      case "comments":
        return (b.latest_snapshot?.comments_count ?? 0) - (a.latest_snapshot?.comments_count ?? 0);
      case "engagement":
        return (engagementRate(b) ?? 0) - (engagementRate(a) ?? 0);
      default:
        return (b.posted_at ?? "").localeCompare(a.posted_at ?? "");
    }
  });

  // ── Aggregate stats ────────────────────────────────────────
  const snap = account?.latest_snapshot;
  const withViews = posts.filter((p) => p.views_delta != null);
  const totalViews = withViews.reduce((s, p) => s + (p.views_delta ?? 0), 0);
  const avgViews = withViews.length > 0 ? Math.round(totalViews / withViews.length) : null;
  const postsWithLikes = posts.filter((p) => p.latest_snapshot?.likes_count != null);
  const avgLikes = postsWithLikes.length > 0
    ? Math.round(postsWithLikes.reduce((s, p) => s + (p.latest_snapshot?.likes_count ?? 0), 0) / postsWithLikes.length)
    : null;
  const postsWithEr = posts.filter((p) => engagementRate(p) != null);
  const avgEr = postsWithEr.length > 0
    ? postsWithEr.reduce((s, p) => s + (engagementRate(p) ?? 0), 0) / postsWithEr.length
    : null;

  const typeCounts = TYPE_OPTIONS.slice(1).map((o) => ({
    key: o.key,
    count: posts.filter((p) => p.post_type === o.key).length,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Comptes
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {reelsScanResult && (
              <span className="text-xs text-purple-400 bg-purple-900/20 border border-purple-700/30 rounded-lg px-3 py-1.5">
                {reelsScanResult.postsSaved} réel{reelsScanResult.postsSaved !== 1 ? "s" : ""} ✓
              </span>
            )}
            <a
              href={`https://instagram.com/${account?.instagram_handle ?? ""}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors border border-zinc-700 rounded-lg px-3 py-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Instagram
            </a>
            <button
              onClick={handleScanReels}
              disabled={scanningReels || syncing}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
            >
              <Film className={`w-3.5 h-3.5 ${scanningReels ? "animate-spin" : ""}`} />
              {scanningReels ? "Scan réels…" : "Scan Réels"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || scanningReels}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync…" : "Sync profil"}
            </button>
          </div>
        </div>

        {/* ── Profile header ───────────────────────────────── */}
        {loadingAcc ? (
          <div className="flex items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse" />
            <div className="space-y-2">
              <div className="w-36 h-5 bg-zinc-800 rounded animate-pulse" />
              <div className="w-24 h-3 bg-zinc-800/60 rounded animate-pulse" />
            </div>
          </div>
        ) : account ? (
          <div className="flex items-start gap-5 mb-6">
            <IgAvatar url={snap?.profile_pic_url ?? null} handle={account.instagram_handle} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-white">@{account.instagram_handle}</h1>
                {account.model && (
                  <span className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-0.5">
                    {account.model.name}
                  </span>
                )}
                {account.niche && (
                  <span className="text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700/40 rounded-full px-2.5 py-0.5">
                    {account.niche}
                  </span>
                )}
              </div>
              <div className="flex gap-5 mt-2">
                {[
                  { label: "Followers", val: fmt(snap?.followers_count) },
                  { label: "Following", val: fmt(snap?.following_count) },
                  { label: "Posts IG", val: fmt(snap?.posts_count) },
                  { label: "En DB", val: String(posts.length) },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-sm font-bold text-white">{val}</p>
                    <p className="text-[10px] text-zinc-600">{label}</p>
                  </div>
                ))}
              </div>
              {snap?.collected_at && (
                <p className="text-[10px] text-zinc-700 mt-1.5">
                  Sync : {relativeTime(snap.collected_at)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm mb-6">Compte introuvable.</p>
        )}

        {/* ── Period selector ──────────────────────────────── */}
        <div className="flex items-center gap-1.5 mb-5 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                period === p.key
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Stats cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          <StatCard
            label="Vues"
            value={fmt(totalViews)}
            sub={period === "inception" ? "all-time" : `cette ${period === "week" ? "semaine" : period === "month" ? "période" : "journée"}`}
            icon={<Eye className="w-3.5 h-3.5" />}
            accent
          />
          <StatCard
            label="Avg vues"
            value={fmt(avgViews)}
            sub="par reel/vidéo"
            icon={<Eye className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Avg likes"
            value={fmt(avgLikes)}
            sub="tous posts"
            icon={<Heart className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Avg ER"
            value={avgEr != null ? `${avgEr.toFixed(1)}%` : "—"}
            sub="(likes+comms)/vues"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
          />
        </div>

        {/* ── Filters & Sort ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          {/* Type filter */}
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
                  <span className="opacity-50">({cnt})</span>
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide mr-1">Trier</span>
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

        {/* ── Grid ─────────────────────────────────────────── */}
        {loadingPosts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                <div className="animate-pulse bg-zinc-800" style={{ aspectRatio: "9/16" }} />
                <div className="p-3 space-y-2">
                  <div className="h-2 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-2 bg-zinc-800/60 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Aucun post trouvé.</p>
            <p className="text-xs mt-1">Lance un "Scan Réels" pour récupérer les réels depuis Apify.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sorted.map((post) => (
              <ReelCard
                key={post.id}
                post={post}
                metaMap={metaMap}
                onOpenMeta={setActiveMetaPost}
              />
            ))}
          </div>
        )}
      </div>

      {/* Metadata panel */}
      {activeMetaPost && (
        <PostMetadataPanel
          post={activeMetaPost as PostForPanel}
          onClose={handleCloseMeta}
        />
      )}
    </div>
  );
}
