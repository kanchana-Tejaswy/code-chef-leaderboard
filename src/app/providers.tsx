"use client";

import React, { createContext, useContext } from "react";

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
