"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  allowed_pages: string[];
  assigned_instagram_account_ids: string[];
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// Fetches profile via our own API route (service_role, no RLS) with a 6s timeout
async function fetchProfileFromAPI(signal: AbortSignal): Promise<Profile | null> {
  try {
    const res = await fetch("/api/me/profile", {
      signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[auth] /api/me/profile →", res.status);
      return null;
    }
    return (await res.json()) as Profile;
  } catch (e) {
    console.warn("[auth] fetchProfileFromAPI threw:", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseRef = useRef(createClient());
  const abortRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 6s hard timeout on the fetch itself
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const data = await fetchProfileFromAPI(controller.signal);
      setProfile(data);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let done = false;

    const finish = () => {
      if (!done) {
        done = true;
        setLoading(false);
      }
    };

    // Ultimate fallback — fires after 8s if everything else fails
    const timeout = setTimeout(() => {
      console.warn("[auth] 8s timeout → forcing setLoading(false)");
      finish();
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[auth]", event, session?.user?.id ?? "no user");
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile();
        } else {
          setProfile(null);
          abortRef.current?.abort();
        }
      } catch {
        setProfile(null);
      } finally {
        finish();
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      abortRef.current?.abort();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    abortRef.current?.abort();
    await supabaseRef.current.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
