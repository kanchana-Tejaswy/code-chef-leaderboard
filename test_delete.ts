import { prisma } from "./src/lib/prisma";

async function testDelete() {
  try {
    const student = await prisma.studentProfile.findFirst();
    if (!student) {
      console.log("No student found in DB.");
      return;
    }
    console.log("Found student:", student.name, "ID:", student.id);
    
    // Try to delete
    console.log("Attempting deletion...");
    const deleted = await prisma.studentProfile.delete({
      where: { id: student.id }
    });
    console.log("Deleted student profile successfully! Name:", deleted.name);
  } catch (err: any) {
    console.error("Prisma deletion failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDelete();
