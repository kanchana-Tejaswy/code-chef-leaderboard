"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useToast } from "@/components/shared/toast";
import { Loader2, ArrowRight, Code, Trophy, Sparkles } from "lucide-react";

// Form validation schema
const signupSchema = z
  .object({
    name: z.string().min(1, "Full Name is required").max(100),
    email: z.string().min(1, "Email is required").email("Invalid email format"),
    rollNumber: z.string().min(1, "College Roll Number is required").regex(/^[0-9A-Z]{10}$/i, "Roll number must be exactly 10 alphanumeric characters"),
    department: z.string().min(1, "Department is required"),
    year: z.string().min(1, "Academic Year is required"),
    codechefUrl: z.string().optional(),
    leetcodeUrl: z.string().optional(),
    githubUrl: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    terms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

const departments = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "CSM", name: "CSE (Artificial Intelligence & Machine Learning)" },
  { code: "CSD", name: "CSE (Data Science)" },
  { code: "IT", name: "Information Technology" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "EEE", name: "Electrical & Electronics Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "CE", name: "Civil Engineering" },
];

const academicYears = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
];

export default function SignupPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      rollNumber: "",
      department: "",
      year: "",
      codechefUrl: "",
      leetcodeUrl: "",
      githubUrl: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Signup failed", "error");
      } else {
        showToast("Registration Successful! Redirecting to login...", "success");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch (err) {
      showToast("Network Error: Could not complete registration.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex justify-center items-center p-6 bg-brand-bg text-brand-text relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#EAB308]/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-full max-w-2xl p-8 rounded-3xl border border-brand-border bg-brand-card/50 backdrop-blur-xl shadow-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#EAB308]/20 bg-[#EAB308]/5 text-[10px] font-bold text-[#EAB308] tracking-widest uppercase">
            Student Registration
          </div>
          <h1 className="text-2xl font-black tracking-tight text-brand-text">
            Join ACE Talent Intelligence
          </h1>
          <p className="text-xs text-brand-muted max-w-md mx-auto">
            Create an account to start syncing your competitive programming stats and display your coding excellence.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Full Name */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Full Name
              </label>
              <input
                placeholder="Enter your full name"
                {...register("name")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              {errors.name && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email address"
                {...register("email")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              {errors.email && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Roll Number */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Roll Number
              </label>
              <input
                placeholder="Enter your roll number"
                {...register("rollNumber")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              {errors.rollNumber && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.rollNumber.message}</p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Department
              </label>
              <select
                {...register("department")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all cursor-pointer"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.code} value={dept.code}>
                    {dept.code} - {dept.name}
                  </option>
                ))}
              </select>
              {errors.department && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.department.message}</p>
              )}
            </div>

            {/* Academic Year */}
            <div className="space-y-1.5 text-left col-span-1 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Academic Year
              </label>
              <div className="grid grid-cols-4 gap-3">
                {academicYears.map((yr) => (
                  <label
                    key={yr.value}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-brand-border bg-brand-card hover:border-[#EAB308]/30 cursor-pointer transition-all"
                  >
                    <input
                      type="radio"
                      value={yr.value}
                      {...register("year")}
                      className="sr-only peer"
                    />
                    <span className="text-xs font-bold text-brand-text">{yr.label}</span>
                  </label>
                ))}
              </div>
              {errors.year && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.year.message}</p>
              )}
            </div>

            {/* CodeChef URL */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                CodeChef Profile URL / Username
              </label>
              <input
                placeholder="https://codechef.com/users/your_id"
                {...register("codechefUrl")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
            </div>

            {/* LeetCode URL */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                LeetCode Profile URL / Username
              </label>
              <input
                placeholder="https://leetcode.com/u/your_id"
                {...register("leetcodeUrl")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
            </div>

            {/* GitHub URL */}
            <div className="space-y-1.5 text-left col-span-1 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                GitHub Profile URL / Username
              </label>
              <input
                placeholder="https://github.com/your_id"
                {...register("githubUrl")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                {...register("password")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              {errors.password && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 focus:border-[#EAB308] transition-all"
              />
              {errors.confirmPassword && (
                <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-2.5 text-left">
            <input
              id="terms"
              type="checkbox"
              {...register("terms")}
              className="h-4.5 w-4.5 mt-0.5 rounded border-brand-border text-[#EAB308] focus:ring-[#EAB308] cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-brand-muted select-none cursor-pointer">
              I agree to the{" "}
              <Link href="#" className="font-bold text-[#EAB308] hover:underline">
                Terms & Conditions
              </Link>{" "}
              and permit the platform to aggregate my programming statistics.
            </label>
          </div>
          {errors.terms && (
            <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.terms.message}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-[#0A0A0A] font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(234,179,8,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering student...
              </>
            ) : (
              "Create Student Account"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-brand-muted pt-2 border-t border-brand-border/60">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-[#EAB308] hover:underline"
          >
            Sign In Here
          </Link>
        </div>

        </div>
      </motion.div>
    </div>
  );
}
