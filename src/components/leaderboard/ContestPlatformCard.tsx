'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ContestPlatformCardProps {
  title: string;
  icon: ReactNode;
  description: string;
  href: string;
  /** Tailwind color class for gradient start */
  gradientFrom: string;
  /** Tailwind color class for gradient end */
  gradientTo: string;
}

/**
 * A glassmorphic card representing a contest platform.
 * Includes hover glow, slight scale, and icon rotation animation.
 */
const MotionDiv = motion.div as any;
const MotionSpan = motion.span as any;

export default function ContestPlatformCard({
  title,
  icon,
  description,
  href,
  gradientFrom,
  gradientTo,
}: ContestPlatformCardProps) {
  return (
    <Link href={href} className="block w-full min-w-0 no-underline">
      <MotionDiv
        className="relative flex w-full min-w-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-all duration-200 overflow-hidden cursor-pointer dark:border-[#262626] dark:bg-card/30 dark:shadow-[0_4px_12px_rgba(0,0,0,0.4)] sm:p-6"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Gradient border */}
        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-30" style={{ background: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})` }} />
        <div className="relative z-10 flex w-full min-w-0 flex-col items-center gap-2 text-center sm:gap-3">
          <MotionDiv className="flex min-w-0 items-center justify-center gap-2 text-2xl sm:text-3xl" whileHover={{ rotate: 5 }}>
            {icon}
            <span className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">{title}</span>
          </MotionDiv>
          <p className="text-sm text-slate-500 dark:text-[#A3A3A3] text-center break-words">{description}</p>
        </div>
        {/* Hover glow effect */}
        <MotionSpan
          className="pointer-events-none absolute inset-0 rounded-xl bg-white opacity-0"
          animate={{ opacity: 0 }}
          whileHover={{ opacity: 0.08, transition: { duration: 0.25 } }}
        />
      </MotionDiv>
    </Link>
  );
}
