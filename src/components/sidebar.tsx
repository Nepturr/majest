"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ALL_PAGES } from "@/lib/pages";
import { useAuth } from "@/components/auth-provider";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const ADMIN_NAV = [
  { label: "User Management", href: "/admin/users", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { profile, loading, signOut } = useAuth();

  const visiblePages =
    profile?.role === "admin"
      ? ALL_PAGES
      : ALL_PAGES.filter((p) => profile?.allowed_pages.includes(p.id));

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <Image
          src="/logo.png"
          alt="Majest"
          width={36}
          height={36}
          className="rounded-full shrink-0"
        />
        {!collapsed && (
          <h1 className="text-base font-bold tracking-tight animate-fade-in">
            MajestGPT
          </h1>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {visiblePages.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-active text-accent-light shadow-[inset_0_0_0_1px_rgba(34,64,196,0.2)]"
                      : "text-muted hover:text-foreground hover:bg-sidebar-hover"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] shrink-0",
                      isActive && "text-accent"
                    )}
                  />
                  {!collapsed && (
                    <span className="animate-fade-in">{item.label}</span>
                  )}
                </Link>
              );
            })}

            {/* Admin section */}
            {profile?.role === "admin" && (
              <>
                <div className="pt-2 pb-1">
                  {!collapsed && (
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3">
                      Admin
                    </p>
                  )}
                </div>
                {ADMIN_NAV.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-active text-accent-light shadow-[inset_0_0_0_1px_rgba(34,64,196,0.2)]"
                          : "text-muted hover:text-foreground hover:bg-sidebar-hover"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-[18px] h-[18px] shrink-0",
                          isActive && "text-accent"
                        )}
                      />
                      {!collapsed && (
                        <span className="animate-fade-in">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </>
            )}
          </>
        )}
      </nav>

      {/* User info + collapse */}
      <div className="p-3 border-t border-border space-y-1">
        {/* User card */}
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent-light shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile.full_name ?? profile.email}
                  </p>
                  <span className="text-[10px] font-medium text-accent-light">
                    {profile.role}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="w-7 h-7 rounded-lg hover:bg-sidebar-hover flex items-center justify-center transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors text-sm"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
