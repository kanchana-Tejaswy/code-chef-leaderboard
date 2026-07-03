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
export default function ContestPlatformCard({
  title,
  icon,
  description,
  href,
  gradientFrom,
  gradientTo,
}: ContestPlatformCardProps) {
  return (
    <Link href={href} legacyBehavior passHref>
      <motion.a
        className="relative flex flex-col items-center justify-center p-6 rounded-xl bg-card/30 border border-[#262626] backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all duration-200 overflow-hidden"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Gradient border */}
        <div className="absolute inset-0 rounded-xl opacity-30 pointer-events-none" style={{background: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})`}} />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <motion.div className="flex items-center gap-2 text-3xl" whileHover={{ rotate: 5 }}>
            {icon}
            <span className="font-bold text-white text-lg">{title}</span>
          </motion.div>
          <p className="text-sm text-[#A3A3A3] text-center">{description}</p>
        </div>
        {/* Hover glow effect */}
        <motion.span
          className="absolute inset-0 rounded-xl bg-white opacity-0 pointer-events-none"
          animate={{ opacity: 0 }}
          whileHover={{ opacity: 0.08, transition: { duration: 0.25 } }}
        />
      </motion.a>
    </Link>
  );
}
