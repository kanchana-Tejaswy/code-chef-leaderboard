import { prisma } from "../src/lib/prisma";
import { Role } from "@prisma/client";

async function main() {
  console.log("Seeding started...");

  // 1. Create Admins, Faculty, Placement Officer
  const adminId = "99999999-9999-9999-9999-999999999999";
  const facultyId = "88888888-8888-8888-8888-888888888888";
  const placementId = "77777777-7777-7777-7777-777777777777";

  const admin = await prisma.user.upsert({
    where: { email: "admin@ace.edu" },
    update: {},
    create: {
      id: adminId,
      email: "admin@ace.edu",
      role: Role.ADMIN,
    },
  });

  const faculty = await prisma.user.upsert({
    where: { email: "faculty@ace.edu" },
    update: {},
    create: {
      id: facultyId,
      email: "faculty@ace.edu",
      role: Role.FACULTY,
    },
  });

  const placement = await prisma.user.upsert({
    where: { email: "placement@ace.edu" },
    update: {},
    create: {
      id: placementId,
      email: "placement@ace.edu",
      role: Role.PLACEMENT_OFFICER,
    },
  });

  // 2. Create Students and their profiles
  const studentData = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      email: "student1@ace.edu",
      name: "Abhinav Reddy",
      rollNumber: "23AG1A0501",
      department: "CSE",
      year: 3,
      codechefUsername: "tourist",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      email: "student2@ace.edu",
      name: "Bhavana Rao",
      rollNumber: "23AG1A0502",
      department: "CSE",
      year: 3,
      codechefUsername: "tanmay1402",
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      email: "student3@ace.edu",
      name: "Charan Kumar",
      rollNumber: "23AG1A1201",
      department: "IT",
      year: 3,
      codechefUsername: "utkarsh_256",
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      email: "student4@ace.edu",
      name: "Divya Teja",
      rollNumber: "24AG1A6601",
      department: "CSM",
      year: 2,
      codechefUsername: "chef",
    },
  ];

  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        id: s.id,
        email: s.email,
        role: Role.STUDENT,
      },
    });

    await prisma.studentProfile.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        department: s.department,
        year: s.year,
        codechefUsername: s.codechefUsername,
      },
    });

    console.log(`Created student: ${s.name} (${s.codechefUsername})`);
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
