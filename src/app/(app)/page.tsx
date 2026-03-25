"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import {
  Users, TrendingUp, Film, RefreshCw, Loader2, AtSign, BarChart2, Clock,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  total_accounts: number;
  active_accounts: number;
  total_posts: number;
  total_followers: number;
  synced_today: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function StatCard({
  label, value, sub, icon: Icon, delay = 0,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; delay?: number;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent-light" />
        </div>
      </div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <ProtectedPage pageId="dashboard">
      <Header title="Dashboard" subtitle="Overview of your workspace" />

      <div className="p-6 space-y-6">

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Instagram accounts"
              value={stats.total_accounts}
              sub={`${stats.active_accounts} active`}
              icon={AtSign}
              delay={0}
            />
            <StatCard
              label="Total followers"
              value={fmt(stats.total_followers)}
              sub="across synced accounts"
              icon={Users}
              delay={50}
            />
            <StatCard
              label="Posts tracked"
              value={fmt(stats.total_posts)}
              sub="reels + images collected"
              icon={Film}
              delay={100}
            />
            <StatCard
              label="Synced today"
              value={stats.synced_today}
              sub="fresh data points"
              icon={RefreshCw}
              delay={150}
            />
          </div>
        ) : null}

        {/* Quick nav */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/performance"
            className="group bg-gradient-to-br from-accent/5 to-accent-dark/10 border border-accent/20 hover:border-accent/40 rounded-xl p-5 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                <TrendingUp className="w-4.5 h-4.5 text-accent-light" />
              </div>
              <h3 className="text-sm font-semibold group-hover:text-accent-light transition-colors">
                Performance & Funnel
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full funnel analytics per Instagram account — followers → bio clicks → tracking → subscribers. Real data from GMS & OFAPI.
            </p>
          </Link>

          <Link
            href="/accounts"
            className="group bg-card border border-border hover:border-border-light rounded-xl p-5 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <BarChart2 className="w-4.5 h-4.5 text-accent-light" />
              </div>
              <h3 className="text-sm font-semibold group-hover:text-accent-light transition-colors">
                Instagram Accounts
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Manage accounts, trigger Apify syncs, and view per-account post grids with likes, views and engagement metrics.
            </p>
          </Link>
        </div>

        {/* Status */}
        {!loading && stats && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-light" />
              <h3 className="text-sm font-semibold">Workspace Status</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Accounts</p>
                <p className="font-semibold">{stats.active_accounts} active / {stats.total_accounts} total</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Data coverage</p>
                <p className="font-semibold">{stats.total_posts} posts with metrics</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Today's syncs</p>
                <p className={stats.synced_today > 0 ? "font-semibold text-success" : "font-semibold text-muted-foreground"}>
                  {stats.synced_today} snapshots collected
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Reach</p>
                <p className="font-semibold">{fmt(stats.total_followers)} followers tracked</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state if no accounts */}
        {!loading && stats?.total_accounts === 0 && (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <AtSign className="w-6 h-6 text-accent-light" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No accounts yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add Instagram accounts to start tracking funnel performance.
            </p>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-2 h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Users className="w-4 h-4" />
              Add accounts
            </Link>
          </div>
        )}

      </div>
    </ProtectedPage>
  );
}
