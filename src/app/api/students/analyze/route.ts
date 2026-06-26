import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { CodechefScraper } from "@/services/scraper.service";
import { ActivityService } from "@/services/activity.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, url, rollNumber, department, year, branch, section } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Student Name is required" }, { status: 400 });
    }

    if (!url || !url.trim()) {
      return NextResponse.json({ error: "CodeChef Profile URL is required" }, { status: 400 });
    }

    // Validate URL and extract username
    const scraper = new CodechefScraper();
    const validation = scraper.validate(url);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error || "Invalid CodeChef URL" }, { status: 400 });
    }
    const username = validation.username;

    // Check if a student with this username already exists
    let student = await prisma.studentProfile.findUnique({
      where: { codechefUsername: username },
    });

    let targetRollNumber = rollNumber ? rollNumber.trim().toUpperCase() : null;

    if (!student) {
      // If a roll number was provided, verify it is not taken
      if (targetRollNumber) {
        const checkRoll = await prisma.studentProfile.findUnique({ where: { rollNumber: targetRollNumber } });
        if (checkRoll) {
          return NextResponse.json({ error: "Roll number is already registered by another student." }, { status: 400 });
        }
      } else {
        // Generate a mock unique roll number if not provided
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
      }

      // Create new student profile with academic metadata
      student = await prisma.studentProfile.create({
        data: {
          name: name.trim(),
          codechefUsername: username,
          rollNumber: targetRollNumber,
          department: department ? department.trim() : "CSE",
          year: year ? parseInt(year, 10) : 3,
          branch: branch ? branch.trim() : (department ? department.trim() : "CSE"),
          section: section ? section.trim().toUpperCase() : "A",
        },
      });

      // Log Student Add Event
      await ActivityService.logEvent(
        "STUDENT_ADD",
        student.id,
        `${name.trim()} (${student.department || "CSE"}) profile was registered.`
      );
    } else {
      // If student already exists, update name and any provided metadata
      student = await prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          name: name.trim(),
          rollNumber: targetRollNumber ? targetRollNumber : student.rollNumber,
          department: department ? department.trim() : student.department,
          year: year ? parseInt(year, 10) : student.year,
          branch: branch ? branch.trim() : student.branch,
          section: section ? section.trim().toUpperCase() : student.section,
        },
      });

      // Log Student Update/Re-analyze Event
      await ActivityService.logEvent(
        "STUDENT_UPDATE",
        student.id,
        `${name.trim()} (${student.department || "CSE"}) details were updated.`
      );
    }

    // Trigger scraping and AI analysis using SyncService
    const syncResult = await SyncService.syncStudent(student.id, "USER_MANUAL");

    if (!syncResult.success) {
      return NextResponse.json({ error: syncResult.error || "Failed to analyze student CodeChef profile" }, { status: 500 });
    }

    // Fetch final fully-analyzed student profile with all relations to return
    const finalStudent = await prisma.studentProfile.findUnique({
      where: { id: student.id },
      include: {
        codechefProfile: true,
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
