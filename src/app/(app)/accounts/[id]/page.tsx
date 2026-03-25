"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Heart, MessageCircle, Eye, Play, RefreshCw,
  ExternalLink, TrendingUp, Users, Film, Image as ImageIcon,
  Layers, BarChart2, PenLine,
} from "lucide-react";
import { PostMetadataPanel, hasMetadata } from "@/components/post-metadata-panel";
import type { PostForPanel, PostMetadata } from "@/components/post-metadata-panel";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
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

type SortKey = "recent" | "views" | "likes" | "engagement" | "comments";
type TypeFilter = "all" | "Reel" | "Video" | "Image" | "Sidecar";

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
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function PostTypeIcon({ type }: { type: Post["post_type"] }) {
  const cls = "w-3 h-3";
  if (type === "Reel") return <Film className={cls} />;
  if (type === "Video") return <Play className={cls} />;
  if (type === "Sidecar") return <Layers className={cls} />;
  return <ImageIcon className={cls} />;
}

// ─────────────────────────────────────────────────────────────
// IgAvatar
// ─────────────────────────────────────────────────────────────
function IgAvatar({ url, handle, size = 80 }: { url: string | null; handle: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div
        style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9333ea,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, color: "#fff", fontWeight: 700, flexShrink: 0 }}
      >
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img src={url} alt={handle} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} />
  );
}

