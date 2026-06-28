"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RatingChartProps {
  contests: {
    code: string;
    name: string;
    rating: number;
    rank: number;
    date: string;
  }[];
}

export function RatingChart({ contests }: RatingChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-zinc-950/20 rounded-xl border border-white/5">
        <span className="text-xs text-zinc-500 font-medium">Preparing rating chart...</span>
      </div>
    );
  }

  if (!contests || contests.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-zinc-950/20 rounded-xl border border-white/5 text-center p-6">
        <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
          No contest participation data found. Once you participate in contests, your rating trend will appear here.
        </p>
      </div>
    );
  }

  // Format date and sort contests by date chronological
  const data = contests
    .map((c) => ({
      name: c.code,
      rating: c.rating,
      date: new Date(c.date).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      fullName: c.name,
      rank: c.rank,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EAB308" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--chart-axis)"
            fontSize={10}
            fontWeight="bold"
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="var(--chart-axis)"
            fontSize={10}
            fontWeight="bold"
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 100", "dataMax + 100"]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const dataPoint = payload[0].payload;
                return (
                  <div className="glass-panel p-3.5 rounded-xl border border-brand-border shadow-xl text-left">
                    <p className="text-[10px] font-bold text-[#EAB308] uppercase tracking-wider mb-1">
                      {dataPoint.name}
                    </p>
                    <p className="text-xs font-bold text-white mb-2 leading-tight">
                      {dataPoint.fullName}
                    </p>
                    <div className="flex gap-4 text-xs font-semibold">
                      <div>
                        <span className="text-brand-muted">Rating: </span>
                        <span className="text-white">{dataPoint.rating}</span>
                      </div>
                      <div>
                        <span className="text-brand-muted">Rank: </span>
                        <span className="text-white">#{dataPoint.rank}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="#EAB308"
            strokeWidth={3}
            dot={{ r: 4, stroke: "var(--brand-bg)", strokeWidth: 2, fill: "#FACC15" }}
            activeDot={{ r: 6, stroke: "#EAB308", strokeWidth: 2, fill: "#ffffff" }}
            fill="url(#colorRating)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export default RatingChart;
