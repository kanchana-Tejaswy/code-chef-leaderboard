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
        <nav className="hidden md:flex items-center gap-4">
          <Link href="/" className={navItemClass("/")}>
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
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className={mobileNavItemClass("/")}
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
        </div>
      )}
    </header>
  );
}
