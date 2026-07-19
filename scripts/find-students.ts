import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
process.env.NODE_ENV = "production";

import { prisma } from "../src/lib/prisma";

async function main() {
  const students = await prisma.studentProfile.findMany({
    where: {
      name: {
        in: ["AJAY KOMIRISHETTI", "Samatha Gangavarapu"]
      }
    }
  });
  console.log(JSON.stringify(students, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
