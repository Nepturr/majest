import {
  LayoutDashboard,
  Film,
  Users,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PageConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ALL_PAGES: PageConfig[] = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { id: "instagram", label: "Instagram Reels", href: "/instagram", icon: Film },
  { id: "models", label: "Models", href: "/models", icon: Users },
  { id: "performance", label: "Performance", href: "/performance", icon: TrendingUp },
];
