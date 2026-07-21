import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { ActivityService } from "@/services/activity.service";
import crypto from "crypto";
import { canPerformWrite, canPerformDelete } from "@/lib/write-access";
import { normalizeAndValidateUrl } from "@/utils/urlValidation";
import { revalidatePath } from "next/cache";

import { requireStudentProfileReadAccess, requireStudentWriteAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("id") || searchParams.get("userId") || searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    await requireStudentProfileReadAccess(studentId);

    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("Error fetching profile API:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStudentWriteAccess();
    
    const body = await request.json();
    const {
      name,
      rollNumber,
      roll_number,
      department,
      year,
      branch,
      section,
      codechefUsername,
      codechef_username,
      leetcodeUsername,
      leetcode_username,
      githubUsername,
      github_username,
      linkedinUrl,
      linkedin_url,
      profilePictureUrl,
      profile_picture_url
    } = body;

    const normalizedName = name ? String(name).trim() : null;
    const normalizedRollNumber = (rollNumber || roll_number) ? String(rollNumber || roll_number).trim().toUpperCase() : null;
    const normalizedDepartment = department ? String(department).trim() : "CSE";
    const normalizedYear = year ? parseInt(String(year), 10) : 3;
    const normalizedBranch = branch ? String(branch).trim() : normalizedDepartment;
    const normalizedSection = section ? String(section).trim().toUpperCase() : "A";
    const normalizedCodechef = (codechefUsername || codechef_username) ? String(codechefUsername || codechef_username).trim() : null;
    const normalizedLeetcode = (leetcodeUsername || leetcode_username) ? String(leetcodeUsername || leetcode_username).trim() : null;
    
    const { isValid: isGhValid, normalizedUrl: normalizedGithub, error: ghError } = normalizeAndValidateUrl(githubUsername || github_username, "github");
    const { isValid: isLnValid, normalizedUrl: normalizedLinkedin, error: lnError } = normalizeAndValidateUrl(linkedinUrl || linkedin_url, "linkedin");
    
    const normalizedPicUrl = (profilePictureUrl || profile_picture_url) ? String(profilePictureUrl || profile_picture_url).trim() : null;

    if (!normalizedName) {
      return NextResponse.json({ error: "Student Name is required." }, { status: 400 });
    }

    if (!isGhValid && ghError) {
      return NextResponse.json({ error: ghError }, { status: 400 });
    }
    if (!isLnValid && lnError) {
      return NextResponse.json({ error: lnError }, { status: 400 });
    }

    if (isNaN(normalizedYear) || normalizedYear < 1 || normalizedYear > 4) {
      return NextResponse.json({ error: "Academic year must be between 1 and 4." }, { status: 400 });
    }

    const targetId = crypto.randomUUID();
    const isCloudTest = normalizedRollNumber === "CLOUDTEST001";

    // Check unique constraints
    if (normalizedRollNumber) {
      const existingRoll = await prisma.studentProfile.findFirst({
        where: {
          rollNumber: { equals: normalizedRollNumber },
          id: { not: targetId },
        },
      });

      if (existingRoll) {
        return NextResponse.json(
          { error: "Roll number is already registered by another student." },
          { status: 400 }
        );
      }
    }

    if (normalizedCodechef) {
      const existingCC = await prisma.studentProfile.findFirst({
        where: {
          codechefUsername: { equals: normalizedCodechef },
          id: { not: targetId },
        },
      });

      if (existingCC) {
        return NextResponse.json(
          { error: "CodeChef username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    if (normalizedLeetcode) {
      const existingLC = await prisma.studentProfile.findFirst({
        where: {
          leetcodeUsername: { equals: normalizedLeetcode },
          id: { not: targetId },
        },
      });

      if (existingLC) {
        return NextResponse.json(
          { error: "LeetCode username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    if (normalizedGithub) {
      const existingGH = await prisma.studentProfile.findFirst({
        where: {
          githubUsername: { equals: normalizedGithub },
          id: { not: targetId },
        },
      });

      if (existingGH) {
        return NextResponse.json(
          { error: "GitHub username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    const profile = await prisma.studentProfile.create({
      data: {
        id: targetId,
        name: normalizedName,
        rollNumber: normalizedRollNumber,
        department: normalizedDepartment,
        year: normalizedYear,
        branch: normalizedBranch,
        section: normalizedSection,
        codechefUsername: normalizedCodechef,
        leetcodeUsername: normalizedLeetcode,
        githubUsername: normalizedGithub,
        linkedinUrl: normalizedLinkedin,
        profilePictureUrl: normalizedPicUrl,
        verificationStatus: "UNABLE_TO_VERIFY",
        leaderboardEntry: {
          create: {
            rank: 0,
            rating: 0,
            stars: 1,
            talentScore: 0,
            overallScore: 0,
            codechefScore: 0,
            leetcodeScore: 0,
            trendDirection: "UP",
          }
        }
      },
    });

    if (isCloudTest) {
      console.log(`[Sanitized Log] [CLOUDTEST001] Student profile created in DB. ID: ${profile.id}`);
    }

    await ActivityService.logEvent(
      "STUDENT_ADD",
      profile.id,
      `${normalizedName} (${profile.department || "CSE"}) profile was registered.`
    );

    // Sync using Next.js after() to safely execute in the background without orphaning transactions
    after(async () => {
      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Background sync starting...`);
      }
      try {
        const syncRes = await SyncService.syncStudent(profile.id, "USER_MANUAL");
        if (isCloudTest) {
          console.log(`[Sanitized Log] [CLOUDTEST001] Background sync ended. Success: ${syncRes.success}, Error: ${syncRes.error || "None"}`);
        }
        // Recalculate ranks after sync completes
        await SyncService.recalculateLeaderboardRanks();
      } catch (err) {
        console.error("Background sync error:", err);
      }
    });

    // Reread saved row from DB before returning success
    const finalProfile = await prisma.studentProfile.findUnique({
      where: { id: profile.id },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    if (isCloudTest) {
      console.log(`[Sanitized Log] [CLOUDTEST001] Reread profile successfully: ${finalProfile ? "YES" : "NO"}`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    revalidatePath("/analytics");
    revalidatePath("/departments");
    revalidatePath("/api/dashboard/stats");
    revalidatePath("/api/dashboard/leaderboard-cache");
    revalidatePath("/api/leaderboard");

    return NextResponse.json({ success: true, profile: finalProfile });
  } catch (err: any) {
    console.error("Error creating profile API:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStudentWriteAccess();
    const body = await request.json();
    const id = body.id || body.studentId || body.userId;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    const currentProfile = await prisma.studentProfile.findUnique({
      where: { id },
    });

    if (!currentProfile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const updateData: any = {};

    // Validate and sanitize modifiable fields if they are in the body
    if (body.hasOwnProperty("name")) {
      const name = body.name ? String(body.name).trim() : "";
      if (!name) {
        return NextResponse.json({ error: "Student Name is required." }, { status: 400 });
      }
      updateData.name = name;
    }

    if (body.hasOwnProperty("rollNumber") || body.hasOwnProperty("roll_number")) {
      const rawRoll = body.hasOwnProperty("rollNumber") ? body.rollNumber : body.roll_number;
      const roll = rawRoll ? String(rawRoll).trim().toUpperCase() : null;
      
      if (roll) {
        const existingRoll = await prisma.studentProfile.findFirst({
          where: {
            rollNumber: { equals: roll },
            id: { not: id },
          },
        });
        if (existingRoll) {
          return NextResponse.json({ error: "Roll number is already registered by another student." }, { status: 400 });
        }
      }
      updateData.rollNumber = roll;
    }

    if (body.hasOwnProperty("department")) {
      updateData.department = body.department ? String(body.department).trim() : "CSE";
    }

    if (body.hasOwnProperty("year")) {
      const year = parseInt(String(body.year), 10);
      if (isNaN(year) || year < 1 || year > 4) {
        return NextResponse.json({ error: "Academic year must be between 1 and 4." }, { status: 400 });
      }
      updateData.year = year;
    }

    if (body.hasOwnProperty("branch")) {
      updateData.branch = body.branch ? String(body.branch).trim() : null;
    }

    if (body.hasOwnProperty("section")) {
      updateData.section = body.section ? String(body.section).trim().toUpperCase() : null;
    }

    if (body.hasOwnProperty("profilePictureUrl") || body.hasOwnProperty("profile_picture_url")) {
      const pic = body.hasOwnProperty("profilePictureUrl") ? body.profilePictureUrl : body.profile_picture_url;
      updateData.profilePictureUrl = pic ? String(pic).trim() : null;
    }

    if (body.hasOwnProperty("linkedinUrl") || body.hasOwnProperty("linkedin_url")) {
      const linked = body.hasOwnProperty("linkedinUrl") ? body.linkedinUrl : body.linkedin_url;
      const { isValid: isLnValid, normalizedUrl: lnUrl, error: lnError } = normalizeAndValidateUrl(linked, "linkedin");
      if (!isLnValid && lnError) {
        return NextResponse.json({ error: lnError }, { status: 400 });
      }
      updateData.linkedinUrl = lnUrl;
    }

    let usernamesChanged = false;

    if (body.hasOwnProperty("codechefUsername") || body.hasOwnProperty("codechef_username")) {
      const cc = body.hasOwnProperty("codechefUsername") ? body.codechefUsername : body.codechef_username;
      const ccUser = cc ? String(cc).trim() : null;
      if (ccUser) {
        const existingCC = await prisma.studentProfile.findFirst({
          where: { codechefUsername: { equals: ccUser }, id: { not: id } },
        });
        if (existingCC) {
          return NextResponse.json({ error: "CodeChef username is already linked to another student." }, { status: 400 });
        }
      }
      if (ccUser !== currentProfile.codechefUsername) {
        usernamesChanged = true;
      }
      updateData.codechefUsername = ccUser;
    }

    if (body.hasOwnProperty("leetcodeUsername") || body.hasOwnProperty("leetcode_username")) {
      const lc = body.hasOwnProperty("leetcodeUsername") ? body.leetcodeUsername : body.leetcode_username;
      const lcUser = lc ? String(lc).trim() : null;
      if (lcUser) {
        const existingLC = await prisma.studentProfile.findFirst({
          where: { leetcodeUsername: { equals: lcUser }, id: { not: id } },
        });
        if (existingLC) {
          return NextResponse.json({ error: "LeetCode username is already linked to another student." }, { status: 400 });
        }
      }
      if (lcUser !== currentProfile.leetcodeUsername) {
        usernamesChanged = true;
      }
      updateData.leetcodeUsername = lcUser;
    }

    if (body.hasOwnProperty("githubUsername") || body.hasOwnProperty("github_username")) {
      const gh = body.hasOwnProperty("githubUsername") ? body.githubUsername : body.github_username;
      const { isValid: isGhValid, normalizedUrl: ghUser, error: ghError } = normalizeAndValidateUrl(gh, "github");
      if (!isGhValid && ghError) {
        return NextResponse.json({ error: ghError }, { status: 400 });
      }
      if (ghUser) {
        const existingGH = await prisma.studentProfile.findFirst({
          where: { githubUsername: { equals: ghUser }, id: { not: id } },
        });
        if (existingGH) {
          return NextResponse.json({ error: "GitHub URL is already linked to another student." }, { status: 400 });
        }
      }
      if (ghUser !== currentProfile.githubUsername) {
        usernamesChanged = true;
      }
      updateData.githubUsername = ghUser;
    }

    // Ignore calculated fields directly
    const ignoredFields = ["rank", "rating", "stars", "talentScore", "talent_score", "overallScore", "overall_score", "codechefScore", "codechef_score", "leetcodeScore", "leetcode_score", "githubScore", "github_score"];
    ignoredFields.forEach((field) => {
      delete updateData[field];
    });

    // Mark verificationStatus appropriately if usernames changed
    if (usernamesChanged) {
      const existingCc = await prisma.codechefProfile.findUnique({ where: { studentId: id } });
      const existingLc = await prisma.leetcodeProfile.findUnique({ where: { studentId: id } });

      const finalCodechef = updateData.hasOwnProperty("codechefUsername") ? updateData.codechefUsername : currentProfile.codechefUsername;
      const finalLeetcode = updateData.hasOwnProperty("leetcodeUsername") ? updateData.leetcodeUsername : currentProfile.leetcodeUsername;

      const ccVerified = finalCodechef && existingCc && existingCc.username.toLowerCase() === finalCodechef.toLowerCase();
      const lcVerified = finalLeetcode && existingLc && existingLc.username.toLowerCase() === finalLeetcode.toLowerCase();

      const configuredCount = [finalCodechef, finalLeetcode].filter(Boolean).length;
      const verifiedCount = [ccVerified, lcVerified].filter(Boolean).length;

      let newStatus = "UNABLE_TO_VERIFY";
      if (configuredCount > 0) {
        if (verifiedCount === configuredCount) {
          newStatus = "VERIFIED";
        } else if (verifiedCount > 0) {
          newStatus = "PARTIAL";
        } else {
          newStatus = "UNABLE_TO_VERIFY";
        }
      }
      updateData.verificationStatus = newStatus;
    }

    const updatedProfile = await prisma.studentProfile.update({
      where: { id },
      data: updateData,
    });

    await ActivityService.logEvent(
      "STUDENT_UPDATE",
      id,
      `${updatedProfile.name} details were updated.`
    );

    // Trigger background sync safely using after()
    const shouldSync = body.sync === true || body.autoSync === true || (usernamesChanged && (body.sync !== false && body.autoSync !== false));
    if (shouldSync && (updatedProfile.codechefUsername || updatedProfile.leetcodeUsername)) {
      after(async () => {
        try {
          const syncRes = await SyncService.syncStudent(id, "USER_MANUAL");
          if (!syncRes.success) {
            console.error(`Background update sync failed: ${syncRes.error}`);
          } else {
            console.log(`Background update sync succeeded for student ${id}`);
          }
          // Recalculate ranks after background sync
          await SyncService.recalculateLeaderboardRanks();
        } catch (e) {
          console.error("Sync error:", e);
        }
      });
    } else {
      // Recalculate ranks immediately if not syncing
      await SyncService.recalculateLeaderboardRanks();
    }

    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    revalidatePath("/analytics");
    revalidatePath("/departments");
    revalidatePath("/api/dashboard/stats");
    revalidatePath("/api/dashboard/leaderboard-cache");
    revalidatePath("/api/leaderboard");

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    console.error("Error updating profile API (PATCH):", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireStudentWriteAccess();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id") || searchParams.get("studentId") || searchParams.get("userId");

    if (!studentId) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    await prisma.studentProfile.delete({
      where: { id: studentId },
    });

    return NextResponse.json({ success: true, deletedId: studentId });
  } catch (err: any) {
    console.error("Error deleting profile API:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
