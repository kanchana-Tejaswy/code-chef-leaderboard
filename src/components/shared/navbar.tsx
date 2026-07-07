"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useTheme } from "@/app/providers";
import Image from "next/image";
import {
  LogOut,
  LayoutDashboard,
  Trophy,
  User as UserIcon,
  ShieldAlert,
  Bell,
  Settings as SettingsIcon,
  Menu,
  X,
  TrendingUp,
  Sparkles,
  Layers,
  HelpCircle,
  Sun,
  Moon
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isLinkActive = (path: string) => {
    return pathname === path;
  };

  const navItemClass = (path: string) =>
    `relative py-1.5 px-3 text-xs font-bold tracking-wide uppercase rounded-lg transition-all duration-200 ${
      isLinkActive(path)
        ? "bg-[#EAB308] text-[#0A0A0A]"
        : "bg-transparent text-white hover:text-[#EAB308] hover:bg-white/5"
    }`;

  const mobileNavItemClass = (path: string) =>
    `block text-xs font-bold uppercase tracking-wider rounded-lg py-2 px-4 transition-all duration-200 ${
      isLinkActive(path)
        ? "bg-[#EAB308] text-[#0A0A0A]"
        : "bg-transparent text-white hover:text-[#EAB308] hover:bg-white/5"
    }`;

  const isStaff = profile && ["ADMIN", "FACULTY", "PLACEMENT_OFFICER", "PRINCIPAL"].includes(profile.role);



  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-brand-border/80 bg-brand-bg/75 backdrop-blur-xl shadow-lg"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Hexagon Brain SVG Icon */}
              <Image
                src="/ace-logo-ldb.jpg"
                alt="ACE Logo"
                width={40}
                height={40}
                className="rounded-md"
              />
            
            {/* Title Text */}
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-wider uppercase text-brand-text group-hover:text-[#EAB308] transition-colors">
                ACE Talent
              </span>
              <span className="text-[9px] font-black tracking-widest text-brand-muted leading-none">
                INTELLIGENCE
              </span>
            </div>
          </Link>

        </div>

        {/* Center Desktop Navigation Links */}
        {profile && (
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/dashboard" className={navItemClass("/dashboard")}>
              Dashboard
            </Link>
            <Link href="/leaderboard" className={navItemClass("/leaderboard")}>
              Leaderboard
            </Link>
            <Link href="/analytics" className={navItemClass("/analytics")}>
              Analytics
            </Link>
            <Link href="/departments" className={navItemClass("/departments")}>
              Departments
            </Link>
            <Link href="/insights" className={navItemClass("/insights")}>
              Insights
            </Link>
          </nav>
        )}

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-3">
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className="relative p-2 rounded-lg border border-brand-border bg-brand-card text-brand-muted hover:text-brand-text hover:border-[#EAB308]/30 transition-all duration-300 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 cursor-pointer"
          >
            <div className="relative w-4 h-4 flex items-center justify-center">
              <Sun
                className={`h-4 w-4 absolute transition-all duration-500 ease-out transform ${
                  theme === "dark"
                    ? "rotate-90 scale-0 opacity-0"
                    : "rotate-0 scale-100 opacity-100 text-[#EAB308]"
                }`}
              />
              <Moon
                className={`h-4 w-4 absolute transition-all duration-500 ease-out transform ${
                  theme === "dark"
                    ? "rotate-0 scale-100 opacity-100 text-[#F59E0B]"
                    : "-rotate-90 scale-0 opacity-0"
                }`}
              />
            </div>
          </button>

          {/* User Profile / Auth State controls */}
          {profile ? (
            <div className="flex items-center gap-3 border-l border-brand-border pl-3">
              {/* User Avatar */}
              <div className="relative h-8 w-8 rounded-full overflow-hidden border border-brand-border bg-brand-highlight flex items-center justify-center shrink-0">
                {profile.profilePictureUrl ? (
                  <Image
                    src={profile.profilePictureUrl}
                    alt={profile.name || "User"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xs font-black uppercase text-brand-text">
                    {profile.name?.charAt(0) || "U"}
                  </span>
                )}
              </div>

              {/* User Info (Desktop only) */}
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-bold text-brand-text truncate max-w-[120px]">
                  {profile.name}
                </span>
                <span
                  className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 w-max leading-none ${
                    profile.role === "ADMIN"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : profile.role === "FACULTY"
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-green-500/10 text-green-500 border border-green-500/20"
                  }`}
                >
                  {profile.role}
                </span>
              </div>

              {/* Settings (Desktop only) */}
              <Link
                href="/settings"
                title="Profile Settings"
                className="hidden md:flex p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-highlight transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>

              {/* Logout Button */}
              <button
                onClick={signOut}
                title="Log Out"
                className="p-1.5 rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 border-l border-brand-border pl-3">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-brand-muted hover:text-brand-text"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#EAB308] text-[#0A0A0A] hover:bg-[#FACC15] transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-brand-border bg-brand-card text-brand-muted hover:text-brand-text"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-brand-border bg-brand-bg px-4 py-4 space-y-2">
          {profile && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-brand-border bg-brand-card/40 mb-3 text-left">
              <div className="relative h-9 w-9 rounded-full overflow-hidden border border-brand-border bg-brand-highlight flex items-center justify-center shrink-0">
                {profile.profilePictureUrl ? (
                  <Image
                    src={profile.profilePictureUrl}
                    alt={profile.name || "User"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="text-sm font-black uppercase text-brand-text">
                    {profile.name?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-brand-text">{profile.name}</div>
                <div
                  className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 w-max leading-none ${
                    profile.role === "ADMIN"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : profile.role === "FACULTY"
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-green-500/10 text-green-500 border border-green-500/20"
                  }`}
                >
                  {profile.role}
                </div>
              </div>
            </div>
          )}

          {profile ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/dashboard")}
              >
                Dashboard
              </Link>
              <Link
                href="/leaderboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/leaderboard")}
              >
                Leaderboard
              </Link>
              <Link
                href="/analytics"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/analytics")}
              >
                Analytics
              </Link>
              <Link
                href="/departments"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/departments")}
              >
                Departments
              </Link>
              <Link
                href="/insights"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/insights")}
              >
                Insights
              </Link>
              <Link
                href="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/settings")}
              >
                Settings
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider rounded-lg py-2.5 px-4 text-red-500 hover:bg-red-500/5 transition-all mt-4 border border-red-500/20 bg-red-500/5"
              >
                <span>Sign Out</span>
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2 border-t border-brand-border">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl border border-brand-border text-xs font-bold text-brand-text"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-[#EAB308] text-[#0A0A0A] hover:bg-[#FACC15] text-xs font-bold transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

