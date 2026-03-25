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
  if (d > 365) return `${Math.floor(d / 365)}an`;
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
      {/* Thumbnail */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: "9/16" }}>
        {post.thumbnail_url ? (
          <img
            src={proxyImg(post.thumbnail_url)!}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800/80">
            <PostTypeIcon type={post.post_type} cls="w-10 h-10 text-zinc-700" />
          </div>
        )}

        {/* Type badge top-left */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-semibold">
          <PostTypeIcon type={post.post_type} />
          {post.post_type}
        </div>

        {/* Top-right indicators */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {hasMeta && (
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-900" title="Metadata remplie" />
          )}
          {inactive && (
            <span className="bg-orange-700/90 rounded-full px-1.5 py-0.5 text-[9px] text-white font-medium">
              {!post.is_active ? "supprimé" : "stale"}
            </span>
          )}
        </div>

        {/* Views always visible */}
        {views != null && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pt-8 pb-2.5">
            <span className="flex items-center gap-1 text-white text-sm font-bold">
              <Eye className="w-3.5 h-3.5 opacity-80" />
              {fmt(views)}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-2 text-white">
            <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <PenLine className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">Analyser</span>
          </div>
        </div>

        {/* IG link on hover */}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white"
          title="Voir sur Instagram"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Info section */}
      <div className="p-3.5 flex flex-col gap-2.5 flex-1 min-h-0">
        {/* Caption */}
        <p className={`text-xs leading-relaxed line-clamp-3 ${post.caption ? "text-zinc-400" : "text-zinc-700 italic"}`}>
          {post.caption ?? "Pas de description"}
        </p>

        {/* Metrics + date */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-600 mt-auto pt-1 border-t border-zinc-800">
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
// Options
// ─────────────────────────────────────────────────────────────
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "inception", label: "Tout" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Vues" },
  { key: "likes", label: "Likes" },
  { key: "engagement", label: "ER" },
  { key: "recent", label: "Récent" },
  { key: "comments", label: "Comms" },
];

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "Reel", label: "Réels" },
  { key: "Video", label: "Vidéos" },
  { key: "Image", label: "Photos" },
  { key: "Sidecar", label: "Carrousels" },
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
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [period, setPeriod] = useState<Period>("inception");
  const [sort, setSort] = useState<SortKey>("views");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [scanningReels, setScanningReels] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [activeMetaPost, setActiveMetaPost] = useState<Post | null>(null);
  const [metaMap, setMetaMap] = useState<Map<string, PostMetadata>>(new Map());

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

  const loadPosts = useCallback(async (p: Period) => {
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/instagram/${id}/posts?limit=500&period=${p}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } finally { setLoadingPosts(false); }
  }, [id]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { loadPosts(period); }, [loadPosts, period]);

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

  async function runApifyScan(mode: "profile" | "reels") {
    const res = await fetch(`/api/instagram/${id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) return null;
    const { runId } = await res.json();
    let attempts = 0;
    while (attempts < 40) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await fetch(`/api/instagram/${id}/collect?runId=${runId}`);
      if (s.ok) {
        const d = await s.json();
        if (d.status === "SUCCEEDED" || d.status === "FAILED") return d;
      }
      attempts++;
    }
    return null;
  }

  const handleSync = async () => {
    setSyncing(true);
    setScanResult(null);
    try {
      await runApifyScan("profile");
      loadAccount();
      loadPosts(period);
      setScanResult("Profil synchronisé ✓");
    } finally { setSyncing(false); }
  };

  const handleScanReels = async () => {
    setScanningReels(true);
    setScanResult(null);
    try {
      const r = await runApifyScan("reels");
      setScanResult(r ? `${r.postsSaved ?? 0} réels récupérés ✓` : "Scan terminé");
      loadPosts(period);
    } finally { setScanningReels(false); }
  };

  // ── Filtrage + tri ─────────────────────────────────────────
  const filtered = posts.filter((p) => typeFilter === "all" || p.post_type === typeFilter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a.views_delta ?? a.latest_snapshot?.views_count ?? a.latest_snapshot?.plays_count ?? 0;
    const bv = b.views_delta ?? b.latest_snapshot?.views_count ?? b.latest_snapshot?.plays_count ?? 0;
    switch (sort) {
      case "views": return bv - av;
      case "likes": return (b.latest_snapshot?.likes_count ?? 0) - (a.latest_snapshot?.likes_count ?? 0);
      case "comments": return (b.latest_snapshot?.comments_count ?? 0) - (a.latest_snapshot?.comments_count ?? 0);
      case "engagement": return (engagementRate(b) ?? 0) - (engagementRate(a) ?? 0);
      default: return (b.posted_at ?? "").localeCompare(a.posted_at ?? "");
    }
  });

  // ── Agrégats ──────────────────────────────────────────────
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

  const typeCounts = (["Reel", "Video", "Image", "Sidecar"] as const).map((t) => ({
    key: t, count: posts.filter((p) => p.post_type === t).length,
  }));

  const isBusy = syncing || scanningReels;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ── Sticky top bar ──────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour</span>
          </button>

          {/* Identity */}
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
                  {snap?.collected_at && <span className="ml-2 text-zinc-700">· sync {relativeTime(snap.collected_at)}</span>}
                </p>
              </div>
            </div>
          )}

          {/* Scan result */}
          {scanResult && (
            <span className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-2.5 py-1">
              {scanResult}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <a
              href={`https://instagram.com/${account?.instagram_handle ?? ""}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-2.5 py-1.5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instagram</span>
            </a>
            <button
              onClick={handleScanReels}
              disabled={isBusy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
            >
              <Film className={`w-3.5 h-3.5 ${scanningReels ? "animate-spin" : ""}`} />
              {scanningReels ? "Scan…" : "Scan Réels"}
            </button>
            <button
              onClick={handleSync}
              disabled={isBusy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync…" : "Sync profil"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6 max-w-screen-2xl mx-auto w-full">

        {/* ── Period + Stats ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-7">
          {/* Period pills */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === p.key
                    ? "bg-blue-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Stat pills */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-2">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-lg font-bold text-blue-300">{fmt(totalViews)}</span>
              <span className="text-[10px] text-blue-600 uppercase tracking-wide">vues</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
              <Eye className="w-3 h-3 text-zinc-500" />
              <span className="text-sm font-bold text-white">{fmt(avgViews)}</span>
              <span className="text-[10px] text-zinc-600">avg</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
              <Heart className="w-3 h-3 text-zinc-500" />
              <span className="text-sm font-bold text-white">{fmt(avgLikes)}</span>
              <span className="text-[10px] text-zinc-600">avg likes</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className="text-sm font-bold text-white">{avgEr != null ? `${avgEr.toFixed(1)}%` : "—"}</span>
              <span className="text-[10px] text-zinc-600">avg ER</span>
            </div>
            <div className="text-xs text-zinc-700">{posts.length} posts en DB</div>
          </div>
        </div>

        {/* ── Filters & Sort ─────────────────────────────────── */}
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
                  <span className="opacity-40">({cnt})</span>
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Trier par</span>
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
                  <div className="h-2 bg-zinc-800/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-700">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base font-medium text-zinc-500">Aucun post trouvé</p>
            <p className="text-sm mt-1">Lance &quot;Scan Réels&quot; pour récupérer les réels depuis Instagram</p>
            <button
              onClick={handleScanReels}
              disabled={isBusy}
              className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Film className="w-4 h-4" />
              Scan Réels maintenant
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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

      {/* ── Metadata panel ──────────────────────────────────── */}
      {activeMetaPost && (
        <PostMetadataPanel
          post={activeMetaPost as PostForPanel}
          onClose={handleCloseMeta}
        />
      )}
    </div>
  );
}
