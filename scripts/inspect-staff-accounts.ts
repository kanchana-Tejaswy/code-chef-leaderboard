import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Staff User Access Accounts ===");
  const accounts = await prisma.userAccess.findMany({
    select: {
      email: true,
      role: true,
      departmentId: true,
      status: true
    }
  });
  console.log(JSON.stringify(accounts, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
