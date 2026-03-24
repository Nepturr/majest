"use client";

import { Header } from "@/components/header";
import { StatsCard } from "@/components/stats-card";
import { ReelCard } from "@/components/reel-card";
import { ReelDetail } from "@/components/reel-detail";
import { mockStats, mockReels } from "@/lib/mock-data";
import { Film, TrendingUp, Zap, Users, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import type { ReelAnalysis } from "@/types";

export default function DashboardPage() {
  const [selectedReel, setSelectedReel] = useState<ReelAnalysis | null>(null);

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Overview of your performance"
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Reels analyzed"
            value={mockStats.total_reels_analyzed}
            change="+12 this week"
            changeType="up"
            icon={Film}
            delay={0}
          />
          <StatsCard
            label="Average score"
            value={`${mockStats.avg_score}/100`}
            change="+5 pts"
            changeType="up"
            icon={TrendingUp}
            delay={50}
          />
          <StatsCard
            label="Top hook type"
            value={mockStats.top_hook_type}
            icon={Zap}
            delay={100}
          />
          <StatsCard
            label="Tracked accounts"
            value={mockStats.total_accounts}
            change="+2 this month"
            changeType="up"
            icon={Users}
            delay={150}
          />
        </div>

        {/* Recent Reels */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Recent analyses</h3>
            <Link
              href="/instagram"
              className="text-sm text-accent hover:text-accent-light flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mockReels.map((reel, i) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                onClick={setSelectedReel}
                delay={i * 80}
              />
            ))}
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-gradient-to-r from-accent/5 to-accent-dark/5 border border-accent/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-2 text-accent-light">Quick Insights</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              <strong className="text-foreground">Question</strong> hooks have the best retention rate across your accounts.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              Reels between <strong className="text-foreground">8–15 seconds</strong> perform 34% better than longer ones.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              Adding a clear CTA increases conversion rate by <strong className="text-foreground">28%</strong>.
            </li>
          </ul>
        </div>
      </div>

      {selectedReel && (
        <ReelDetail reel={selectedReel} onClose={() => setSelectedReel(null)} />
      )}
    </>
  );
}
