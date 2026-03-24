"use client";

import { useAuth } from "@/components/auth-provider";
import { ShieldX, Loader2, UserX } from "lucide-react";
import Link from "next/link";

interface ProtectedPageProps {
  pageId: string;
  children: React.ReactNode;
}

export function ProtectedPage({ pageId, children }: ProtectedPageProps) {
  const { profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No profile found in DB (user exists in Auth but no profile row)
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
          <UserX className="w-8 h-8 text-warning" />
        </div>
        <h2 className="text-xl font-bold">Profile not found</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Your account exists but has no profile yet. Ask your admin to run the
          setup SQL, or check the{" "}
          <code className="text-xs bg-card px-1.5 py-0.5 rounded">
            supabase/schema.sql
          </code>{" "}
          file.
        </p>
        <button
          onClick={signOut}
          className="h-9 px-4 bg-card border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  // Admin → full access
  if (profile.role === "admin") return <>{children}</>;

  // User → check page permissions
  if (!profile.allowed_pages.includes(pageId)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-danger" />
        </div>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          You don&apos;t have permission to access this page. Contact your
          admin.
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
