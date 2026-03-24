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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseRef = useRef(createClient());

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabaseRef.current
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) console.warn("[auth] fetchProfile error:", error.message);
      setProfile(data ?? null);
    } catch (e) {
      console.warn("[auth] fetchProfile threw:", e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const supabase = supabaseRef.current;

    // Fallback: unblock UI after 5s no matter what
    const timeout = setTimeout(() => setLoading(false), 5000);

    // onAuthStateChange handles ALL events including INITIAL_SESSION (page reload)
    // When INITIAL_SESSION fires, the client already has the auth token loaded
    // → safe to make authenticated DB queries right away
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(timeout);
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
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
