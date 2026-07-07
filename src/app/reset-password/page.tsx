"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/shared/toast";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        showToast(error.message, "error");
      } else {
        showToast("Password updated successfully! Redirecting...", "success");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch (err) {
      showToast("Network Error: Could not connect to update password.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex justify-center items-center p-6 bg-brand-bg text-brand-text relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#EAB308]/10 to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-full max-w-md p-8 rounded-3xl border border-brand-border bg-brand-card/50 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-[#EAB308]/10 flex items-center justify-center text-[#EAB308] mb-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-brand-text">
            Enter New Password
          </h1>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Choose a strong password containing numbers, letters, and uppercase characters.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Password */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                {...register("password")}
                className="w-full pl-4 pr-11 py-3 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPass ? "text" : "password"}
                placeholder="••••••••"
                {...register("confirmPassword")}
                className="w-full pl-4 pr-11 py-3 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
              >
                {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-[#0A0A0A] font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(234,179,8,0.15)] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              "Save & Reset Password"
            )}
          </button>
        </form>
        </div>
      </motion.div>
    </div>
  );
}
