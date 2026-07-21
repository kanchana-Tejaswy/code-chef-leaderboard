import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const anyStudent = await prisma.studentProfile.findFirst();
    if (!anyStudent) {
      console.log("No student found");
      return;
    }
    const studentId = anyStudent.id;
    console.log("Found student ID:", studentId);

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    console.log("Successfully fetched detailed profile.");
    console.log(student);
  } catch (error) {
    console.error("Prisma error:", error);
  } finally {
    // skip disconnect due to proxy
  }
}

main();
