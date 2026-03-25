"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import type { FunnelAccount } from "@/app/api/performance/funnel/route";
import {
  RefreshCw, Loader2, AtSign, Users, Link2, ExternalLink, Heart, Eye,
  MessageCircle, ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown,
  Minus, AlertCircle, Clock, Play, BarChart2, Star,
} from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(num: number | null | undefined, den: number | null | undefined, decimals = 1): string {
  if (!num || !den) return "—";
  return `${((num / den) * 100).toFixed(decimals)}%`;
}

function rateColor(rate: number | null, thresholds: [number, number]): string {
  if (rate == null) return "text-muted-foreground";
  if (rate >= thresholds[0]) return "text-success";
  if (rate >= thresholds[1]) return "text-warning";
  return "text-danger";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "Just now";
}

/* ─── IgAvatar ─── */
function IgAvatar({ src, handle, size = 8 }: { src?: string | null; handle: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const px = size * 4;
  if (src && !failed) {
    return (
      <div style={{ width: px, height: px, minWidth: px }} className="rounded-full overflow-hidden shrink-0 border border-white/10">
        <img src={src} alt={handle} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div
      style={{ width: px, height: px, minWidth: px }}
      className="rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0"
    >
      <AtSign className="text-white" style={{ width: px * 0.44, height: px * 0.44 }} />
    </div>
  );
}

/* ─── KPI Summary Card ─── */
function KpiCard({ label, value, sub, icon: Icon, color = "accent" }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: "accent" | "success" | "warning" | "purple";
}) {
  const colorMap = {
    accent: "bg-accent/10 text-accent-light border-accent/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", colorMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Funnel Stage ─── */
function FunnelStage({
  label, value, rate, rateThresholds, icon: Icon, connected,
}: {
  label: string; value: string; rate?: string | null;
  rateThresholds?: [number, number]; icon: React.ElementType; connected?: boolean;
}) {
  const rateNum = rate ? parseFloat(rate) : null;
  const rc = rateThresholds ? rateColor(rateNum, rateThresholds) : "text-muted-foreground";

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {connected && (
        <div className="flex items-center shrink-0">
          <div className="h-px w-4 bg-border" />
          <ChevronDown className="w-3 h-3 text-muted-foreground/40 rotate-[-90deg]" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">{label}</p>
        </div>
        <p className="text-sm font-bold">{value}</p>
        {rate && (
          <p className={cn("text-[10px] font-medium", rc)}>{rate}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Rate Badge ─── */
function RateBadge({ value, thresholds }: { value: number | null; thresholds: [number, number] }) {
  if (value == null) return <span className="text-xs text-muted-foreground/50">—</span>;
  const pctStr = `${value.toFixed(1)}%`;
  const cls = rateColor(value, thresholds);
  return <span className={cn("text-xs font-semibold tabular-nums", cls)}>{pctStr}</span>;
}

/* ─── Account Detail Panel ─── */
function AccountDetail({ account }: { account: FunnelAccount }) {
  const ig = account.instagram;
  const gms = account.gms;
  const tr = account.tracking;

  // Compute rates
  const bioRate = ig.followers_count && gms?.total_clicks
    ? (gms.total_clicks / ig.followers_count) * 100 : null;
  const trackRate = gms?.total_clicks && tr?.clicks_count
    ? (tr.clicks_count / gms.total_clicks) * 100 : null;
  const subRate = tr?.clicks_count && tr?.subscribers_count
    ? (tr.subscribers_count / tr.clicks_count) * 100 : null;

  const totalEngagement = ig.avg_likes != null && ig.avg_comments != null
    ? ig.avg_likes + ig.avg_comments : null;
  const engRate = totalEngagement != null && ig.followers_count
    ? (totalEngagement / ig.followers_count) * 100 : null;

  return (
    <div className="bg-background/60 border-t border-border px-5 py-4 space-y-5">
      <div className="grid grid-cols-2 gap-6">

        {/* Instagram performance */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instagram Performance</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-lg p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg Likes</p>
              <p className="text-base font-bold flex items-center gap-1">
                <Heart className="w-3 h-3 text-pink-400" /> {fmt(ig.avg_likes)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg Views</p>
              <p className="text-base font-bold flex items-center gap-1">
                <Eye className="w-3 h-3 text-blue-400" /> {fmt(ig.avg_views)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg Comments</p>
              <p className="text-base font-bold flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-accent-light" /> {fmt(ig.avg_comments)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Engagement Rate</p>
              <p className={cn("text-base font-bold", rateColor(engRate, [3, 1.5]))}>
                {engRate != null ? `${engRate.toFixed(2)}%` : "—"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Reels in DB</p>
              <p className="text-base font-bold flex items-center gap-1">
                <Play className="w-3 h-3 text-accent-light" /> {ig.video_posts}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Last Synced</p>
              <p className="text-sm font-semibold flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" /> {formatRelative(ig.collected_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Funnel conversion rates */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funnel Conversion</p>
          <div className="space-y-2">

            {/* Bio CTR */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Followers → Bio clicks
                </p>
                <RateBadge value={bioRate} thresholds={[3, 1]} />
              </div>
              <p className="text-sm">
                <span className="font-bold">{fmt(gms?.total_clicks)}</span>
                <span className="text-muted-foreground text-xs"> / {fmt(ig.followers_count)} followers</span>
              </p>
              {gms?.tier1_pct != null && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Star className="w-3 h-3 text-warning" />
                  Tier 1 audience: <span className={cn("font-semibold ml-0.5", rateColor(gms.tier1_pct, [60, 40]))}>{gms.tier1_pct}%</span>
                </p>
              )}
              {gms?.error && (
                <p className="text-[10px] text-danger mt-1 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> {gms.error}
                </p>
              )}
            </div>

            {/* Track CTR */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Bio clicks → OF link
                </p>
                <RateBadge value={trackRate} thresholds={[30, 15]} />
              </div>
              <p className="text-sm">
                <span className="font-bold">{fmt(tr?.clicks_count)}</span>
                <span className="text-muted-foreground text-xs"> / {fmt(gms?.total_clicks)} bio clicks</span>
              </p>
              {tr?.error && (
                <p className="text-[10px] text-danger mt-1 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> {tr.error}
                </p>
              )}
            </div>

            {/* Sub conversion */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                  <Users className="w-3 h-3" /> OF link → Subscribers
                </p>
                <RateBadge value={subRate} thresholds={[5, 2]} />
              </div>
              <p className="text-sm">
                <span className="font-bold">{fmt(tr?.subscribers_count)}</span>
                <span className="text-muted-foreground text-xs"> / {fmt(tr?.clicks_count)} link clicks</span>
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Niche */}
      {account.niche && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Niche / Notes</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{account.niche}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function PerformancePage() {
  const [accounts, setAccounts] = useState<FunnelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFunnel = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await fetch("/api/performance/funnel");
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.instagram_handle.toLowerCase().includes(q) ||
      (a.niche?.toLowerCase().includes(q) ?? false) ||
      (a.model?.name?.toLowerCase().includes(q) ?? false)
    );
  });

  // Global KPIs
  const totalFollowers = accounts.reduce((s, a) => s + (a.instagram.followers_count ?? 0), 0);
  const totalGmsClicks = accounts.reduce((s, a) => s + (a.gms?.total_clicks ?? 0), 0);
  const totalTrackClicks = accounts.reduce((s, a) => s + (a.tracking?.clicks_count ?? 0), 0);
  const totalSubs = accounts.reduce((s, a) => s + (a.tracking?.subscribers_count ?? 0), 0);
  const syncedCount = accounts.filter((a) => a.instagram.collected_at != null).length;

  const globalBioCtr = totalFollowers > 0 && totalGmsClicks > 0
    ? (totalGmsClicks / totalFollowers) * 100 : null;
  const globalTrackCtr = totalGmsClicks > 0 && totalTrackClicks > 0
    ? (totalTrackClicks / totalGmsClicks) * 100 : null;
  const globalSubCtr = totalTrackClicks > 0 && totalSubs > 0
    ? (totalSubs / totalTrackClicks) * 100 : null;

  return (
    <ProtectedPage pageId="performance">
      <div className="flex flex-col h-full min-h-0">
        <Header
          title="Performance"
          subtitle={`${accounts.length} account${accounts.length !== 1 ? "s" : ""} · Full funnel analytics`}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by handle, niche, model…"
                className="w-full h-9 pl-9 pr-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {lastRefresh && (
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Updated {formatRelative(lastRefresh.toISOString())}
                </p>
              )}
              <button
                onClick={() => fetchFunnel(true)}
                disabled={refreshing || loading}
                className="h-9 px-4 bg-card border border-border hover:bg-card-hover disabled:opacity-50 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", refreshing && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Global KPIs ── */}
          {!loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Total Followers"
                value={fmt(totalFollowers)}
                sub={`${syncedCount}/${accounts.length} synced`}
                icon={Users}
                color="purple"
              />
              <KpiCard
                label="Bio Link Clicks"
                value={fmt(totalGmsClicks)}
                sub={globalBioCtr != null ? `${globalBioCtr.toFixed(2)}% of followers` : undefined}
                icon={Link2}
                color="accent"
              />
              <KpiCard
                label="Tracking Clicks"
                value={fmt(totalTrackClicks)}
                sub={globalTrackCtr != null ? `${globalTrackCtr.toFixed(1)}% bio → track` : undefined}
                icon={ExternalLink}
                color="warning"
              />
              <KpiCard
                label="Subscribers"
                value={fmt(totalSubs)}
                sub={globalSubCtr != null ? `${globalSubCtr.toFixed(1)}% link → sub` : undefined}
                icon={TrendingUp}
                color="success"
              />
            </div>
          )}

          {/* ── Funnel table ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Loading funnel data…</p>
                <p className="text-xs text-muted-foreground mt-1">Fetching GMS & OFAPI data in parallel</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <BarChart2 className="w-6 h-6 text-accent-light" />
              </div>
              <p className="text-sm font-medium">
                {search ? "No accounts match your search" : "No accounts yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add Instagram accounts and sync them to see funnel data"}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">

              {/* Table header */}
              <div className="grid grid-cols-[1fr_140px_140px_140px_140px_110px_32px] gap-x-2 px-5 py-2.5 border-b border-border bg-background/60 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Account</span>
                <span>IG Followers</span>
                <span>Bio Clicks</span>
                <span>Track Clicks</span>
                <span>Subscribers</span>
                <span>Model</span>
                <span />
              </div>

              {/* Rows */}
              <div className="divide-y divide-border">
                {filtered.map((account) => {
                  const ig = account.instagram;
                  const gms = account.gms;
                  const tr = account.tracking;
                  const isExpanded = expandedId === account.id;

                  const bioRate = ig.followers_count && gms?.total_clicks
                    ? (gms.total_clicks / ig.followers_count) * 100 : null;
                  const trackRate = gms?.total_clicks && tr?.clicks_count
                    ? (tr.clicks_count / gms.total_clicks) * 100 : null;
                  const subRate = tr?.clicks_count && tr?.subscribers_count
                    ? (tr.subscribers_count / tr.clicks_count) * 100 : null;

                  return (
                    <div key={account.id}>
                      {/* Main row */}
                      <div
                        className={cn(
                          "grid grid-cols-[1fr_140px_140px_140px_140px_110px_32px] gap-x-2 px-5 py-3.5 items-center cursor-pointer hover:bg-background/40 transition-colors",
                          isExpanded && "bg-accent/5"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : account.id)}
                      >
                        {/* Account */}
                        <div className="flex items-center gap-3 min-w-0">
                          <IgAvatar src={ig.profile_pic_url} handle={account.instagram_handle} size={8} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">@{account.instagram_handle}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                account.status === "active"
                                  ? "bg-success/10 text-success"
                                  : "bg-muted-foreground/10 text-muted-foreground"
                              )}>
                                {account.status}
                              </span>
                              {ig.collected_at && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> {formatRelative(ig.collected_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Followers */}
                        <div>
                          <p className="text-sm font-bold">{fmt(ig.followers_count)}</p>
                          {ig.total_posts_in_db > 0 && (
                            <p className="text-[10px] text-muted-foreground">{ig.total_posts_in_db} posts tracked</p>
                          )}
                        </div>

                        {/* Bio Clicks */}
                        <div>
                          {gms == null && !account.get_my_social_link_id ? (
                            <span className="text-xs text-muted-foreground/40">No GMS link</span>
                          ) : (
                            <>
                              <p className="text-sm font-bold">{fmt(gms?.total_clicks)}</p>
                              <RateBadge value={bioRate} thresholds={[3, 1]} />
                            </>
                          )}
                        </div>

                        {/* Tracking Clicks */}
                        <div>
                          {tr == null && !account.of_tracking_link_id ? (
                            <span className="text-xs text-muted-foreground/40">No tracking</span>
                          ) : (
                            <>
                              <p className="text-sm font-bold">{fmt(tr?.clicks_count)}</p>
                              <RateBadge value={trackRate} thresholds={[30, 15]} />
                            </>
                          )}
                        </div>

                        {/* Subscribers */}
                        <div>
                          {tr == null && !account.of_tracking_link_id ? (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          ) : (
                            <>
                              <p className="text-sm font-bold">{fmt(tr?.subscribers_count)}</p>
                              <RateBadge value={subRate} thresholds={[5, 2]} />
                            </>
                          )}
                        </div>

                        {/* Model */}
                        <div className="min-w-0">
                          {account.model ? (
                            <p className="text-xs truncate text-muted-foreground">{account.model.name}</p>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </div>

                        {/* Expand toggle */}
                        <div className="flex items-center justify-center">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-accent-light" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && <AccountDetail account={account} />}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-background/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{filtered.length} account{filtered.length !== 1 ? "s" : ""}</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success inline-block" /> Rate thresholds:
                  </span>
                  <span>Bio CTR: &gt;3% ✓</span>
                  <span>Track CTR: &gt;30% ✓</span>
                  <span>Sub rate: &gt;5% ✓</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Funnel visual legend ── */}
          {!loading && accounts.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">How the funnel works</p>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-foreground">Instagram followers</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 -rotate-90" />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Link2 className="w-4 h-4 text-accent-light" />
                  <span className="font-medium text-foreground">Bio link (GMS)</span>
                  <span className="text-[10px] bg-accent/10 text-accent-light px-1.5 py-0.5 rounded">CTR goal &gt;3%</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 -rotate-90" />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ExternalLink className="w-4 h-4 text-warning" />
                  <span className="font-medium text-foreground">OF tracking link</span>
                  <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded">CTR goal &gt;30%</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 -rotate-90" />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="font-medium text-foreground">Subscription</span>
                  <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded">Goal &gt;5%</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedPage>
  );
}
