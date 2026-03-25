import {
  LayoutDashboard,
  Film,
  TrendingUp,
  Instagram,
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
  { id: "accounts", label: "Accounts", href: "/accounts", icon: Instagram },
  { id: "instagram", label: "Instagram Reels", href: "/instagram", icon: Film },
  { id: "performance", label: "Performance", href: "/performance", icon: TrendingUp },
];
