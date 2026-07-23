import * as dotenv from "dotenv";
import { resolve } from "path";
import readline from "readline";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAdminPassword(password: string): PasswordValidationResult {
  if (!password || password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." };
  }
  return { valid: true };
}

export async function promptHiddenPassword(
  promptText: string,
  inputStream: NodeJS.ReadableStream = process.stdin,
  outputStream: NodeJS.WritableStream = process.stdout
): Promise<string> {
  return new Promise((resolve) => {
    outputStream.write(promptText + " ");

    const isTTY = (inputStream as any).isTTY && typeof (inputStream as any).setRawMode === "function";

    if (isTTY) {
      let password = "";
      (inputStream as any).setRawMode(true);
      (inputStream as any).resume();
      (inputStream as any).setEncoding("utf8");

      const onData = (char: string) => {
        // Ctrl+C or Ctrl+D
        if (char === "\u0003" || char === "\u0004") {
          (inputStream as any).setRawMode(false);
          (inputStream as any).pause();
          (inputStream as any).removeListener("data", onData);
          outputStream.write("\n");
          process.exit(1);
        }

        // Enter / Return
        if (char === "\r" || char === "\n") {
          (inputStream as any).setRawMode(false);
          (inputStream as any).pause();
          (inputStream as any).removeListener("data", onData);
          outputStream.write("\n");
          resolve(password);
          return;
        }

        // Backspace / Delete
        if (char === "\u0008" || char === "\x7f") {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          return;
        }

        // Ignore ANSI escape sequences / arrow keys
        if (char.startsWith("\u001b")) {
          return;
        }

        password += char;
      };

      (inputStream as any).on("data", onData);
    } else {
      // Non-TTY fallback (for tests or script piping)
      const rl = readline.createInterface({
        input: inputStream as any,
        output: outputStream as any,
        terminal: false,
      });

      rl.question("", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export interface SetAdminPasswordOptions {
  supabaseClient?: SupabaseClient;
  inputStream?: NodeJS.ReadableStream;
  outputStream?: NodeJS.WritableStream;
  overrideEmail?: string;
  overridePassword?: string;
  overrideConfirmPassword?: string;
}

export async function processAdminPasswordUpdate(
  options: SetAdminPasswordOptions = {}
): Promise<{ success: boolean; message: string }> {
  const inputStream = options.inputStream || process.stdin;
  const outputStream = options.outputStream || process.stdout;

  let password = options.overridePassword;
  let confirmPassword = options.overrideConfirmPassword;

  if (password === undefined) {
    password = await promptHiddenPassword("Enter new Admin password:", inputStream, outputStream);
  }
  if (confirmPassword === undefined) {
    confirmPassword = await promptHiddenPassword("Confirm new Admin password:", inputStream, outputStream);
  }

  // 1. Password mismatch check
  if (password !== confirmPassword) {
    const errorMsg = "Error: Passwords do not match.";
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg };
  }

  // 2. Password complexity validation
  const validation = validateAdminPassword(password);
  if (!validation.valid) {
    const errorMsg = `Error: ${validation.error}`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg };
  }

  // 3. Supabase client setup
  let supabase = options.supabaseClient;
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      const errorMsg = "Error: Missing Supabase Admin credentials.";
      outputStream.write(`${errorMsg}\n`);
      return { success: false, message: errorMsg };
    }
    supabase = createClient(url, key);
  }

  const email = options.overrideEmail || process.env.ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "mail2tejaswy@gmail.com";
  outputStream.write(`Setting password for Admin account: ${email}...\n`);

  // 4. Find existing Supabase auth user (Reuse existing admin, do NOT create another Admin user)
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    const errorMsg = `Error listing Supabase users: ${listErr.message}`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg };
  }

  const targetUser = listData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!targetUser) {
    const errorMsg = `Error: Supabase user with email ${email} not found.`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg };
  }

  // 5. Update existing Supabase Auth user password
  const { error: updateErr } = await supabase.auth.admin.updateUserById(targetUser.id, {
    password: password,
    email_confirm: true,
  });

  if (updateErr) {
    const errorMsg = `Error updating Supabase auth password: ${updateErr.message}`;
    outputStream.write(`${errorMsg}\n`);
    // CRITICAL: If Supabase password update fails, do NOT change database status
    return { success: false, message: errorMsg };
  }

  outputStream.write(`Supabase Auth password successfully updated for user ID ${targetUser.id}.\n`);

  // 6. Update UserAccess record to ACTIVE status in database
  const { error: dbErr } = await supabase
    .from("user_access")
    .update({
      status: "ACTIVE",
      must_set_password: false,
      first_login_completed: true,
      password_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .ilike("email", email);

  if (dbErr) {
    const errorMsg = `Error updating database UserAccess status: ${dbErr.message}`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg };
  }

  const successMsg = "UserAccess record updated in database: status = ACTIVE, must_set_password = false. Admin account setup complete!";
  outputStream.write(`${successMsg}\n`);

  return { success: true, message: successMsg };
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith("set-admin-password.ts") ||
  process.argv[1].endsWith("set-admin-password.js")
);

if (isMain) {
  processAdminPasswordUpdate().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  });
}
