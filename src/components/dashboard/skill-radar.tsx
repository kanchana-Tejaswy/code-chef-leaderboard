"use client";

import React, { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface SkillRadarProps {
  aiAnalysis: {
    talentScore: number;
    consistencyScore: number;
    problemSolvingScore: number;
    competitiveProgrammingScore: number;
  } | null;
  stars: number;
  contestCount: number;
}

export function SkillRadar({ aiAnalysis, stars, contestCount }: SkillRadarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-zinc-950/20 rounded-xl border border-white/5">
        <span className="text-xs text-zinc-500 font-medium">Preparing skill analysis...</span>
      </div>
    );
  }

  // Fallbacks if no AI analysis exists
  const cpScore = aiAnalysis?.competitiveProgrammingScore ?? 0;
  const psScore = aiAnalysis?.problemSolvingScore ?? 0;
  const consistencyScore = aiAnalysis?.consistencyScore ?? 0;
  
  // Normalization formulas (capped at 100)
  const starsNormalized = Math.min(100, Math.round((stars / 7) * 100));
  const contestNormalized = Math.min(100, Math.round((contestCount / 30) * 100));

  const data = [
    {
      subject: "Competitive Programming",
      value: Math.round(cpScore),
      fullMark: 100,
    },
    {
      subject: "Problem Solving",
      value: Math.round(psScore),
      fullMark: 100,
    },
    {
      subject: "Consistency",
      value: Math.round(consistencyScore),
      fullMark: 100,
    },
    {
      subject: "Stars Tier",
      value: starsNormalized,
      fullMark: 100,
      raw: `${stars} ★`,
    },
    {
      subject: "Contest Volume",
      value: contestNormalized,
      fullMark: 100,
      raw: `${contestCount} contests`,
    },
  ];

  return (
    <div className="h-64 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="var(--brand-border)" />
          <PolarAngleAxis
            dataKey="subject"
            stroke="var(--chart-axis)"
            fontSize={9}
            fontWeight="bold"
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            stroke="var(--chart-axis)"
            fontSize={8}
            tick={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const dataPoint = payload[0].payload;
                return (
                  <div className="glass-panel p-2.5 rounded-xl border border-brand-border shadow-xl text-left">
                    <p className="text-[10px] font-bold text-[#EAB308] uppercase tracking-wider mb-0.5">
                      {dataPoint.subject}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-white">
                        {dataPoint.value}%
                      </span>
                      {dataPoint.raw && (
                        <span className="text-[10px] text-brand-muted font-semibold">
                          ({dataPoint.raw})
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Radar
            name="Skills"
            dataKey="value"
            stroke="#FACC15"
            fill="#EAB308"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SkillRadar;
