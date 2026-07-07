"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/shared/toast";
import { Eye, EyeOff, Loader2, Sparkles, Trophy, Code, Target, Activity } from "lucide-react";

// Form validation schema
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if session already exists on mount and redirect to prevent login loop
  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        console.log("[Login Page] Checking for existing Supabase session...");
        const { data: { session } } = await supabase.auth.getSession();
        console.log("[Login Page] Existing session user:", session?.user?.id || "none");
        if (session?.user) {
          console.log("[Login Page] Session exists. Fetching profile details...");
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data = await res.json();
            const role = (data.profile?.role || "STUDENT").toUpperCase();
            console.log("[Login Page] User Profile Role:", role);
            if (role === "ADMIN") {
              console.log("[Login Page] Redirecting Admin to /admin/dashboard");
              router.push("/admin/dashboard");
            } else {
              console.log("[Login Page] Redirecting Student to /student/dashboard");
              router.push("/student/dashboard");
            }
          } else {
            console.warn("[Login Page] Failed to fetch profile from /api/auth/me. Status:", res.status);
          }
        }
      } catch (err) {
        console.error("Error checking existing session:", err);
      }
    };
    checkSession();
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      console.log("[Login Page] Attempting email/password sign-in...");
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        console.error("[Login Page] Sign-in error:", error.message);
        showToast(error.message, "error");
      } else {
        console.log("[Login Page] Sign-in successful! Fetching user role...");
        showToast("Login Successful", "success");
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data = await res.json();
            const role = (data.profile?.role || "STUDENT").toUpperCase();
            console.log("[Login Page] Fetched user role:", role);
            if (role === "ADMIN") {
              router.push("/admin/dashboard");
            } else {
              router.push("/student/dashboard");
            }
          } else {
            console.warn("[Login Page] Profile fetch failed, redirecting to /student/dashboard");
            router.push("/student/dashboard");
          }
        } catch (err) {
          console.error("[Login Page] Error retrieving profile:", err);
          router.push("/student/dashboard");
        }
        router.refresh();
      }
    } catch (err: any) {
      console.error("[Login Page] Submit error:", err);
      showToast("Network Error: Could not connect to authentication services.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) {
        console.error("[Login Page] Missing Supabase environment variables for Google Auth.");
        showToast("Supabase environment variables are missing", "error");
        return;
      }

      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("[Login Page] Initiating signInWithOAuth for Google. Redirect URL:", redirectUrl);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) {
        console.error("[Login Page] Supabase OAuth error:", error.message);
        showToast(error.message, "error");
      }
    } catch (err: any) {
      console.error("Google login initiation error:", err);
      showToast(`Failed to initiate Google authentication: ${err.message || err}`, "error");
    }
  };

  const handleDemoLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      console.log("[Demo Login] Attempting to sign in with demo credentials...");
      
      const email = "demo-admin@college.edu";
      const password = "DemoAdmin123!";

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.log("[Demo Login] Sign-in failed. Error message:", signInError.message);
        
        // If account does not exist, automatically sign up the demo user
        if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("does not exist") || signInError.message.includes("Email not confirmed")) {
          console.log("[Demo Login] Account doesn't exist or not verified. Automatically signing up...");
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                role: "ADMIN",
                full_name: "Demo Admin",
              },
            },
          });

          if (signUpError) {
            console.error("[Demo Login] Sign-up failed:", signUpError.message);
            showToast(`Demo Sign-up failed: ${signUpError.message}`, "error");
            setIsLoading(false);
            return;
          }

          console.log("[Demo Login] Sign-up successful. Re-attempting sign-in...");
          const { error: secondSignInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (secondSignInError) {
            console.error("[Demo Login] Second sign-in failed:", secondSignInError.message);
            showToast(`Demo Login failed: ${secondSignInError.message}`, "error");
            setIsLoading(false);
            return;
          }
        } else {
          showToast(`Demo Sign-in error: ${signInError.message}`, "error");
          setIsLoading(false);
          return;
        }
      }

      console.log("[Demo Login] Successfully authenticated! Redirecting to dashboard...");
      showToast("Signed in as Demo User", "success");
      
      // Fetch /api/auth/me to sync database profile
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          console.log("[Demo Login] Profile synced successfully.");
        }
      } catch (syncErr) {
        console.error("[Demo Login] Profile sync error:", syncErr);
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error("[Demo Login] Unexpected error:", err);
      showToast(`Unexpected error during demo login: ${err.message || err}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-12 bg-brand-bg text-brand-text overflow-hidden transition-colors duration-300">
      
      {/* Left Column: Branding Section */}
      <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-12 bg-brand-card border border-brand-border shadow-sm rounded-[32px] m-6 overflow-hidden transition-all duration-300">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#D4A017]/10 dark:from-[#EAB308]/20 to-transparent blur-[120px] animate-pulse" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-blue-500/10 dark:from-blue-500/20 to-transparent blur-[120px] animate-pulse" />
        </div>

        {/* Header Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-[#D4A017] dark:text-[#EAB308]" />
          <span className="text-sm font-extrabold tracking-widest uppercase text-brand-text">
            ACE Talent Intelligence
          </span>
        </div>

        {/* Feature Display & Glass Cards */}
        <div className="relative z-10 my-auto max-w-xl space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-none text-brand-text">
              Empowering Engineering Talent Through <span className="text-[#D4A017] dark:text-[#EAB308] bg-clip-text">Real-Time</span> <span className="text-[#D4A017] dark:text-[#EAB308] bg-clip-text">Competitive Programming</span> Analytics.
            </h2>
            <p className="text-sm text-brand-muted font-medium leading-relaxed">
              Verify your coding accomplishments, showcase real skills, and prepare for elite placements automatically.
            </p>
          </div>

          {/* Floating Glass Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Sparkles, label: "AI Powered Analytics", desc: "Automated student performance insights" },
              { icon: Code, label: "CodeChef Insights", desc: "Star ratings & problem statistics synced" },
              { icon: Target, label: "LeetCode Analytics", desc: "Topic strengths & problem counts" },
              { icon: Activity, label: "GitHub Tracking", desc: "Open source contributions metrics" },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="p-4 rounded-[18px] border border-brand-border bg-brand-bg shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-[#D4A017]/40 dark:hover:border-[#EAB308]/40 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#FEF3C7] dark:bg-[#EAB308]/15 text-[#D4A017] dark:text-[#EAB308]">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-brand-text">{feature.label}</h4>
                    <p className="text-[10px] text-brand-muted mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Details */}
        <div className="relative z-10 flex items-center justify-between text-[10px] text-brand-muted uppercase tracking-widest font-bold">
          <span>ACE Engineering College</span>
          <span>Placement Readiness Dashboard</span>
        </div>
      </div>

      {/* Right Column: Glassmorphism Login Form */}
      <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 block lg:hidden">
          <div className="absolute -top-[20%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#D4A017]/10 dark:from-[#EAB308]/10 to-transparent blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="w-full max-w-md p-8 rounded-[32px] border border-brand-border border-t-2 border-t-[#D4A017]/30 dark:border-t-[#EAB308]/30 bg-brand-card/90 backdrop-blur-xl shadow-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-text">
              Welcome Back
            </h1>
            <p className="text-xs text-brand-muted font-medium">
              Enter your credentials to access your talent insights.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@college.edu"
                {...register("email")}
                className="w-full h-[52px] px-4 rounded-[16px] border border-brand-border bg-brand-highlight text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 dark:focus:ring-[#EAB308]/20 focus:border-[#D4A017] dark:focus:border-[#EAB308] placeholder-brand-muted/50 transition-all duration-200"
              />
              {errors.email && (
                <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-[#D4A017] dark:text-[#EAB308] hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  className="w-full h-[52px] pl-4 pr-11 rounded-[16px] border border-brand-border bg-brand-highlight text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 dark:focus:ring-[#EAB308]/20 focus:border-[#D4A017] dark:focus:border-[#EAB308] placeholder-brand-muted/50 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 text-left">
              <input
                id="rememberMe"
                type="checkbox"
                {...register("rememberMe")}
                className="h-4 w-4 rounded border-brand-border text-[#D4A017] dark:text-[#EAB308] focus:ring-[#D4A017] dark:focus:ring-[#EAB308] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs font-semibold text-brand-muted select-none cursor-pointer">
                Remember my login
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] rounded-[16px] bg-[#D4A017] dark:bg-[#EAB308] hover:bg-[#B8860B] dark:hover:bg-[#FACC15] hover:-translate-y-0.5 hover:shadow-lg text-[#111827] dark:text-white font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-brand-border"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold tracking-widest text-brand-muted uppercase">
              Or Connect With
            </span>
            <div className="flex-grow border-t border-brand-border"></div>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full h-[52px] rounded-[16px] border border-brand-border bg-brand-card hover:bg-brand-highlight text-brand-text font-bold text-xs tracking-wider uppercase shadow-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {/* Google Icon SVG */}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Demo Login Button */}
          <button
            onClick={handleDemoLogin}
            disabled={isLoading}
            type="button"
            className="w-full h-[52px] rounded-[16px] border border-brand-border bg-brand-card hover:bg-brand-highlight text-brand-text font-bold text-xs tracking-wider uppercase shadow-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            Continue as Demo User
          </button>

          {/* Create Account Link */}
          <div className="text-center text-xs text-brand-muted font-semibold">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="font-bold text-[#D4A017] dark:text-[#EAB308] hover:underline"
            >
              Create Student Account
            </Link>
          </div>

          </div>
        </motion.div>
      </div>

    </div>
  );
}
