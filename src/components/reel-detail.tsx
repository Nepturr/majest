"use client";

import { cn, scoreColor, scoreBg } from "@/lib/utils";
import type { ReelAnalysis } from "@/types";
import {
  X, Clock, Music, Type, MousePointerClick, Zap,
  ArrowRight, ExternalLink, MessageSquare,
} from "lucide-react";

interface ReelDetailProps {
  reel: ReelAnalysis;
  onClose: () => void;
}

const hookTypeLabels: Record<string, string> = {
  question: "Question",
  statement: "Statement",
  shock: "Shock",
  visual: "Visual",
  trend: "Trend",
};

export function ReelDetail({ reel, onClose }: ReelDetailProps) {
  const totalDuration = reel.duration_seconds;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl h-full bg-background border-l border-border overflow-y-auto animate-slide-in">
        <div className="sticky top-0 bg-background/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold">@{reel.account_name}</h3>
            <p className="text-sm text-muted-foreground">Detailed Reel Analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={reel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg border border-border hover:bg-card flex items-center justify-center transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg border border-border hover:bg-card flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall Score */}
          <div className={cn("rounded-xl border p-5 text-center", scoreBg(reel.overall_score))}>
            <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
            <p className={cn("text-5xl font-black", scoreColor(reel.overall_score))}>
              {reel.overall_score}
            </p>
            <p className="text-sm text-muted-foreground mt-1">/100</p>
          </div>

          {/* Hook */}
          <Section title="Hook" icon={Zap}>
            <div className="space-y-3">
              <p className="text-sm italic text-muted">&ldquo;{reel.hook.text}&rdquo;</p>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Type" value={hookTypeLabels[reel.hook.type] || reel.hook.type} />
                <Stat label="Duration" value={`${reel.hook.duration_seconds}s`} />
                <Stat label="Score" value={`${reel.hook.score}/100`} valueClass={scoreColor(reel.hook.score)} />
              </div>
            </div>
          </Section>

          {/* Structure / Timeline */}
          <Section title="Structure & Timeline" icon={ArrowRight}>
            <div className="space-y-2">
              <div className="flex items-center gap-1 h-6 rounded-lg overflow-hidden">
                {reel.structure.segments.map((seg, i) => {
                  const width = ((seg.end_seconds - seg.start_seconds) / totalDuration) * 100;
                  const colors = [
                    "bg-accent",
                    "bg-info",
                    "bg-warning",
                    "bg-success",
                    "bg-danger",
                  ];
                  return (
                    <div
                      key={i}
                      className={cn("h-full rounded transition-all hover:opacity-80 relative group/seg", colors[i % colors.length])}
                      style={{ width: `${width}%` }}
                      title={`${seg.label}: ${seg.start_seconds}s - ${seg.end_seconds}s`}
                    >
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover/seg:block bg-card border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                        {seg.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>0s</span>
                <span>{totalDuration}s</span>
              </div>
              <div className="mt-4 space-y-2">
                {reel.structure.segments.map((seg, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">
                      {seg.start_seconds}s–{seg.end_seconds}s
                    </span>
                    <div>
                      <span className="font-medium">{seg.label}</span>
                      <span className="text-muted-foreground"> — {seg.description}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">Pacing:</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-glow text-accent-light border border-accent/10">
                  {reel.structure.pacing}
                </span>
                <span className="text-xs text-muted-foreground ml-2">Transitions:</span>
                {reel.structure.transitions.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          {/* Audio */}
          <Section title="Audio" icon={Music}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Type" value={reel.audio.type.replace(/_/g, " ")} />
              <Stat label="Voiceover" value={reel.audio.has_voiceover ? "Yes" : "No"} />
              {reel.audio.name && <Stat label="Sound" value={reel.audio.name} className="col-span-2" />}
            </div>
          </Section>

          {/* Text Overlays */}
          <Section title="Text Overlays" icon={Type}>
            <div className="space-y-2">
              {reel.text_overlays.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm bg-card rounded-lg p-3 border border-border">
                  <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">{item.timestamp_seconds}s</span>
                  <div>
                    <p className="text-foreground">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.style}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* CTA */}
          <Section title="Call to Action" icon={MousePointerClick}>
            {reel.cta.present ? (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Type" value={reel.cta.type || "—"} />
                <Stat label="Text" value={reel.cta.text || "—"} />
                <Stat label="Placement" value={reel.cta.placement || "—"} />
              </div>
            ) : (
              <p className="text-sm text-warning">No CTA detected — missed opportunity</p>
            )}
          </Section>

          {/* Notes */}
          {reel.notes && (
            <Section title="Analysis Notes" icon={MessageSquare}>
              <p className="text-sm text-muted leading-relaxed">{reel.notes}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass, className }: { label: string; value: string; valueClass?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium mt-0.5", valueClass)}>{value}</p>
    </div>
  );
}
