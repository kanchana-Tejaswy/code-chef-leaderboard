"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useToast } from "@/components/shared/toast";
import { Loader2 } from "lucide-react";

// Form validation schema
const onboardingSchema = z.object({
  rollNumber: z.string().min(1, "College Roll Number is required").regex(/^[0-9A-Z]{10}$/i, "Roll number must be exactly 10 alphanumeric characters"),
  department: z.string().min(1, "Department is required"),
  year: z.string().min(1, "Academic Year is required"),
  codechefUrl: z.string().optional(),
  leetcodeUrl: z.string().optional(),
  githubUrl: z.string().optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

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

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.id) {
            setUserProfile({
              id: data.profile.id,
              name: data.profile.name,
            });
            
            // If they already have a StudentProfile, send them to their dashboard
            if (!data.needsOnboarding) {
              router.replace(`/student/${data.profile.id}`);
            }
          } else {
            router.replace("/login");
          }
        } else {
          router.replace("/login");
        }
      } catch (err) {
        console.error("Failed to load user details:", err);
        router.replace("/login");
      } finally {
        setIsFetchingUser(false);
      }
    }
    loadUser();
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      rollNumber: "",
      department: "",
      year: "",
      codechefUrl: "",
      leetcodeUrl: "",
      githubUrl: "",
    },
  });

  const onSubmit = async (values: OnboardingFormValues) => {
    if (!userProfile) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userProfile.id,
          name: userProfile.name,
          rollNumber: values.rollNumber,
          department: values.department,
          year: parseInt(values.year),
          codechefUsername: values.codechefUrl,
          leetcodeUsername: values.leetcodeUrl,
          githubUsername: values.githubUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "Failed to update profile", "error");
      } else {
        showToast("Profile configured successfully! Syncing platform metrics...", "success");
        setTimeout(() => {
          router.replace(`/student/${userProfile.id}`);
        }, 1500);
      }
    } catch {
      showToast("Network Error: Could not save profile details.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col gap-3 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
        <span className="text-xs font-black text-[#A3A3A3] uppercase tracking-wider">Verifying session details...</span>
      </div>
    );
  }

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
              Complete Your Profile
            </div>
            <h1 className="text-2xl font-black tracking-tight text-brand-text">
              Welcome, {userProfile?.name}!
            </h1>
            <p className="text-xs text-brand-muted max-w-md mx-auto">
              Please provide your academic information and coding platform handles to access the dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
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

            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-[#0A0A0A] font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(234,179,8,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving profile...
                </>
              ) : (
                "Save Profile & Continue"
              )}
            </button>
          </form>

        </div>
      </motion.div>
    </div>
  );
}
