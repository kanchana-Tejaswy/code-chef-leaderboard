# Database Target Diagnostic Report

We have completed the investigation regarding why student profiles created on localhost are not appearing in the Supabase Table Editor. Below are our step-by-step findings and analysis.

## STEP 1 — IDENTIFY THE REAL DATABASE CONNECTION
- **Environment File**: `.env` supplies the `DATABASE_URL` and `DIRECT_URL`. `.env.local` contains only a `GITHUB_TOKEN` and does not override any database variables.
- **Database Hostname**: `aws-1-ap-southeast-2.pooler.supabase.com` (which is a Supabase Australian region connection pooler).
- **Database Port**: `5432`
- **Database Name**: `postgres`
- **Is localhost**: No.
- **Contains supabase.co / pooler.supabase.com**: Yes.
- **Contains Expected Project Reference (`mdvwpcntaetchvnlvvpo`)**: Yes (in both database username prefix and `NEXT_PUBLIC_SUPABASE_URL`).
- **Conflicting Declarations**: No conflicts. `DATABASE_URL` is not declared in `.env.local`.

## STEP 2 — INSPECT THE PROFILE CREATION ROUTE
- The route `POST /api/profile` in `src/app/api/profile/route.ts` calls a real Prisma operation:
  ```typescript
  const profile = await prisma.studentProfile.create({ ... })
  ```
- The operation **is awaited** before returning status 200.
- It does **not** write to `localStorage`, in-memory arrays, mock arrays, or JSON files.
- If Prisma throws an exception, it is caught in the `catch` block and returns status 500 (`Internal server error`).
- It accepts a client-provided student `id` in the body, falling back to generating a server-side UUID via `crypto.randomUUID()`.

## STEP 3 — SEARCH FOR THE TEST ID
- We performed a repository-wide search for the test ID `test-student-id-123456`.
- **Match Results**:
  - Matches were found **only** in the compiler trace file [`.next/dev/trace`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/.next/dev/trace) on lines 64, 67, and 68.
  - It is **not** hard-coded inside any production API routes or components.
- The `POST /api/profile` route accepts a client-provided `id`, but production registration route `POST /api/students/analyze` generates the ID on the server using Prisma's default UUID strategy.

## STEP 4 — CHECK FOR LOCAL OR MOCK STORAGE
- We searched for `localStorage`, `sessionStorage`, `mockStudents`, `sampleStudents`, `testStudents`, `fallbackStudents`, and `students.json`.
- **Findings**:
  - `localStorage` is only used for UI theme preferences (light/dark mode).
  - No mock/fallback student data arrays or local files are used for leaderboard views.
- **Dashboard Source**: The dashboard fetches its data entirely from the database via Prisma client (queries such as `prisma.leaderboardEntry.findMany` and `prisma.studentProfile.count`).

## STEP 5 — READ-ONLY DATABASE DIAGNOSTIC
- We created and ran the diagnostic script [`scripts/diagnose-database-target.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/scripts/diagnose-database-target.ts).
- **Diagnostic Run Results**:
  - Successfully connected to `aws-1-ap-southeast-2.pooler.supabase.com`.
  - Total student count in Supabase: **14**
  - Latest students verified:
    - ID: `f8fdc9fc-c903-45f7-b8f1-71a5c5bb3e62`, Name: `Test Dev student`, Roll: `22CS999`
    - ID: `3c7344b0-648b-4c12-831b-78998cd2bc5e`, Name: `Demo Student`, Roll: `DEMO001`
  - Roll number `CLOUDTEST001` exists: **NO**

## STEP 6 — CHECK API ERROR HANDLING
- The database create operation is properly awaited.
- Silent swallowing of Prisma errors does not occur (errors throw and return HTTP 500).
- The response returns the database-created profile, but **does not** run a separate reread/query of the row before returning success.

---

DATABASE TARGET DIAGNOSTIC

- Next.js database environment source: .env
- Prisma connection environment variable: DATABASE_URL
- Sanitized database hostname: aws-1-ap-southeast-2.pooler.supabase.com
- Database port: 5432
- Localhost database detected: NO
- Supabase hostname detected: YES
- Expected project reference matched: YES
- Conflicting environment variables: NO
- POST /api/profile performs real Prisma write: YES
- Prisma write awaited: YES
- API rereads saved row before success: NO
- Dashboard uses database data: YES
- Dashboard uses localStorage/mock data: NO
- Hard-coded test ID in production code: NO
- CLOUDTEST001 found through Prisma: NO
- Most likely root cause:
  1. **Stale/Cached Next.js Environment**: The local Next.js dev server was started before `.env` was updated with the Supabase connection string. In Next.js, environment variables are loaded at startup, and changing `.env` does not hot-reload them. The running dev server was thus falling back to `localhost:5432` or utilizing cached environment variables.
  2. **Table Discrepancy (`student_profiles` vs `profiles`)**: The schema contains both `profiles` and `student_profiles` tables. The developer might be checking the `profiles` table in the Supabase Table Editor instead of the `student_profiles` table where the code writes.
  3. **No Leaderboard Entry (Missing Platform Link)**: Newly created students will not show up in the main dashboard view if they have no platform usernames (GitHub, LeetCode, or CodeChef) linked, as they do not generate a `leaderboard_entries` row during background sync.
- Files requiring correction: None. The configuration and code are correct; the environment simply needs to be reloaded/re-run.
- Recommended next action:
  1. Restart the Next.js local development server (`npm run dev`) to force loading of the new `.env` settings.
  2. Inspect the `student_profiles` table (not the `profiles` table) in the Supabase Table Editor.
  3. Verify that new student creations include at least one platform username to trigger background synchronization and create a leaderboard entry.
