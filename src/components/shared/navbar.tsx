"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/providers";
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
  HelpCircle
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
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
          ? "border-b border-[#262626]/80 bg-[#0A0A0A]/75 backdrop-blur-xl shadow-lg"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Hexagon Brain SVG Icon */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <svg
                className="h-full w-full"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Outer Hexagon with subtle glow */}
                <polygon
                  points="50,8 88,30 88,74 50,96 12,74 12,30"
                  stroke="url(#navHexGradient)"
                  strokeWidth="3.5"
                  fill="rgba(234, 179, 8, 0.05)"
                  className="transition-colors duration-300 group-hover:fill-yellow-600/10"
                />
                
                {/* Neural Brain Connections */}
                {/* Central Stem */}
                <path d="M50,22 L50,78" stroke="url(#navBrainGradient)" strokeWidth="2.5" strokeLinecap="round" />
                
                {/* Left Hemisphere branches */}
                <path d="M50,30 C34,30 28,40 28,52 C28,64 38,70 50,70" stroke="url(#navBrainGradient)" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M50,42 C40,42 36,47 36,52 C36,57 40,60 50,60" stroke="url(#navBrainGradient)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                
                {/* Right Hemisphere branches */}
                <path d="M50,30 C66,30 72,40 72,52 C72,64 62,70 50,70" stroke="url(#navBrainGradient)" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M50,42 C60,42 64,47 64,52 C64,57 60,60 50,60" stroke="url(#navBrainGradient)" strokeWidth="1.8" strokeLinecap="round" fill="none" />

                {/* Nodes (Circles representing synapse points) */}
                <circle cx="50" cy="30" r="3" fill="#F59E0B" />
                <circle cx="50" cy="52" r="3" fill="#F59E0B" />
                <circle cx="50" cy="70" r="3" fill="#F59E0B" />
                <circle cx="28" cy="52" r="3" fill="#EAB308" />
                <circle cx="72" cy="52" r="3" fill="#EAB308" />
                <circle cx="36" cy="52" r="2.5" fill="#22C55E" />
                <circle cx="64" cy="52" r="2.5" fill="#22C55E" />

                {/* Gradients */}
                <defs>
                  <linearGradient id="navHexGradient" x1="50" y1="8" x2="50" y2="96" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EAB308" />
                  </linearGradient>
                  <linearGradient id="navBrainGradient" x1="28" y1="30" x2="72" y2="70" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#EAB308" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            {/* Title Text */}
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-wider uppercase text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">
                ACE Talent
              </span>
              <span className="text-[9px] font-black tracking-widest text-[#A3A3A3] leading-none">
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
          
          

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-[#262626] bg-[#111111] text-[#A3A3A3] hover:text-[#FAFAFA]"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#262626] bg-[#0A0A0A] px-4 py-4 space-y-2">
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
