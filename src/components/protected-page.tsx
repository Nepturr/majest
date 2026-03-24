"use client";

import { useAuth } from "@/components/auth-provider";
import { ShieldX, Loader2 } from "lucide-react";
import Link from "next/link";

interface ProtectedPageProps {
  pageId: string;
  children: React.ReactNode;
}

export function ProtectedPage({ pageId, children }: ProtectedPageProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role === "admin") return <>{children}</>;

  if (!profile?.allowed_pages.includes(pageId)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-danger" />
        </div>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          You don&apos;t have permission to access this page. Contact your admin.
        </p>
        <Link
          href="/"
          className="h-9 px-4 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
