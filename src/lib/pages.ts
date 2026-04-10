import {
  LayoutDashboard,
  Film,
  GitMerge,
  AtSign,
  Smartphone,
  BarChart2,
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
  { id: "accounts", label: "Accounts", href: "/accounts", icon: AtSign },
  { id: "instagram", label: "Instagram Reels", href: "/instagram", icon: Film },
  { id: "performance", label: "Performance", href: "/performance", icon: BarChart2 },
  { id: "funnel", label: "Funnel", href: "/funnel", icon: GitMerge },
  { id: "phone", label: "Phones", href: "/phone", icon: Smartphone },
];
