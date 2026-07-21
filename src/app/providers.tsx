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

export function AuthProvider({ 
  children,
  initialRole,
  initialStudentProfileId 
}: { 
  children: React.ReactNode;
  initialRole?: string | null;
  initialStudentProfileId?: string | null;
}) {
  const [user] = useState<User | null>(null);
  const [session] = useState<Session | null>(null);
  
  const [profile] = useState<UserProfile | null>(initialRole ? {
    id: initialStudentProfileId || "",
    name: "",
    role: initialRole as any
  } : null);
  
  const [isLoading] = useState(false);

  const refreshProfile = async () => {};

  const handleSignOut = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        console.error("Logout failed on server", await res.json());
        alert("Failed to securely log out. Please try again.");
        return;
      }
      window.location.href = "/";
    } catch (e) {
      console.error("Logout fetch failed:", e);
      alert("Network error during logout. Please check your connection and try again.");
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
