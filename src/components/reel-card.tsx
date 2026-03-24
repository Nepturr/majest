"use client";

import { cn, scoreColor, scoreBg } from "@/lib/utils";
import type { ReelAnalysis } from "@/types";
import { Clock, Music, Type, MousePointerClick, Tag, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ReelCardProps {
  reel: ReelAnalysis;
  onClick: (reel: ReelAnalysis) => void;
  delay?: number;
}

export function ReelCard({ reel, onClick, delay = 0 }: ReelCardProps) {
  return (
    <button
      onClick={() => onClick(reel)}
      className="w-full text-left bg-card border border-border rounded-xl p-5 hover:border-accent/30 hover:bg-card-hover transition-all duration-300 group animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm">@{reel.account_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(reel.analyzed_at), { addSuffix: true })}
          </p>
        </div>
        <div className={cn("px-3 py-1.5 rounded-lg border text-lg font-bold", scoreBg(reel.overall_score), scoreColor(reel.overall_score))}>
          {reel.overall_score}
        </div>
      </div>

      <p className="text-sm text-muted mb-3 line-clamp-1 italic">&ldquo;{reel.hook.text}&rdquo;</p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{reel.duration_seconds}s</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Music className="w-3.5 h-3.5" />
          <span className="truncate">{reel.audio.type.replace(/_/g, " ")}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Type className="w-3.5 h-3.5" />
          <span>{reel.text_overlays.count} overlay{reel.text_overlays.count > 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>{reel.cta.present ? reel.cta.type : "No CTA"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3 h-3 text-muted-foreground" />
          {reel.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-accent-glow text-accent-light border border-accent/10">
              {tag}
            </span>
          ))}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
      </div>
    </button>
  );
}
