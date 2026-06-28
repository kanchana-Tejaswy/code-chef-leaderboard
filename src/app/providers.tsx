"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface UserProfile {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  year: number;
  profilePictureUrl: string | null;
  codechefUsername: string | null;
  role: "STUDENT" | "FACULTY" | "PLACEMENT_OFFICER" | "PRINCIPAL" | "ADMIN";
}

interface AuthContextType {
  user: any;
  session: any;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const mockProfile: UserProfile = {
  id: "mock-user-id",
  name: "Faculty Member",
  rollNumber: "FAC001",
  department: "CSE",
  year: 4,
  profilePictureUrl: null,
  codechefUsername: null,
  role: "FACULTY",
};

const AuthContext = createContext<AuthContextType>({
  user: { id: "mock-user-id", email: "faculty@ace.edu" },
  session: { access_token: "mock-token" },
  profile: mockProfile,
  isLoading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: { id: "mock-user-id", email: "faculty@ace.edu" },
        session: { access_token: "mock-token" },
        profile: mockProfile,
        isLoading: false,
        refreshProfile: async () => {},
        signOut: async () => {},
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

