"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/shared/toast";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        showToast(error.message, "error");
      } else {
        showToast("Password reset link sent!", "success");
        setIsSent(true);
      }
    } catch (err) {
      showToast("Network Error: Could not connect to authorization server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex justify-center items-center p-6 bg-brand-bg text-brand-text relative overflow-hidden">
      {/* Background decoration */}
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
            <Mail className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-brand-text">
            Reset Password
          </h1>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            {!isSent
              ? "Enter your email address and we'll send you a link to restore your credentials."
              : "Check your email for the verification link to change your password."}
          </p>
        </div>

        {!isSent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@college.edu"
                {...register("email")}
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              {errors.email && (
                <p className="text-[11px] font-semibold text-red-500 mt-1">{errors.email.message}</p>
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
                  Sending Link...
                </>
              ) : (
                "Send Password Reset Link"
              )}
            </button>
          </form>
        ) : (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center space-y-2">
            <p className="text-xs text-green-500 font-semibold leading-relaxed">
              We have sent a password recovery link to your email address. It should arrive shortly.
            </p>
          </div>
        )}

        <div className="text-center pt-2 border-t border-brand-border/60">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#EAB308] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
      </motion.div>
    </div>
  );
}