// ─────────────────────────────────────────────────────────────
// Post Card — click → metadata panel, not IG
// ─────────────────────────────────────────────────────────────
function PostCard({
  post,
  metaMap,
  onOpenMeta,
}: {
  post: Post;
  metaMap: Map<string, PostMetadata>;
  onOpenMeta: (post: Post) => void;
}) {
  const [hover, setHover] = useState(false);
  const snap = post.latest_snapshot;
  const views = snap?.views_count ?? snap?.plays_count;
  const er = engagementRate(post);
  const stale = post.last_seen_at
    ? Date.now() - new Date(post.last_seen_at).getTime() > 14 * 86400000
    : false;
  const inactive = !post.is_active || stale;
  const hasMeta = hasMetadata(metaMap.get(post.id) ?? null);

  return (
    <div
      className={`relative rounded-lg overflow-hidden bg-zinc-800 border transition-colors cursor-pointer ${
        inactive
          ? "border-zinc-800 opacity-40 grayscale"
          : hover
            ? "border-blue-500/60"
            : "border-zinc-700"
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpenMeta(post)}
      style={{ aspectRatio: "9/16" }}
    >
      {/* Thumbnail */}
      {post.thumbnail_url ? (
        <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
          <PostTypeIcon type={post.post_type} />
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 text-white text-[10px] font-medium">
        <PostTypeIcon type={post.post_type} />
        {post.post_type}
      </div>

      {/* Metadata indicator dot */}
      {hasMeta && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-zinc-900" title="Metadata remplie" />
      )}

      {/* Stale / inactive badge */}
      {inactive && (
        <div className="absolute top-2 right-2 bg-orange-600/80 rounded px-1.5 py-0.5 text-[9px] text-white font-medium">
          {!post.is_active ? "supprimé" : "stale"}
        </div>
      )}

      {/* Hover overlay with metrics + open IG link */}
      {hover && (
        <div className="absolute inset-0 bg-black/75 flex flex-col justify-end p-3 gap-1.5">
          {views != null && (
            <div className="flex items-center gap-1.5 text-white text-xs">
              <Eye className="w-3 h-3" />
              <span className="font-semibold">{fmt(views)}</span>
            </div>
          )}
          {snap?.likes_count != null && (
            <div className="flex items-center gap-1.5 text-white text-xs">
              <Heart className="w-3 h-3" />
              <span>{fmt(snap.likes_count)}</span>
            </div>
          )}
          {snap?.comments_count != null && (
            <div className="flex items-center gap-1.5 text-white text-xs">
              <MessageCircle className="w-3 h-3" />
              <span>{fmt(snap.comments_count)}</span>
            </div>
          )}
          {er != null && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <TrendingUp className="w-3 h-3" />
              <span>{er.toFixed(1)}% ER</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1 text-blue-400 text-[10px] font-medium">
              <PenLine className="w-3 h-3" />
              Analyser
            </div>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-zinc-400 hover:text-white text-[10px] flex items-center gap-0.5"
            >
              <ExternalLink className="w-3 h-3" /> IG
            </a>
          </div>
        </div>
      )}

      {/* Views bar at bottom (always visible) */}
      {!hover && views != null && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
          <div className="flex items-center gap-1 text-white text-xs">
            <Eye className="w-3 h-3 opacity-80" />
            <span className="font-semibold">{fmt(views)}</span>
          </div>
        </div>
      )}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Récent" },
  { key: "views", label: "Plus vus" },
  { key: "likes", label: "Plus aimés" },
  { key: "engagement", label: "Meilleur ER" },
  { key: "comments", label: "Plus commentés" },
];

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "Reel", label: "Réels" },
  { key: "Video", label: "Vidéos" },
  { key: "Image", label: "Photos" },
  { key: "Sidecar", label: "Carrousels" },
];

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [syncing, setSyncing] = useState(false);
  // Metadata panel
  const [activeMetaPost, setActiveMetaPost] = useState<Post | null>(null);
  // Map of post.id → PostMetadata (cached from panel opens)
  const [metaMap, setMetaMap] = useState<Map<string, PostMetadata>>(new Map());

  const handleOpenMeta = useCallback((post: Post) => {
    setActiveMetaPost(post);
  }, []);

  const handleCloseMeta = useCallback(() => {
    setActiveMetaPost(null);
    // Refresh metadata for the closed post (so indicator updates)
    if (activeMetaPost) {
      fetch(`/api/instagram/posts/${activeMetaPost.id}/metadata`)
        .then((r) => r.json())
        .then((d) => {
          if (d.metadata) {
            setMetaMap((prev) => new Map(prev).set(activeMetaPost.id, d.metadata));
          }
        })
        .catch(() => null);
    }
  }, [activeMetaPost]);

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

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/instagram/${id}/posts?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, [id]);

  useEffect(() => { loadAccount(); loadPosts(); }, [loadAccount, loadPosts]);

  // Sync via Apify
  const handleSync = async () => {
    setSyncing(true);
    try {
      const startRes = await fetch(`/api/instagram/${id}/collect`, { method: "POST" });
      if (!startRes.ok) { setSyncing(false); return; }
      const { runId } = await startRes.json();

      // Poll until done
      let attempts = 0;
      while (attempts < 40) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(`/api/instagram/${id}/collect?runId=${runId}`);
        if (statusRes.ok) {
          const s = await statusRes.json();
          if (s.status === "SUCCEEDED" || s.status === "FAILED") {
            loadAccount();
            loadPosts();
            break;
          }
        }
        attempts++;
      }
    } finally {
      setSyncing(false);
    }
  };

  // Filter and sort posts
  const filteredPosts = posts.filter((p) => {
    if (typeFilter === "all") return true;
    return p.post_type === typeFilter;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (sort) {
      case "views": {
        const av = (a.latest_snapshot?.views_count ?? a.latest_snapshot?.plays_count ?? 0);
        const bv = (b.latest_snapshot?.views_count ?? b.latest_snapshot?.plays_count ?? 0);
        return bv - av;
      }
      case "likes":
        return (b.latest_snapshot?.likes_count ?? 0) - (a.latest_snapshot?.likes_count ?? 0);
      case "comments":
        return (b.latest_snapshot?.comments_count ?? 0) - (a.latest_snapshot?.comments_count ?? 0);
      case "engagement": {
        const ae = engagementRate(a) ?? 0;
        const be = engagementRate(b) ?? 0;
        return be - ae;
      }
      default:
        return (b.posted_at ?? "").localeCompare(a.posted_at ?? "");
    }
  });

  // Aggregate stats
  const reelPosts = posts.filter((p) => p.post_type === "Reel" || p.post_type === "Video");
  const withViews = reelPosts.filter((p) => (p.latest_snapshot?.views_count ?? p.latest_snapshot?.plays_count) != null);
  const totalViews = withViews.reduce((s, p) => s + (p.latest_snapshot?.views_count ?? p.latest_snapshot?.plays_count ?? 0), 0);
  const avgViews = withViews.length > 0 ? Math.round(totalViews / withViews.length) : null;
  const avgLikes = posts.filter(p => p.latest_snapshot?.likes_count != null).length > 0
    ? Math.round(posts.reduce((s, p) => s + (p.latest_snapshot?.likes_count ?? 0), 0) / posts.filter(p => p.latest_snapshot?.likes_count != null).length)
    : null;
  const avgEr = posts.filter(p => engagementRate(p) != null).length > 0
    ? (posts.reduce((s, p) => s + (engagementRate(p) ?? 0), 0) / posts.filter(p => engagementRate(p) != null).length)
    : null;

  const snap = account?.latest_snapshot;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Back + Sync ───────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Comptes
          </button>
          <div className="flex items-center gap-2">
            <a
              href={`https://instagram.com/${account?.instagram_handle ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors border border-zinc-700 rounded-lg px-3 py-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Instagram
            </a>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync…" : "Sync"}
            </button>
          </div>
        </div>

        {loadingAcc ? (
          <div className="flex items-center gap-2 text-zinc-600 text-sm mb-6">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        ) : account ? (
          <>
            {/* ── Profile header ───────────────────────────────── */}
            <div className="flex items-start gap-6 mb-8">
              <IgAvatar url={snap?.profile_pic_url ?? null} handle={account.instagram_handle} size={80} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white">@{account.instagram_handle}</h1>
                  {account.model && (
                    <span className="text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-0.5">
                      {account.model.name}
                    </span>
                  )}
                  {account.niche && (
                    <span className="text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700/50 rounded-full px-2.5 py-0.5">
                      {account.niche}
                    </span>
                  )}
                </div>
                <div className="flex gap-6 mt-3">
                  <div>
                    <p className="text-lg font-bold text-white">{fmt(snap?.followers_count)}</p>
                    <p className="text-xs text-zinc-500">Followers</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{fmt(snap?.following_count)}</p>
                    <p className="text-xs text-zinc-500">Following</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{fmt(snap?.posts_count)}</p>
                    <p className="text-xs text-zinc-500">Posts</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{posts.length}</p>
                    <p className="text-xs text-zinc-500">En DB</p>
                  </div>
                </div>
                {snap?.collected_at && (
                  <p className="text-xs text-zinc-600 mt-2">
                    Dernière sync : {relativeTime(snap.collected_at)}
                  </p>
                )}
              </div>
            </div>

            {/* ── Aggregate stats ──────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard
                label="Total views"
                value={fmt(totalViews)}
                icon={<Eye className="w-4 h-4" />}
                sub={`${reelPosts.length} réels/vidéos`}
              />
              <StatCard
                label="Avg views"
                value={fmt(avgViews)}
                icon={<BarChart2 className="w-4 h-4" />}
                sub="par reel/vidéo"
              />
              <StatCard
                label="Avg likes"
                value={fmt(avgLikes)}
                icon={<Heart className="w-4 h-4" />}
                sub="tous posts"
              />
              <StatCard
                label="Avg ER"
                value={avgEr != null ? `${avgEr.toFixed(1)}%` : "—"}
                icon={<TrendingUp className="w-4 h-4" />}
                sub="(likes+comments)/views"
              />
            </div>
          </>
        ) : (
          <p className="text-zinc-500 text-sm mb-6">Compte introuvable.</p>
        )}

        {/* ── Posts grid ───────────────────────────────────────── */}
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            {/* Type filter */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-wrap">
              {TYPE_OPTIONS.map((opt) => {
                const cnt = opt.key === "all"
                  ? posts.length
                  : posts.filter((p) => p.post_type === opt.key).length;
                if (cnt === 0 && opt.key !== "all") return null;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setTypeFilter(opt.key)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                      typeFilter === opt.key
                        ? "bg-blue-600 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {opt.key === "Reel" && <Film className="w-3.5 h-3.5" />}
                    {opt.key === "Video" && <Play className="w-3.5 h-3.5" />}
                    {opt.key === "Image" && <ImageIcon className="w-3.5 h-3.5" />}
                    {opt.key === "Sidecar" && <Layers className="w-3.5 h-3.5" />}
                    {opt.label}
                    <span className="text-xs opacity-60">({cnt})</span>
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-zinc-600 mr-1">Trier :</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all border ${
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

          {/* Grid */}
          {loadingPosts ? (
            <div className="flex items-center gap-2 text-zinc-600 text-sm py-12 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Chargement des posts…
            </div>
          ) : sortedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Aucun post trouvé.</p>
              <p className="text-xs mt-1">Lance un sync pour récupérer les posts depuis Apify.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  metaMap={metaMap}
                  onOpenMeta={handleOpenMeta}
                />
              ))}
            </div>
          )}
        </div>

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
