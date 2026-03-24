import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: LucideIcon;
  delay?: number;
}

export function StatsCard({ label, value, change, changeType = "neutral", icon: Icon, delay = 0 }: StatsCardProps) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-300 group animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent-glow border border-accent/20 flex items-center justify-center group-hover:animate-pulse-glow transition-all">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        {change && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              changeType === "up" && "bg-success/10 text-success",
              changeType === "down" && "bg-danger/10 text-danger",
              changeType === "neutral" && "bg-muted-foreground/10 text-muted-foreground"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
