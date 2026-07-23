import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function setAdminPassword() {
  const args = process.argv.slice(2);
  const passArg = args.find(a => a.startsWith("--password="));
  const password = passArg ? passArg.split("=")[1] : process.env.ADMIN_INITIAL_PASSWORD;

  if (!password || password.length < 8) {
    console.error("Error: Provide a valid password with --password=YOUR_PASSWORD (min 8 characters)");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Error: Missing Supabase Admin credentials.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const email = "mail2tejaswy@gmail.com";
  console.log(`Setting password for Admin account: ${email}...`);

  // 1. Get Supabase auth user
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Error listing Supabase users:", listErr);
    process.exit(1);
  }

  const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!targetUser) {
    console.error(`Error: Supabase user with email ${email} not found.`);
    process.exit(1);
  }

  // 2. Update password in Supabase Auth
  const { error: updateErr } = await supabase.auth.admin.updateUserById(targetUser.id, {
    password: password,
    email_confirm: true,
  });

  if (updateErr) {
    console.error("Error updating Supabase auth password:", updateErr);
    process.exit(1);
  }

  console.log(`Supabase Auth password successfully updated for user ID ${targetUser.id}.`);

  // 3. Update UserAccess status to ACTIVE in database via Supabase REST or Prisma
  const { error: dbErr } = await supabase
    .from("user_access")
    .update({
      status: "ACTIVE",
      must_set_password: false,
      first_login_completed: true,
      password_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  if (dbErr) {
    console.error("Error updating database UserAccess status:", dbErr);
    process.exit(1);
  }

  console.log(`UserAccess record updated in database: status = ACTIVE, must_set_password = false.`);
  console.log("Admin account setup complete!");
}

setAdminPassword().catch(console.error);
