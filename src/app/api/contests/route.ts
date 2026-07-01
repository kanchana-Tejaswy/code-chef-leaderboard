import { NextResponse } from "next/server";

// Simple in-memory cache
let cachedContests: any[] = [];
let lastFetched = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function parseCodeChefDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("Z") || dateStr.includes("+") || dateStr.includes("T")) {
    return new Date(dateStr);
  }
  const clean = dateStr.trim().replace(" ", "T");
  const hasOffset = /[-+]\d{2}:?\d{2}$/.test(clean);
  const withOffset = hasOffset ? clean : `${clean}+05:30`;
  const parsed = new Date(withOffset);
  return isNaN(parsed.getTime()) ? new Date(dateStr) : parsed;
}

function getCodeChefType(code: string, name: string): string {
  const n = (name || "").toLowerCase();
  const c = (code || "").toLowerCase();
  if (n.includes("starters") || n.includes("cook-off") || n.includes("lunchtime") || c.includes("start") || c.includes("cook") || c.includes("ltime")) {
    return "Rated";
  }
  return "Unrated";
}

async function fetchCodeChefContests(): Promise<any[]> {
  try {
    const res = await fetch("https://www.codechef.com/api/list/contests/all", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      next: { revalidate: 600 }
    });

    if (!res.ok) {
      throw new Error(`CodeChef response error: ${res.status}`);
    }

    const data = await res.json();
    const contests: any[] = [];

    // Parse present (live) contests
    if (Array.isArray(data.present_contests)) {
      data.present_contests.forEach((c: any) => {
        const start = parseCodeChefDate(c.contest_start_date);
        const end = parseCodeChefDate(c.contest_end_date);
        const duration = parseInt(c.contest_duration) || 120;
        contests.push({
          id: `codechef-${c.contest_code}`,
          platform: "codechef",
          name: c.contest_name || c.contest_code,
          type: getCodeChefType(c.contest_code, c.contest_name),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          duration,
          link: `https://www.codechef.com/${c.contest_code}`,
          status: "LIVE"
        });
      });
    }

    // Parse future (upcoming) contests
    if (Array.isArray(data.future_contests)) {
      data.future_contests.forEach((c: any) => {
        const start = parseCodeChefDate(c.contest_start_date);
        const end = parseCodeChefDate(c.contest_end_date);
        const duration = parseInt(c.contest_duration) || 120;
        contests.push({
          id: `codechef-${c.contest_code}`,
          platform: "codechef",
          name: c.contest_name || c.contest_code,
          type: getCodeChefType(c.contest_code, c.contest_name),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          duration,
          link: `https://www.codechef.com/${c.contest_code}`,
          status: "UPCOMING"
        });
      });
    }

    return contests;
  } catch (err: any) {
    console.warn("Failed to fetch CodeChef official contests, trying public fallback:", err.message);
    try {
      const fallbackRes = await fetch("https://kontests.net/api/v1/codechef", {
        next: { revalidate: 600 }
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return fallbackData.map((c: any) => {
          const start = new Date(c.start_time);
          const end = new Date(c.end_time);
          const duration = Math.round(parseFloat(c.duration) / 60) || 120;
          const now = new Date();
          const status = now >= start && now <= end ? "LIVE" : "UPCOMING";
          return {
            id: `codechef-${c.name.replace(/\s+/g, "-")}`,
            platform: "codechef",
            name: c.name,
            type: getCodeChefType(c.name, c.name),
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            duration,
            link: c.url || "https://www.codechef.com",
            status
          };
        });
      }
    } catch (fallbackErr: any) {
      console.error("CodeChef fallback also failed:", fallbackErr.message);
    }
    return [];
  }
}

async function fetchLeetCodeContests(): Promise<any[]> {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        query: `
          query {
            allContests {
              title
              titleSlug
              startTime
              duration
            }
          }
        `
      }),
      next: { revalidate: 600 }
    });

    if (!res.ok) {
      throw new Error(`LeetCode response error: ${res.status}`);
    }

    const data = await res.json();
    const allContests = data.data?.allContests || [];
    const nowSec = Math.floor(Date.now() / 1000);
    
    const activeContests = allContests.filter((c: any) => {
      const endTimeSec = c.startTime + c.duration;
      return endTimeSec >= nowSec;
    });

    return activeContests.map((c: any) => {
      const startMs = c.startTime * 1000;
      const endMs = startMs + c.duration * 1000;
      const start = new Date(startMs);
      const end = new Date(endMs);
      const duration = Math.round(c.duration / 60);
      const now = new Date();
      const status = now >= start && now <= end ? "LIVE" : "UPCOMING";
      const isWeeklyOrBiweekly = c.titleSlug.includes("weekly") || c.titleSlug.includes("biweekly");
      return {
        id: `leetcode-${c.titleSlug}`,
        platform: "leetcode",
        name: c.title,
        type: isWeeklyOrBiweekly ? "Rated" : "Unrated",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration,
        link: `https://leetcode.com/contest/${c.titleSlug}`,
        status
      };
    });
  } catch (err: any) {
    console.warn("Failed to fetch LeetCode official contests, trying public fallback:", err.message);
    try {
      const fallbackRes = await fetch("https://kontests.net/api/v1/leetcode", {
        next: { revalidate: 600 }
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return fallbackData.map((c: any) => {
          const start = new Date(c.start_time);
          const end = new Date(c.end_time);
          const duration = Math.round(parseFloat(c.duration) / 60) || 90;
          const now = new Date();
          const status = now >= start && now <= end ? "LIVE" : "UPCOMING";
          const nameLower = c.name.toLowerCase();
          const isWeeklyOrBiweekly = nameLower.includes("weekly") || nameLower.includes("biweekly");
          return {
            id: `leetcode-${c.name.replace(/\s+/g, "-")}`,
            platform: "leetcode",
            name: c.name,
            type: isWeeklyOrBiweekly ? "Rated" : "Unrated",
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            duration,
            link: c.url || "https://leetcode.com/contest",
            status
          };
        });
      }
    } catch (fallbackErr: any) {
      console.error("LeetCode fallback also failed:", fallbackErr.message);
    }
    return [];
  }
}

export async function GET() {
  const now = Date.now();
  if (now - lastFetched < CACHE_DURATION && cachedContests.length > 0) {
    return NextResponse.json({ success: true, contests: cachedContests });
  }

  try {
    const [codechef, leetcode] = await Promise.all([
      fetchCodeChefContests().catch(() => []),
      fetchLeetCodeContests().catch(() => [])
    ]);

    const combined = [...codechef, ...leetcode];

    // Sort by startTime
    combined.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Update Cache
    cachedContests = combined;
    lastFetched = now;

    return NextResponse.json({ success: true, contests: combined });
  } catch (error: any) {
    console.error("Contests aggregation failed:", error);
    return NextResponse.json({ success: false, contests: cachedContests, error: error.message });
  }
}
