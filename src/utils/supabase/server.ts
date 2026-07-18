import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[Supabase Server Client] Missing credentials! NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be defined.");
    throw new Error("Supabase Server credentials missing");
  }

  const cookieStore = await cookies();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method can be called from a Server Component
            // to clean up connections after a redirect/etc.
          }
        },
      },
    }
  );
}

export function createAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.error("[Supabase Admin Client] Missing credentials! SUPABASE_URL and SUPABASE_SECRET_KEY must be defined.");
    throw new Error("Supabase Admin credentials missing");
  }

  // The admin client should not use cookies and ignores RLS.
  return createServerClient(url, key, {
    cookies: {
      getAll() { return []; },
      setAll() {}
    }
  });
}
