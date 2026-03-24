"use client";

import { Header } from "@/components/header";
import { ProtectedPage } from "@/components/protected-page";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const metrics = [
  { label: "Avg. retention rate", value: "67%", change: "+4.2%", trend: "up" as const },
  { label: "Organic reach", value: "24.3K", change: "+12%", trend: "up" as const },
  { label: "Engagement rate", value: "8.7%", change: "-0.3%", trend: "down" as const },
  { label: "Bio link conversions", value: "342", change: "+28%", trend: "up" as const },
  { label: "New followers / week", value: "1.2K", change: "0%", trend: "neutral" as const },
  { label: "Reels with score > 80", value: "18", change: "+5", trend: "up" as const },
];

export default function PerformancePage() {
  return (
    <ProtectedPage pageId="performance">
      <Header title="Performance" subtitle="Marketing metrics and trends" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m, i) => {
            const TrendIcon = m.trend === "up" ? ArrowUpRight : m.trend === "down" ? ArrowDownRight : Minus;
            return (
              <div
                key={m.label}
                className="bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <p className="text-sm text-muted-foreground mb-3">{m.label}</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black tracking-tight">{m.value}</p>
                  <span className={cn(
                    "flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full",
                    m.trend === "up" && "text-success bg-success/10",
                    m.trend === "down" && "text-danger bg-danger/10",
                    m.trend === "neutral" && "text-muted-foreground bg-muted-foreground/10"
                  )}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    {m.change}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h3 className="font-semibold">Recommendations</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>Increase frequency of short Reels (8–15s) — they generate 34% more organic reach.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>Use &ldquo;question&rdquo; or &ldquo;shock&rdquo; hooks — retention rate is 22% higher.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-warning/10 text-warning flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>Engagement rate is slightly declining — test more interactive formats (polls, Q&amp;A).</span>
            </li>
          </ul>
        </div>
      </div>
    </ProtectedPage>
  );
}
