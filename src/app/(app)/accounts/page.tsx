"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import type {
  InstagramAccount,
  InstagramAccountSnapshot,
  InstagramPost,
  Model,
  Account,
  OneUpSocialAccount,
  GMSLink,
  OFTrackingLink,
} from "@/types";
import {
  Plus, Search, AtSign, Trash2, Pencil, X, ChevronDown, Loader2, Check,
  AlertCircle, Link2, ExternalLink, RefreshCw, Heart, MessageCircle, Eye,
  Play, Layers, Image as ImageIcon, BarChart2, Users, Clock, CheckCircle2,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatFollowers(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}

type SyncStatus = "syncing" | "done" | "error";

/* ─── SVG Sparkline ─── */
function Sparkline({
  values,
  width = 80,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const uw = width - pad * 2;
  const uh = height - pad * 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * uw;
      const y = pad + uh - ((v - min) / range) * uh;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const isUp = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "var(--color-success, #22c55e)" : "var(--color-danger, #ef4444)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
      status === "active"
        ? "bg-success/10 text-success border border-success/20"
        : "bg-muted-foreground/10 text-muted-foreground border border-border"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "active" ? "bg-success" : "bg-muted-foreground")} />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

/* ─── Avatar ─── */
function Avatar({ src, fallback, size = 7 }: { src?: string | null; fallback: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full border border-border bg-accent/10 flex items-center justify-center overflow-hidden shrink-0`;
  return (
    <div className={cls}>
      {src ? (
        <img src={src} alt={fallback} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <span className="text-[10px] font-bold text-accent-light">{fallback[0]?.toUpperCase()}</span>
      )}
    </div>
  );
}

/* ─── Instagram PFP (gradient fallback) ─── */
function IgAvatar({ src, handle, size = 9 }: { src?: string | null; handle: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const px = size * 4;
  const style = { width: px, height: px, minWidth: px };
  if (src && !failed) {
    return (
      <div style={style} className="rounded-full border border-white/10 overflow-hidden shrink-0">
        <img
          src={src}
          alt={handle}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      style={style}
      className="rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0"
    >
      <AtSign className="text-white" style={{ width: px * 0.44, height: px * 0.44 }} />
    </div>
  );
}

/* ─── Post Card (in drawer) ─── */
function PostCard({ post }: { post: InstagramPost }) {
  const snap = post.latest_snapshot;
  const isVideo = post.post_type === "Video";
  const isSidecar = post.post_type === "Sidecar";
  const href = post.url ?? `https://www.instagram.com/p/${post.shortcode}/`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square rounded-xl overflow-hidden bg-background border border-border hover:border-accent/40 transition-all"
    >
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt={post.caption?.slice(0, 40) ?? "Post"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-accent/5">
          {isVideo ? <Play className="w-7 h-7 text-muted-foreground" /> : <ImageIcon className="w-7 h-7 text-muted-foreground" />}
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-1.5 left-1.5">
        {isVideo && (
          <span className="bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <Play className="w-2 h-2 fill-current" /> Reel
          </span>
        )}
        {isSidecar && (
          <span className="bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <Layers className="w-2 h-2" />
          </span>
        )}
      </div>

      {/* Metrics on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
        <div className="flex items-center gap-2 text-white text-[10px] font-semibold">
          <span className="flex items-center gap-0.5">
            <Heart className="w-2.5 h-2.5 fill-current" /> {formatNumber(snap?.likes_count)}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageCircle className="w-2.5 h-2.5" /> {formatNumber(snap?.comments_count)}
          </span>
          {isVideo && snap?.views_count != null && (
            <span className="flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" /> {formatNumber(snap.views_count)}
            </span>
          )}
        </div>
      </div>

      {/* Metrics always visible at bottom (if no thumbnail hover possible) */}
      {!post.thumbnail_url && snap && (
        <div className="absolute bottom-0 inset-x-0 bg-card/90 border-t border-border px-2 py-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" /> {formatNumber(snap.likes_count)}</span>
          <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {formatNumber(snap.comments_count)}</span>
        </div>
      )}
    </a>
  );
}

/* ─── Account Drawer ─── */
interface DrawerProps {
  account: InstagramAccount;
  snapshots: InstagramAccountSnapshot[];
  posts: InstagramPost[];
  loading: boolean;
  syncStatus: SyncStatus | undefined;
  onClose: () => void;
  onSync: () => void;
  onEdit: () => void;
}

function AccountDrawer({ account, snapshots, posts, loading, syncStatus, onClose, onSync, onEdit }: DrawerProps) {
  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;
  const followerValues = [...snapshots].reverse().map((s) => s.followers_count ?? 0).filter((v) => v > 0);

  const followerDelta =
    latest?.followers_count != null && previous?.followers_count != null
      ? latest.followers_count - previous.followers_count
      : null;

  const syncing = syncStatus === "syncing";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[460px] bg-card border-l border-border z-50 flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <IgAvatar src={latest?.profile_pic_url} handle={account.instagram_handle} size={8} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">@{account.instagram_handle}</p>
              {account.niche && <p className="text-[11px] text-muted-foreground truncate">{account.niche}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onSync}
              disabled={syncing}
              title="Sync data from Instagram"
              className="h-8 w-8 rounded-lg border border-border hover:bg-accent/10 hover:border-accent/30 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", syncing && "animate-spin")} />
            </button>
            <button
              onClick={onEdit}
              title="Edit account"
              className="h-8 w-8 rounded-lg border border-border hover:bg-accent/10 hover:border-accent/30 flex items-center justify-center transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted-foreground/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading analytics…</p>
            </div>
          ) : syncing && !latest ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-accent-light" />
              <p className="text-sm font-medium">Syncing Instagram data…</p>
              <p className="text-xs text-muted-foreground">This usually takes 30–90 seconds</p>
            </div>
          ) : !latest ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <BarChart2 className="w-6 h-6 text-accent-light" />
              </div>
              <p className="text-sm font-medium">No data yet</p>
              <p className="text-xs text-muted-foreground">Click "Sync" to fetch profile & post metrics from Instagram via Apify.</p>
              <button
                onClick={onSync}
                className="mt-2 h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync now
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">

              {/* ── Stats block ── */}
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Stats</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatRelativeTime(latest.collected_at)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Followers */}
                  <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Followers</p>
                    <p className="text-xl font-bold">{formatFollowers(latest.followers_count)}</p>
                    {followerDelta != null && (
                      <p className={cn(
                        "text-[11px] font-medium flex items-center gap-0.5",
                        followerDelta > 0 ? "text-success" : followerDelta < 0 ? "text-danger" : "text-muted-foreground"
                      )}>
                        {followerDelta > 0 ? <TrendingUp className="w-3 h-3" /> : followerDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {followerDelta > 0 ? "+" : ""}{formatFollowers(followerDelta)}
                      </p>
                    )}
                  </div>

                  {/* Following */}
                  <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Following</p>
                    <p className="text-xl font-bold">{formatFollowers(latest.following_count)}</p>
                    <p className="text-[11px] text-muted-foreground">accounts</p>
                  </div>

                  {/* Posts */}
                  <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Posts</p>
                    <p className="text-xl font-bold">{formatFollowers(latest.posts_count)}</p>
                    <p className="text-[11px] text-muted-foreground">total</p>
                  </div>
                </div>

                {/* Sparkline (if multiple snapshots) */}
                {followerValues.length >= 2 && (
                  <div className="bg-background border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Followers trend</p>
                      <p className="text-[10px] text-muted-foreground">{snapshots.length} data point{snapshots.length !== 1 ? "s" : ""}</p>
                    </div>
                    <Sparkline values={followerValues} width={380} height={40} />
                  </div>
                )}
              </div>

              {/* ── Bio ── */}
              {(latest.profile_pic_url || account.niche) && (
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <IgAvatar src={latest.profile_pic_url} handle={account.instagram_handle} size={14} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">@{account.instagram_handle}</p>
                      {latest.profile_pic_url && (
                        <a
                          href={`https://www.instagram.com/${account.instagram_handle}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent-light hover:underline flex items-center gap-1"
                        >
                          View on Instagram <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {account.niche && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{account.niche}</p>
                  )}
                </div>
              )}

              {/* ── Funnel connections ── */}
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Funnel</p>
                <div className="space-y-2 text-xs">
                  {account.get_my_social_link_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Link2 className="w-3.5 h-3.5 text-accent-light shrink-0" />
                      <span className="truncate">{account.get_my_social_link_name}</span>
                      <span className="text-muted-foreground/40">GMS bio link</span>
                    </div>
                  )}
                  {account.of_tracking_link_url && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ExternalLink className="w-3.5 h-3.5 text-accent-light shrink-0" />
                      <a href={account.of_tracking_link_url} target="_blank" rel="noopener noreferrer" className="truncate text-accent-light hover:underline">
                        {account.of_tracking_link_url}
                      </a>
                    </div>
                  )}
                  {!account.get_my_social_link_name && !account.of_tracking_link_url && (
                    <p className="text-muted-foreground/60 italic">No funnel links connected</p>
                  )}
                </div>
              </div>

              {/* ── Posts grid ── */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Posts</p>
                  <p className="text-[11px] text-muted-foreground">{posts.length} collected</p>
                </div>

                {posts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No posts collected yet. Sync the account to fetch posts.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Searchable Select ─── */
interface SearchableSelectProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  value: T | null;
  onSelect: (item: T | null) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | null;
  isDisabled?: (item: T) => boolean;
  disabledReason?: string;
  loading?: boolean;
  error?: string | null;
  badge?: (item: T) => React.ReactNode;
}

function SearchableSelect<T>({
  label, placeholder, items, value, onSelect, getKey, getLabel, getSubLabel,
  isDisabled, loading, error, badge,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    return (
      getLabel(item).toLowerCase().includes(q) ||
      (getSubLabel?.(item)?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-left flex items-center justify-between gap-2 hover:border-accent/50 transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? getLabel(value) : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-xs text-danger px-3 py-4">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No results</p>
            ) : (
              filtered.map((item) => {
                const disabled = isDisabled?.(item) ?? false;
                const isSelected = value ? getKey(value) === getKey(item) : false;
                return (
                  <button
                    key={getKey(item)}
                    type="button"
                    disabled={disabled}
                    onClick={() => { if (!disabled) { onSelect(item); setOpen(false); setQuery(""); } }}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors",
                      disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent/10 cursor-pointer",
                      isSelected && "bg-accent/15"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{getLabel(item)}</p>
                      {getSubLabel && <p className="text-xs text-muted-foreground truncate">{getSubLabel(item)}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {badge?.(item)}
                      {disabled && <span className="text-[10px] text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">In use</span>}
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent-light" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Add / Edit Account Modal ─── */
interface AccountModalProps {
  account?: InstagramAccount | null;
  onClose: () => void;
  onSuccess: (newAccountId?: string) => void;
}

function AccountModal({ account, onClose, onSuccess }: AccountModalProps) {
  const isEdit = !!account;

  const [niche, setNiche] = useState(account?.niche ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(account?.status ?? "active");

  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedOneUp, setSelectedOneUp] = useState<OneUpSocialAccount | null>(null);
  const [selectedGMS, setSelectedGMS] = useState<GMSLink | null>(null);
  const [selectedOFAccount, setSelectedOFAccount] = useState<Account | null>(null);
  const [selectedTracking, setSelectedTracking] = useState<OFTrackingLink | null>(null);

  const [models, setModels] = useState<Model[]>([]);
  const [oneupAccounts, setOneupAccounts] = useState<OneUpSocialAccount[]>([]);
  const [gmsLinks, setGmsLinks] = useState<GMSLink[]>([]);
  const [ofAccounts, setOfAccounts] = useState<Account[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<OFTrackingLink[]>([]);

  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingOneup, setLoadingOneup] = useState(true);
  const [loadingGMS, setLoadingGMS] = useState(true);
  const [loadingOFAccounts, setLoadingOFAccounts] = useState(false);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [errorOneup, setErrorOneup] = useState<string | null>(null);
  const [errorGMS, setErrorGMS] = useState<string | null>(null);
  const [errorTracking, setErrorTracking] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/models").then((r) => r.json()),
      fetch("/api/admin/oneup/social-accounts").then((r) => r.json()),
      fetch("/api/admin/gms/links").then((r) => r.json()),
    ]).then(([modelsData, oneupData, gmsData]) => {
      setModels(modelsData.models ?? []);
      setLoadingModels(false);
      if (oneupData.error) setErrorOneup(oneupData.error);
      else setOneupAccounts(oneupData.accounts ?? []);
      setLoadingOneup(false);
      if (gmsData.error) setErrorGMS(gmsData.error);
      else setGmsLinks(gmsData.links ?? []);
      setLoadingGMS(false);
    });
  }, []);

  useEffect(() => {
    if (!account || models.length === 0) return;
    const m = models.find((m) => m.id === account.model_id) ?? null;
    setSelectedModel(m);
    if (account.oneup_social_network_id) {
      const ou = oneupAccounts.find((a) => a.social_network_id === account.oneup_social_network_id) ?? null;
      if (!ou) {
        setSelectedOneUp({
          social_network_id: account.oneup_social_network_id,
          social_network_name: account.oneup_social_network_name ?? account.oneup_social_network_id,
          category_id: account.oneup_category_id ?? "",
          category_name: "",
          is_expired: false,
          isAssigned: true,
        });
      } else setSelectedOneUp(ou);
    }
    if (account.get_my_social_link_id) {
      const g = gmsLinks.find((l) => l.id === account.get_my_social_link_id) ?? null;
      if (!g) {
        setSelectedGMS({ id: account.get_my_social_link_id, title: account.get_my_social_link_name ?? account.get_my_social_link_id, url: null, isAssigned: true });
      } else setSelectedGMS(g);
    }
  }, [account, models, oneupAccounts, gmsLinks]);

  useEffect(() => {
    if (!selectedModel) { setOfAccounts([]); setSelectedOFAccount(null); return; }
    setLoadingOFAccounts(true);
    fetch(`/api/admin/accounts?model_id=${selectedModel.id}`)
      .then((r) => r.json())
      .then((d) => {
        setOfAccounts(d.accounts ?? []);
        if (account?.of_account_id) {
          const oa = (d.accounts ?? []).find((a: Account) => a.id === account.of_account_id) ?? null;
          setSelectedOFAccount(oa);
        }
        setLoadingOFAccounts(false);
      });
  }, [selectedModel, account?.of_account_id]);

  useEffect(() => {
    if (!selectedOFAccount?.ofapi_account_id) { setTrackingLinks([]); setSelectedTracking(null); return; }
    setLoadingTracking(true);
    setErrorTracking(null);
    fetch(`/api/admin/ofapi/tracking-links?account_id=${selectedOFAccount.ofapi_account_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErrorTracking(d.error); setLoadingTracking(false); return; }
        setTrackingLinks(d.links ?? []);
        if (account?.of_tracking_link_id) {
          const t = (d.links ?? []).find((l: OFTrackingLink) => l.id === account.of_tracking_link_id) ?? null;
          if (!t && account.of_tracking_link_id) {
            setSelectedTracking({ id: account.of_tracking_link_id, name: account.of_tracking_link_url ?? account.of_tracking_link_id, url: account.of_tracking_link_url, isAssigned: true });
          } else setSelectedTracking(t);
        }
        setLoadingTracking(false);
      });
  }, [selectedOFAccount, account?.of_tracking_link_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOneUp) { setFormError("Please select an Instagram account from OneUp."); return; }
    if (!selectedModel) { setFormError("Please select a model."); return; }

    const derivedHandle = selectedOneUp.social_network_name.replace(/^@/, "");
    setSaving(true);

    const payload = {
      model_id: selectedModel.id,
      of_account_id: selectedOFAccount?.id ?? null,
      instagram_handle: derivedHandle,
      oneup_social_network_id: selectedOneUp?.social_network_id ?? null,
      oneup_social_network_name: selectedOneUp?.social_network_name ?? null,
      oneup_category_id: selectedOneUp?.category_id ?? null,
      get_my_social_link_id: selectedGMS?.id ?? null,
      get_my_social_link_name: selectedGMS?.title ?? null,
      of_tracking_link_id: selectedTracking?.id ?? null,
      of_tracking_link_url: selectedTracking?.url ?? null,
      niche: niche.trim() || null,
      status,
    };

    const url = isEdit ? `/api/admin/instagram-accounts/${account!.id}` : "/api/admin/instagram-accounts";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setFormError(data.error ?? "Something went wrong."); return; }

    // On create: pass the new account ID so the parent can auto-sync
    onSuccess(isEdit ? undefined : data.account?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">{isEdit ? "Edit Account" : "Add Instagram Account"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Connect an Instagram account to your funnel</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted-foreground/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Instagram Account</p>
              <p className="text-xs text-muted-foreground mb-3">Select an account from OneUp — only unlinked accounts are shown.</p>
              <SearchableSelect<OneUpSocialAccount>
                label="Instagram account *"
                placeholder="Pick an account from OneUp…"
                items={oneupAccounts}
                value={selectedOneUp}
                onSelect={setSelectedOneUp}
                getKey={(a) => a.social_network_id}
                getLabel={(a) => `@${a.social_network_name}`}
                getSubLabel={(a) => a.category_name || null}
                isDisabled={(a) => a.isAssigned && a.social_network_id !== account?.oneup_social_network_id}
                loading={loadingOneup}
                error={errorOneup}
              />
              {selectedOneUp && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Handle: <span className="font-mono text-foreground">@{selectedOneUp.social_network_name}</span>
                  {selectedOneUp.category_name && <>{" · "}<span className="text-foreground">{selectedOneUp.category_name}</span></>}
                </p>
              )}
            </div>

            <hr className="border-border" />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niche / Description</label>
              <textarea
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Fitness lifestyle, 18-35 women, English-speaking audience. Posts 5x/week."
                rows={3}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all placeholder:text-muted-foreground"
              />
            </div>

            <hr className="border-border" />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Model</p>
              <SearchableSelect<Model>
                label="Associated model *"
                placeholder="Pick a model…"
                items={models}
                value={selectedModel}
                onSelect={setSelectedModel}
                getKey={(m) => m.id}
                getLabel={(m) => m.name}
                getSubLabel={(m) => m.status === "inactive" ? "Inactive" : null}
                loading={loadingModels}
              />
            </div>

            <hr className="border-border" />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GetMySocial Link (Bio)</p>
              <SearchableSelect<GMSLink>
                label="Bio link"
                placeholder="Pick a GMS link…"
                items={gmsLinks}
                value={selectedGMS}
                onSelect={setSelectedGMS}
                getKey={(l) => l.id}
                getLabel={(l) => l.title}
                getSubLabel={(l) => l.url}
                isDisabled={(l) => l.isAssigned && l.id !== account?.get_my_social_link_id}
                loading={loadingGMS}
                error={errorGMS}
              />
            </div>

            <hr className="border-border" />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">OnlyFans (Conversion)</p>
              {!selectedModel ? (
                <p className="text-xs text-muted-foreground italic py-2">Select a model first to see linked OF accounts.</p>
              ) : (
                <div className="space-y-4">
                  <SearchableSelect<Account>
                    label="OF account"
                    placeholder="Pick an OF account…"
                    items={ofAccounts}
                    value={selectedOFAccount}
                    onSelect={(a) => { setSelectedOFAccount(a); setSelectedTracking(null); }}
                    getKey={(a) => a.id}
                    getLabel={(a) => a.of_username ?? a.ofapi_account_id ?? a.id}
                    loading={loadingOFAccounts}
                  />
                  {selectedOFAccount && (
                    <SearchableSelect<OFTrackingLink>
                      label="Tracking link"
                      placeholder="Pick a tracking link…"
                      items={trackingLinks}
                      value={selectedTracking}
                      onSelect={setSelectedTracking}
                      getKey={(l) => l.id}
                      getLabel={(l) => l.name}
                      getSubLabel={(l) => l.url}
                      isDisabled={(l) => l.isAssigned && l.id !== account?.of_tracking_link_id}
                      loading={loadingTracking}
                      error={errorTracking}
                    />
                  )}
                </div>
              )}
            </div>

            <hr className="border-border" />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <div className="flex gap-2">
                {(["active", "inactive"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "h-9 px-4 rounded-lg text-sm font-medium border transition-colors capitalize",
                      status === s
                        ? "bg-accent text-white border-accent"
                        : "bg-background border-border text-muted-foreground hover:border-accent/50"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 px-3 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card shrink-0">
            {!isEdit && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" />
                Instagram data will sync automatically after adding.
              </p>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button type="button" onClick={onClose} className="h-9 px-4 bg-background border border-border rounded-lg text-sm hover:bg-card-hover transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-5 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEdit ? "Save Changes" : "Add Account"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<InstagramAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync state per account
  const [syncState, setSyncState] = useState<Record<string, SyncStatus>>({});

  // Drawer state
  const [drawerAccount, setDrawerAccount] = useState<InstagramAccount | null>(null);
  const [drawerSnapshots, setDrawerSnapshots] = useState<InstagramAccountSnapshot[]>([]);
  const [drawerPosts, setDrawerPosts] = useState<InstagramPost[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/instagram-accounts");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  /* ── Sync logic ── */
  const startSync = useCallback(async (accountId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSyncState((prev) => ({ ...prev, [accountId]: "syncing" }));

    try {
      const res = await fetch(`/api/instagram/${accountId}/collect`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setSyncState((prev) => ({ ...prev, [accountId]: "error" }));
        return;
      }

      const { runId } = data;

      const poll = async (): Promise<void> => {
        try {
          const pollRes = await fetch(`/api/instagram/${accountId}/collect?runId=${runId}`);
          const pollData = await pollRes.json();

          if (["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(pollData.status)) {
            const success = pollData.status === "SUCCEEDED";
            setSyncState((prev) => ({ ...prev, [accountId]: success ? "done" : "error" }));
            fetchAccounts();
            if (success) setTimeout(() => setSyncState((prev) => { const n = { ...prev }; delete n[accountId]; return n; }), 4000);
          } else {
            setTimeout(poll, 6000);
          }
        } catch {
          setSyncState((prev) => ({ ...prev, [accountId]: "error" }));
        }
      };

      setTimeout(poll, 8000); // Apify runs usually start in ~5-10s
    } catch {
      setSyncState((prev) => ({ ...prev, [accountId]: "error" }));
    }
  }, [fetchAccounts]);

  /* ── Drawer ── */
  const openDrawer = useCallback(async (account: InstagramAccount) => {
    setDrawerAccount(account);
    setDrawerLoading(true);
    setDrawerSnapshots([]);
    setDrawerPosts([]);

    const [snapshotsRes, postsRes] = await Promise.all([
      fetch(`/api/instagram/${account.id}/snapshots?limit=60`).then((r) => r.json()),
      fetch(`/api/instagram/${account.id}/posts?limit=30`).then((r) => r.json()),
    ]);

    setDrawerSnapshots(snapshotsRes.snapshots ?? []);
    setDrawerPosts(postsRes.posts ?? []);
    setDrawerLoading(false);
  }, []);

  // Re-fetch drawer data when sync of the open account completes
  useEffect(() => {
    if (drawerAccount && syncState[drawerAccount.id] === "done") {
      openDrawer(drawerAccount);
    }
  }, [syncState, drawerAccount, openDrawer]);

  /* ── Handlers ── */
  const handleModalSuccess = useCallback((newAccountId?: string) => {
    fetchAccounts();
    if (newAccountId) startSync(newAccountId);
  }, [fetchAccounts, startSync]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this account and all its analytics data?")) return;
    setDeletingId(id);
    if (drawerAccount?.id === id) setDrawerAccount(null);
    await fetch(`/api/admin/instagram-accounts/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchAccounts();
  };

  const handleEdit = (account: InstagramAccount, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDrawerAccount(null);
    setEditAccount(account);
    setShowModal(true);
  };

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.instagram_handle.toLowerCase().includes(q) ||
      (a.niche?.toLowerCase().includes(q) ?? false) ||
      ((a.model as { name: string } | undefined)?.name?.toLowerCase().includes(q) ?? false)
    );
  });

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const syncedCount = accounts.filter((a) => a.latest_snapshot != null).length;

  return (
    <ProtectedPage pageId="accounts">
      <div className="flex flex-col h-full min-h-0">
        <Header
          title="Accounts"
          subtitle={`${accounts.length} Instagram account${accounts.length !== 1 ? "s" : ""} · ${activeCount} active · ${syncedCount} synced`}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Top bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by handle, niche, model…"
                className="w-full h-9 pl-9 pr-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
            </div>
            <button
              onClick={() => { setEditAccount(null); setShowModal(true); }}
              className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <AtSign className="w-6 h-6 text-accent-light" />
              </div>
              <p className="text-sm font-medium">
                {search ? "No accounts match your search" : "No accounts yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add your first Instagram account to get started"}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">OF Account</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funnel</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Sync</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((account) => {
                    const model = account.model as { name: string; avatar_url: string | null } | undefined;
                    const ofAccount = account.of_account as { of_username: string | null; of_avatar_url: string | null } | undefined;
                    const snap = account.latest_snapshot;
                    const sync = syncState[account.id];
                    const isDrawerOpen = drawerAccount?.id === account.id;

                    return (
                      <tr
                        key={account.id}
                        onClick={() => openDrawer(account)}
                        className={cn(
                          "hover:bg-background/40 transition-colors cursor-pointer",
                          isDrawerOpen && "bg-accent/5 border-l-2 border-accent-light"
                        )}
                      >
                        {/* Account */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <IgAvatar src={snap?.profile_pic_url} handle={account.instagram_handle} size={9} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">@{account.instagram_handle}</p>
                              {snap?.followers_count != null ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {formatFollowers(snap.followers_count)} followers
                                </p>
                              ) : sync === "syncing" ? (
                                <p className="text-xs text-accent-light flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Syncing…
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">{account.niche?.slice(0, 30) || "—"}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Model */}
                        <td className="px-5 py-3.5">
                          {model ? (
                            <div className="flex items-center gap-2">
                              <Avatar src={model.avatar_url} fallback={model.name} size={7} />
                              <span className="text-sm">{model.name}</span>
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>

                        {/* OF Account */}
                        <td className="px-5 py-3.5">
                          {ofAccount?.of_username ? (
                            <div className="flex items-center gap-2">
                              <Avatar src={ofAccount.of_avatar_url} fallback={ofAccount.of_username} size={7} />
                              <span className="text-sm">@{ofAccount.of_username}</span>
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>

                        {/* Funnel */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center",
                              account.get_my_social_link_id ? "bg-accent/10 text-accent-light" : "bg-border/50 text-muted-foreground/30"
                            )} title={account.get_my_social_link_id ? `GMS: ${account.get_my_social_link_name}` : "No GMS link"}>
                              <Link2 className="w-3.5 h-3.5" />
                            </span>
                            <span className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center",
                              account.of_tracking_link_id ? "bg-accent/10 text-accent-light" : "bg-border/50 text-muted-foreground/30"
                            )} title={account.of_tracking_link_id ? `Tracking: ${account.of_tracking_link_url}` : "No tracking link"}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <StatusBadge status={account.status} />
                        </td>

                        {/* Last Sync */}
                        <td className="px-5 py-3.5">
                          {sync === "syncing" ? (
                            <span className="text-xs text-accent-light flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Running…
                            </span>
                          ) : sync === "done" ? (
                            <span className="text-xs text-success flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          ) : sync === "error" ? (
                            <span className="text-xs text-danger flex items-center gap-1.5">
                              <AlertCircle className="w-3 h-3" /> Failed
                            </span>
                          ) : snap ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatRelativeTime(snap.collected_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">Never synced</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={(e) => startSync(account.id, e)}
                              disabled={sync === "syncing"}
                              title="Sync from Instagram"
                              className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent-light transition-colors disabled:opacity-40"
                            >
                              <RefreshCw className={cn("w-3.5 h-3.5", sync === "syncing" && "animate-spin")} />
                            </button>
                            <button
                              onClick={(e) => handleEdit(account, e)}
                              className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent-light transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(account.id, e)}
                              disabled={deletingId === account.id}
                              className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors disabled:opacity-40"
                              title="Delete"
                            >
                              {deletingId === account.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Account Detail Drawer */}
        {drawerAccount && (
          <AccountDrawer
            account={drawerAccount}
            snapshots={drawerSnapshots}
            posts={drawerPosts}
            loading={drawerLoading}
            syncStatus={syncState[drawerAccount.id]}
            onClose={() => setDrawerAccount(null)}
            onSync={() => startSync(drawerAccount.id)}
            onEdit={() => handleEdit(drawerAccount)}
          />
        )}

        {/* Add / Edit Modal */}
        {(showModal || editAccount) && (
          <AccountModal
            account={editAccount}
            onClose={() => { setShowModal(false); setEditAccount(null); }}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
