"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  name: string;
  rollNumber?: string | null;
  department?: string | null;
  year?: number | null;
  profilePictureUrl?: string | null;
  codechefUsername?: string | null;
  role: "STUDENT" | "FACULTY" | "PLACEMENT_OFFICER" | "PRINCIPAL" | "ADMIN";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          // Normalize role to uppercase for backwards compatibility
          const normalizedRole = (data.profile.role || "student").toUpperCase() as any;
          setProfile({
            id: data.profile.id,
            name: data.profile.name,
            rollNumber: data.profile.rollNumber || null,
            department: data.profile.department || null,
            year: data.profile.year || null,
            profilePictureUrl: data.profile.profileImage || null,
            role: normalizedRole,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const isDemoCookie = typeof document !== "undefined" && document.cookie.split("; ").find((row) => row.startsWith("demo_mode="))?.split("=")[1] === "true";
    const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";
    const isDemo = disableAuth || isDemoCookie;

    if (isDemo) {
      const mockUser = {
        id: "00000000-0000-0000-0000-000000000000",
        email: "demo@college.edu",
        user_metadata: {
          role: "ADMIN",
          full_name: "Demo Admin",
        }
      };
      setUser(mockUser as any);
      fetchProfile("00000000-0000-0000-0000-000000000000");
      return;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn("Supabase credentials missing. Skipping AuthProvider initialization.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // 1. Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setIsLoading(false);
        }
      });

      // 2. Listen for auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setIsLoading(false);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error("Failed to initialize Supabase client in AuthProvider:", error);
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const handleSignOut = async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error("Cannot sign out: Supabase credentials missing.");
      return;
    }

    try {
      const supabase = createClient();
      setIsLoading(true);
      // Clear demo mode cookie
      document.cookie = "demo_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      window.location.href = "/login";
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        refreshProfile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (storedTheme === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return nextTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
