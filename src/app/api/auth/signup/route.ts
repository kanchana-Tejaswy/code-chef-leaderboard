import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { SyncService } from "@/services/sync.service";

// Helper to extract username from profile URLs
function extractUsername(input: string, platform: "codechef" | "leetcode" | "github"): string {
  if (!input) return "";
  const cleaned = input.trim();
  if (!cleaned.includes("/")) return cleaned; // It's already a username

  try {
    const url = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    const paths = url.pathname.split("/").filter(Boolean);
    if (platform === "codechef") {
      // https://www.codechef.com/users/username
      if (paths[0] === "users") return paths[1] || "";
      return paths[0] || "";
    } else if (platform === "leetcode") {
      // https://leetcode.com/u/username or https://leetcode.com/username
      if (paths[0] === "u") return paths[1] || "";
      return paths[0] || "";
    } else if (platform === "github") {
      // https://github.com/username
      return paths[0] || "";
    }
  } catch (e) {
    // If URL parsing fails, extract last segment manually
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || cleaned;
  }
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      rollNumber,
      department,
      year,
      codechefUrl,
      leetcodeUrl,
      githubUrl,
    } = body;

    // Basic Validation
    if (!name || !email || !password || !rollNumber || !department || !year) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const codechefUsername = extractUsername(codechefUrl || "", "codechef");
    const leetcodeUsername = extractUsername(leetcodeUrl || "", "leetcode");
    const githubUsername = extractUsername(githubUrl || "", "github");

    // 1. Check uniqueness of Roll Number
    const existingRoll = await prisma.studentProfile.findUnique({
      where: { rollNumber },
    });
    if (existingRoll) {
      return NextResponse.json({ error: "Roll Number is already registered." }, { status: 400 });
    }

    // 2. Check uniqueness of CodeChef Username
    if (codechefUsername) {
      const existingCc = await prisma.studentProfile.findUnique({
        where: { codechefUsername },
      });
      if (existingCc) {
        return NextResponse.json({ error: "CodeChef username is already linked to another student." }, { status: 400 });
      }
    }

    // 3. Check uniqueness of LeetCode Username
    if (leetcodeUsername) {
      const existingLc = await prisma.studentProfile.findUnique({
        where: { leetcodeUsername },
      });
      if (existingLc) {
        return NextResponse.json({ error: "LeetCode username is already linked to another student." }, { status: 400 });
      }
    }

    // 4. Check uniqueness of GitHub Username
    if (githubUsername) {
      const existingGh = await prisma.studentProfile.findUnique({
        where: { githubUsername },
      });
      if (existingGh) {
        return NextResponse.json({ error: "GitHub username is already linked to another student." }, { status: 400 });
      }
    }

    // Determine role based on email validation (GK Sir checks)
    const lowerEmail = email.toLowerCase();
    const isGK = lowerEmail === "gk@college.edu" || lowerEmail.includes("gksir");
    const role = isGK ? "ADMIN" : "STUDENT";

    // 5. Sign up user via Supabase Auth
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          department,
          year: parseInt(year),
          rollNumber,
        },
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Auth signup failed" }, { status: 400 });
    }

    const userId = authData.user.id;

    // 6. Create Profile record in database
    await prisma.profile.create({
      data: {
        id: userId,
        authUserId: userId,
        email,
        name,
        role,
        department,
        year: parseInt(year),
      },
    });

    // 7. Create StudentProfile record in database
    await prisma.studentProfile.create({
      data: {
        id: userId,
        name,
        rollNumber,
        department,
        year: parseInt(year),
        codechefUsername: codechefUsername || null,
        leetcodeUsername: leetcodeUsername || null,
        githubUsername: githubUsername || null,
      },
    });

    // 8. Trigger background stats sync
    if (codechefUsername || leetcodeUsername || githubUsername) {
      SyncService.syncStudent(userId, "USER_MANUAL")
        .then((res) => {
          if (res.success) {
            console.log(`Successfully completed initial sync for student ${userId}`);
          } else {
            console.error(`Initial sync failed for student ${userId}: ${res.error}`);
          }
        })
        .catch((err) => {
          console.error(`Sync error for student ${userId}:`, err);
        });
    }

    return NextResponse.json({
      success: true,
      message: "Student signed up successfully.",
      user: {
        id: userId,
        email,
        name,
        role: role.toLowerCase(),
      },
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: err.message || "Failed to complete signup" }, { status: 500 });
  }
}
