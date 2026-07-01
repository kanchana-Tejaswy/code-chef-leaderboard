import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { CodechefScraper, LeetcodeScraper, GithubScraper } from "@/services/scraper.service";
import { ActivityService } from "@/services/activity.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, url, codechefUrl, leetcodeUrl, githubUrl, rollNumber, department, year, branch, section } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Student Name is required" }, { status: 400 });
    }

    // Determine URLs from request body (support original 'url' parameter as codechefUrl fallback)
    const targetCodechefUrl = codechefUrl || url;
    
    // Validate URLs and extract usernames
    const codechefScraper = new CodechefScraper();
    const leetcodeScraper = new LeetcodeScraper();
    const githubScraper = new GithubScraper();

    let codechefUsername: string | null = null;
    let leetcodeUsername: string | null = null;
    let githubUsername: string | null = null;

    if (targetCodechefUrl && targetCodechefUrl.trim()) {
      const validation = codechefScraper.validate(targetCodechefUrl);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error || "Invalid CodeChef URL" }, { status: 400 });
      }
      codechefUsername = validation.username;
    }

    if (leetcodeUrl && leetcodeUrl.trim()) {
      const validation = leetcodeScraper.validate(leetcodeUrl);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error || "Invalid LeetCode URL" }, { status: 400 });
      }
      leetcodeUsername = validation.username;
    }

    if (githubUrl && githubUrl.trim()) {
      const validation = githubScraper.validate(githubUrl);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error || "Invalid GitHub URL" }, { status: 400 });
      }
      githubUsername = validation.username;
    }

    if (!codechefUsername && !leetcodeUsername && !githubUsername) {
      return NextResponse.json({ error: "At least one platform profile URL is required (CodeChef, LeetCode, or GitHub)" }, { status: 400 });
    }

    let targetRollNumber = rollNumber ? rollNumber.trim().toUpperCase() : null;

    // Check if student already exists by roll number or usernames
    let student = null;
    if (targetRollNumber) {
      student = await prisma.studentProfile.findUnique({
        where: { rollNumber: targetRollNumber },
      });
    }

    if (!student && codechefUsername) {
      student = await prisma.studentProfile.findFirst({
        where: { codechefUsername },
      });
    }

    if (!student && leetcodeUsername) {
      student = await prisma.studentProfile.findFirst({
        where: { leetcodeUsername },
      });
    }

    if (!student && githubUsername) {
      student = await prisma.studentProfile.findFirst({
        where: { githubUsername },
      });
    }

    if (!student) {
      // Generate a mock unique roll number if not provided
      if (!targetRollNumber) {
        const randomSuffix = Math.floor(10 + Math.random() * 90);
        const baseRoll = `23AG1A05${randomSuffix}`;
        let roll = baseRoll;
        let checkDb = await prisma.studentProfile.findUnique({ where: { rollNumber: roll } });
        let attempts = 0;
        while (checkDb && attempts < 10) {
          const nextSuffix = Math.floor(10 + Math.random() * 90);
          roll = `23AG1A05${nextSuffix}`;
          checkDb = await prisma.studentProfile.findUnique({ where: { rollNumber: roll } });
          attempts++;
        }
        targetRollNumber = roll;
      } else {
        const checkRoll = await prisma.studentProfile.findUnique({ where: { rollNumber: targetRollNumber } });
        if (checkRoll) {
          return NextResponse.json({ error: "Roll number is already registered by another student." }, { status: 400 });
        }
      }

      // Create new student profile
      student = await prisma.studentProfile.create({
        data: {
          name: name.trim(),
          codechefUsername,
          leetcodeUsername,
          githubUsername,
          rollNumber: targetRollNumber,
          department: department ? department.trim() : "CSE",
          year: year ? parseInt(year, 10) : 3,
          branch: branch ? branch.trim() : (department ? department.trim() : "CSE"),
          section: section ? section.trim().toUpperCase() : "A",
        },
      });

      await ActivityService.logEvent(
        "STUDENT_ADD",
        student.id,
        `${name.trim()} (${student.department || "CSE"}) profile was registered.`
      );
    } else {
      // If student already exists, update details
      student = await prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          name: name.trim(),
          rollNumber: targetRollNumber ? targetRollNumber : student.rollNumber,
          department: department ? department.trim() : student.department,
          year: year ? parseInt(year, 10) : student.year,
          branch: branch ? branch.trim() : student.branch,
          section: section ? section.trim().toUpperCase() : student.section,
          codechefUsername: codechefUsername || student.codechefUsername,
          leetcodeUsername: leetcodeUsername || student.leetcodeUsername,
          githubUsername: githubUsername || student.githubUsername,
        },
      });

      await ActivityService.logEvent(
        "STUDENT_UPDATE",
        student.id,
        `${name.trim()} (${student.department || "CSE"}) details were updated.`
      );
    }

    // Trigger scraping and AI analysis using SyncService
    const syncResult = await SyncService.syncStudent(student.id, "USER_MANUAL");

    if (!syncResult.success) {
      return NextResponse.json({ error: syncResult.error || "Failed to analyze student profiles" }, { status: 500 });
    }

    const finalStudent = await prisma.studentProfile.findUnique({
      where: { id: student.id },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Student successfully analyzed.",
      student: finalStudent,
    });
  } catch (err: any) {
    console.error("Error in student analyze API:", err);
    return NextResponse.json({ error: "Internal server error: " + err.message }, { status: 500 });
  }
}
