import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding started...");

  // Create Students and their profiles
  const studentData = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Abhinav Reddy",
      rollNumber: "23AG1A0501",
      department: "CSE",
      year: 3,
      branch: "CSE",
      section: "A",
      codechefUsername: "tourist",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Bhavana Rao",
      rollNumber: "23AG1A0502",
      department: "CSE",
      year: 3,
      branch: "CSE",
      section: "B",
      codechefUsername: "tanmay1402",
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Charan Kumar",
      rollNumber: "23AG1A1201",
      department: "IT",
      year: 3,
      branch: "IT",
      section: "A",
      codechefUsername: "utkarsh_256",
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Divya Teja",
      rollNumber: "24AG1A6601",
      department: "CSM",
      year: 2,
      branch: "CSM",
      section: "A",
      codechefUsername: "chef",
    },
  ];

  for (const s of studentData) {
    await prisma.studentProfile.upsert({
      where: { codechefUsername: s.codechefUsername },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        department: s.department,
        year: s.year,
        branch: s.branch,
        section: s.section,
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
