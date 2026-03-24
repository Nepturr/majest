"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { ReelCard } from "@/components/reel-card";
import { ReelDetail } from "@/components/reel-detail";
import { AddReelModal } from "@/components/add-reel-modal";
import { mockReels } from "@/lib/mock-data";
import { Filter, SlidersHorizontal } from "lucide-react";
import type { ReelAnalysis } from "@/types";

export default function InstagramPage() {
  const [selectedReel, setSelectedReel] = useState<ReelAnalysis | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [reels, setReels] = useState(mockReels);
  const [filter, setFilter] = useState<string>("all");

  const filteredReels = filter === "all"
    ? reels
    : reels.filter((r) => r.hook.type === filter);

  const handleAddReel = (url: string, accountName: string) => {
    const newReel: ReelAnalysis = {
      id: Date.now().toString(),
      url,
      account_name: accountName.replace("@", ""),
      analyzed_at: new Date().toISOString(),
      duration_seconds: 12,
      hook: {
        text: "New reel pending analysis...",
        duration_seconds: 2,
        type: "visual",
        score: 70,
      },
      structure: {
        segments: [
          { label: "Hook", start_seconds: 0, end_seconds: 2, description: "Auto-detected" },
          { label: "Content", start_seconds: 2, end_seconds: 10, description: "Main content" },
          { label: "CTA", start_seconds: 10, end_seconds: 12, description: "End of video" },
        ],
        pacing: "medium",
        transitions: ["cut"],
      },
      audio: { type: "trending_sound", has_voiceover: false },
      text_overlays: { count: 0, items: [] },
      cta: { present: false },
      overall_score: 65,
      tags: ["new", "pending-review"],
      notes: "Auto-generated analysis — complete manually.",
    };
    setReels([newReel, ...reels]);
    setShowAddModal(false);
  };

  return (
    <>
      <Header
        title="Instagram Reels"
        subtitle="Analyze the exact composition of each Reel"
        action={{ label: "Analyze a Reel", onClick: () => setShowAddModal(true) }}
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span>Filter by hook:</span>
          </div>
          {["all", "question", "visual", "shock", "statement", "trend"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filter === f
                  ? "bg-accent text-white border-accent"
                  : "bg-card border-border text-muted hover:text-foreground hover:border-border-light"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-6 bg-card border border-border rounded-xl px-5 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">{filteredReels.length} reel{filteredReels.length > 1 ? "s" : ""}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">
            Avg. score: <strong className="text-foreground">
              {filteredReels.length > 0
                ? Math.round(filteredReels.reduce((a, r) => a + r.overall_score, 0) / filteredReels.length)
                : 0}
            </strong>/100
          </span>
        </div>

        {/* Reel grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReels.map((reel, i) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              onClick={setSelectedReel}
              delay={i * 60}
            />
          ))}
        </div>

        {filteredReels.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No reels found with this filter.</p>
          </div>
        )}
      </div>

      {selectedReel && (
        <ReelDetail reel={selectedReel} onClose={() => setSelectedReel(null)} />
      )}

      {showAddModal && (
        <AddReelModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddReel}
        />
      )}
    </>
  );
}
