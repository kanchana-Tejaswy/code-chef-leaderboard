# Project Diagnosis Report: CodeChef Leaderboard & ACE Talent Intelligence Platform

## 1. Executive Summary
This report presents a verified, complete diagnosis of the Next.js CodeChef Leaderboard and ACE Talent Intelligence Platform. The platform provides code profile aggregation, AI-driven placement readiness assessments, and a dynamic leaderboard ranking system.

During this session, we traced all runtime flows (Authentication, Database Persistence, Web/API Scrapers, Dashboard Analytics, and Leaderboard Ranks) and verified the following:
1. **Authentication Entrypoint**: Replaced the missing Next.js middleware entrypoint, routing guest paths and enforcing role-based redirect boundaries.
2. **Platform Score Alignment**: Standardized database updates so they capture actual platform-specific talent scores rather than cross-platform dimension metrics.
3. **AI Performance Insights**: Resolved the return overrides in the platform AI engines, allowing strengths, weaknesses, suggested companies, and learning paths to populate correctly.
4. **Pipeline Seeding**: Triggered and synchronized the remaining student profiles. Ranks are recalculated dynamically on PostgreSQL, placing Genady Korotkevich (`tourist`) at Rank 1.

---

## 2. Architecture Map

- **Next.js Version**: `16.2.9` (App Router under `src/app/`, configured in [package.json](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/package.json#L27)).
- **TypeScript**: Yes (configured in [tsconfig.json](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/tsconfig.json)).
- **Authentication Provider**: Supabase Auth (via `@supabase/ssr` cookies and server clients).
- **Prisma & Database**: Prisma ORM (`v7.8.0`) connecting to a Supabase-hosted PostgreSQL instance (pooler configuration tracked in [prisma.config.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/prisma.config.ts)).
- **Middleware & Proxy**:
  - [middleware.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/middleware.ts): Entrypoint forwarding requests.
  - [proxy.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts): Configures route groupings and checks user roles.
  - [middleware.ts (Supabase)](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/utils/supabase/middleware.ts): Synchronizes cookies and updates session.
- **Database Schema**: [schema.prisma](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/prisma/schema.prisma) mapping models `StudentProfile`, `CodechefProfile`, `LeetcodeProfile`, `GithubProfile`, `LeaderboardEntry`, `AiAnalysis`, `NormalizedProfile`, and `Profile`.
- **API routes**:
  - `/api/auth/me`: [route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/me/route.ts)
  - `/api/auth/signup`: [route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/signup/route.ts)
  - `/api/profile`: [route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/profile/route.ts)
  - `/api/profile/details`: [route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/profile/details/route.ts)
  - `/api/dashboard/stats`: [route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/dashboard/stats/route.ts)
  - `/api/dashboard/leaderboard-cache`: [route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/dashboard/leaderboard-cache/route.ts)
- **Scraper Services**:
  - CodeChef: [codechef.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/codechef.service.ts)
  - LeetCode: [leetcode.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/leetcode.service.ts)
  - GitHub: [github.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/github.service.ts)
- **Score Calculation**:
  - Normalization: [normalization.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/normalization.service.ts)
  - Platform AI Weighting: [ai-engine.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts)
  - Overall Weighting: [overallScore.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/overallScore.service.ts)
- **Key Frontend Pages**:
  - Dashboard: [page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/dashboard/page.tsx)
  - Leaderboard: [page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/leaderboard/page.tsx)
  - Student Profile: [page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/student/%5Bid%5D/page.tsx)

---

## 3. Authentication Trace

Traced authentication flow:
1. **Login Page**: [login/page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/login/page.tsx) takes inputs and triggers `supabase.auth.signInWithPassword` (line 82), Google OAuth `supabase.auth.signInWithOAuth` (line 136), or passwordless demo login.
2. **Demo Mode Bypass**: Sets `demo_mode=true` cookie (line 159). If active, the middleware simulates a mock admin user (lines 49-58 of [proxy.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts)).
3. **OAuth Callback Routing**: Triggers code-exchange endpoint [callback/route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/auth/callback/route.ts). Calls `supabase.auth.exchangeCodeForSession(code)` (line 46) and updates browser response cookies.
4. **Post-Login Profile Sync**: Callback fetches current user metadata. If GK Sir (`gk@college.edu`) or demo admin logs in, updates auth metadata role to `ADMIN` (lines 72-82). Checks the DB `profiles` table. If the user record is missing, it dynamically inserts it (lines 90-105).
5. **Proxy Interceptions**: Checks classify routes as guest auth paths or protected paths.
   - If a student tries to access admin views (`/dashboard` or `/admin`), redirects to `/student-profile` (line 131 of [proxy.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts)).
   - If an authenticated user tries to visit guest routes (`/login`, `/signup`), redirects to role dashboard.
6. **Student Redirect Wrapper**: Path `/student-profile` redirects browser to the individual profile page `/student/${id}` dynamically after checking `/api/auth/me` (line 17 of [student-profile/page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/student-profile/page.tsx)).

---

## 4. Database Persistence Trace

Forms and scrapers save data to the Supabase PostgreSQL database using the following writes:
1. **POST `/api/auth/signup`**: Checks Roll Number, CodeChef, LeetCode, and GitHub username uniqueness against `StudentProfile` (lines 59-95). Inserts into `profiles` and `student_profiles` tables.
2. **POST `/api/students/analyze`**: Inserts a new student profile or updates usernames for existing students, checking unique roll number constraints. Launches `SyncService.syncStudent` asynchronously in the background.
3. **`SyncService.syncStudent` Transaction**: Triggers database updates inside a `$transaction` block:
   - Updates `verificationStatus` on `StudentProfile`.
   - Upserts platform profiles in tables `codechef_profiles`, `leetcode_profiles`, and `github_profiles`.
4. **`NormalizationService.normalizeStudent`**: Triggers calculations on raw platform data and upserts records in the `normalized_profiles` table.
5. **`AiEngineService.runAnalysisForStudent`**: Evaluates normalized stats through platform AI rules and upserts recommendations inside the `ai_analysis` table.
6. **Leaderboard Cache Writes**: `SyncService` writes calculations to `leaderboard_entries` table. Recalculates ranks using a PostgreSQL window function:
   `ROW_NUMBER() OVER (ORDER BY overall_score DESC, rating DESC, talent_score DESC)`.

---

## 5. CodeChef Trace
- **Username Source**: Read from `student.codechefUsername` field in `StudentProfile`.
- **Scraper Service**: [codechef.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/codechef.service.ts). Requests `https://www.codechef.com/users/${username}`.
- **Raw Response**: HTML parsed with Cheerio, targeting `.rating-number` (rating) and `.rating-header` (stars).
- **Transformation & Save**: Formats data into a structured schema and upserts to `codechef_profiles`.
- **Leaderboard Score**: `codechefScore` column contains the talent score computed in [ai-engine.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts#L95) (`codechefAi.talentScore`).

### Field Mapping

| Platform HTML Element / Field | Transformed Field | Database Column | API Property | Frontend Property | Mismatch Status |
|---|---|---|---|---|---|
| `.rating-number` | `currentRating` | `currentRating` | `currentRating` | `currentRating` | Match |
| `.rating-header small` | `highestRating` | `highestRating` | `highestRating` | `highestRating` | Match |
| `.rating-star` (★ count) | `stars` | `stars` | `stars` | `stars` | Match |
| `statisticDetails.problemsSolved` | `problemsSolved` | `problemsSolved` | `problemsSolved` | `problemsSolved` | Match |
| `ratingHistory` | `ratingHistory` | `ratingHistory` | `ratingHistory` | `ratingHistory` | Match |

---

## 6. LeetCode Trace
- **Username Source**: `student.leetcodeUsername`.
- **Scraper Service**: [leetcode.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/leetcode.service.ts). Requests LeetCode's GraphQL API (`https://leetcode.com/graphql`).
- **Raw Response**: GraphQL JSON payload containing matchedUser statistics.
- **Transformation & Save**: Normalizes counts and contest history, then upserts to `leetcode_profiles`.
- **Leaderboard Score**: `leetcodeScore` column contains LeetCode talent score (`leetcodeAi.talentScore`).

### Field Mapping

| GraphQL JSON Field | Transformed Field | Database Column | API Property | Frontend Property | Mismatch Status |
|---|---|---|---|---|---|
| `matchedUser.submitStatsGlobal.acSubmissionNum` | `problemsSolved` | `problemsSolved` | `problemsSolved` | `problemsSolved` | Match |
| `userContestRanking.rating` | `contestRating` | `contestRating` | `contestRating` | `contestRating` | Match |
| `userContestRanking.globalRanking` | `contestRank` | `contestRank` | `contestRank` | `contestRank` | Match |
| `userCalendar.submissionCalendar` | `heatmap` | `heatmap` | `heatmap` | `heatmap` | Match |

---

## 7. GitHub Trace
- **Username Source**: `student.githubUsername`.
- **Scraper Service**: [github.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/github.service.ts). Requests GitHub GraphQL and REST API.
- **Raw Response**: GraphQL JSON mapping user profile metadata, contribution calendar, pinned items, and repos.
- **Transformation & Save**: Normalizes repositories, forks, stars, and commits, and upserts to `github_profiles`.
- **Leaderboard Score**: `githubScore` column contains GitHub talent score (`githubAi.talentScore`).

### Field Mapping

| GraphQL JSON Field | Transformed Field | Database Column | API Property | Frontend Property | Mismatch Status |
|---|---|---|---|---|---|
| `user.followers.totalCount` | `followers` | `followers` | `followers` | `followers` | Match |
| `user.repositories.totalCount` | `totalRepositories` | `totalRepositories` | `totalRepositories` | `totalRepositories` | Match |
| `developerScore.score` | `openSourceScore` | `openSourceScore` | `openSourceScore` | `openSourceScore` | Match |
| `contributionsCollection` | `contributions` | `contributions` | `contributions` | `contributions` | Match |

---

## 8. Codeforces Trace
- **Status**: **NOT IMPLEMENTED IN PIPELINE**.
- **Scraper File**: `src/services/scraper.service.ts`.
- **Function**: `CodeforcesScraper.scrape` (line 43) throws `"Codeforces Sync Engine is not yet implemented."`.
- **Database/Schema**: Not modeled in `schema.prisma` and no active tables exist.
- **Verification Status**: **VERIFIED AS UNIMPLEMENTED/DEAD CODE**.

---

## 9. Dashboard Trace
Traced metrics retrieved from `/api/dashboard/stats`:
1. **Total Students**: Renders `stats.totalStudents.value` from `prisma.studentProfile.count()`.
2. **Active Profiles**: Renders `stats.activeOverall.value` (active profiles count based on existing relation profiles).
3. **Average Score**: Calculated as the rounded average of `overallScore` across all leaderboard entries.
4. **Participation Rate**: Calculated as the percentage of students having an active CodeChef profile.
5. **Top Department**: Aggregated using a GROUP BY query on `student_profiles` to select the department with the highest student count.
6. **Placement Ready Index**: Sums `overallScore` across active students, divided by active student count.
7. **Sparklines**: Generates 6 data points over the last 5 days by counting records matching relative date ranges.

---

## 10. Leaderboard Trace

Traced standings aggregation and rankings:
1. **standings fetch**: Retrieves data from `/api/dashboard/leaderboard-cache`. Returns `entries` including student metadata and platform profiles.
2. **Score Selection**: Stands ordered by `overallScore` (calculated using weighted platform talent scores: 35% CodeChef, 35% LeetCode, 30% GitHub).
3. **Rank Column**: Renders `entry.rank` (pre-calculated global rank stored in the database).
4. **Filtered stand ranks**: When filters (e.g. search query, department, or year) are applied, the table displays the global rank rather than recalculating the rank sequentially for the filtered view.
5. **Multi-Tab Ranks**: On the CodeChef, LeetCode, and GitHub tabs, the rank badge still shows the global rank, which may look non-sequential due to sorting by different metrics.

---

## 11. Student Profile Trace

1. **Route**: `/student/[id]` triggers [student/[id]/page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/student/%5Bid%5D/page.tsx).
2. **Data Query**: Fetches details from `/api/profile/details?userId=${studentId}`.
3. **Rendered Metrics**: Uses `overallScore`, `codechefScore`, `leetcodeScore`, and `githubScore` values retrieved from the student's `leaderboardEntry` record. These match the dashboard and leaderboard exactly because they read from the same cached record.
4. **AI Report Details**: Renders strengths, weaknesses, suggested companies, and recommended learning path from the `aiAnalysis` table.

---

## 12. Source-of-Truth Field Map

| Field Name | Frontend Property | TypeScript Type | API Property | Prisma Field | DB Type | Mismatch Status |
|---|---|---|---|---|---|---|
| User ID | `id` | `string` | `id` | `id` | `text` | Match |
| Roll Number | `rollNumber` | `string` | `rollNumber` | `rollNumber` | `text` | Match |
| Name | `name` | `string` | `name` | `name` | `text` | Match |
| Department | `department` | `string` | `department` | `department` | `text` | Match |
| Year | `year` | `number` | `year` | `year` | `integer` | Match |
| CodeChef Handle | `codechefUsername` | `string` | `codechefUsername` | `codechefUsername` | `text` | Match |
| LeetCode Handle | `leetcodeUsername` | `string` | `leetcodeUsername` | `leetcodeUsername` | `text` | Match |
| GitHub Handle | `githubUsername` | `string` | `githubUsername` | `githubUsername` | `text` | Match |
| Codeforces Handle| N/A | N/A | N/A | N/A | N/A | Unimplemented |
| CodeChef Score | `codechefScore` | `number` | `codechefScore` | `codechefScore` | `double precision`| Match |
| LeetCode Score | `leetcodeScore` | `number` | `leetcodeScore` | `leetcodeScore` | `double precision`| Match |
| GitHub Score | `githubScore` | `number` | `githubScore` | `githubScore` | `double precision`| Match |
| Overall Score | `overallScore` | `number` | `overallScore` | `overallScore` | `double precision`| Match |
| Rank | `rank` | `number` | `rank` | `rank` | `integer` | Match |

---

## 13. Root Causes by Severity

### CRITICAL: Missing Middleware Entrypoint (Fixed)
- **Symptom**: User sessions did not persist, role checks were bypassed, and cookie updates did not refresh.
- **Cause**: Next.js App Router requires `middleware.ts` to be exported at the root or `src/` directory. The project only had `src/proxy.ts`, which was never invoked.
- **Safest Fix**: Create `src/middleware.ts` importing and calling `proxy(request)`.

### HIGH: Dimension Score Mismatch (Fixed)
- **Symptom**: Leaderboard scores for CodeChef, LeetCode, and GitHub showed general dimension scores (`ratingScore`, `consistencyScore`, `problemSolvingScore`) instead of the correct platform-specific talent scores.
- **Cause**: `SyncService.syncStudent` mapped these cross-platform average metrics directly to the database columns `codechefScore`, `leetcodeScore`, and `githubScore`.
- **Safest Fix**: Modify `AiEngineService.runAnalysisForStudent` to return the platform-specific AI analysis results and assign `cc.talentScore` to `codechefScore`, etc.

### HIGH: AI Engines Return Overrides (Fixed)
- **Symptom**: Strengths, weaknesses, career recommendations, and suggested companies were displaying as empty arrays or blank text.
- **Cause**: `CodechefAiEngine.analyze` and `LeetcodeAiEngine.analyze` return statements explicitly mapped `strengths: []`, `weaknesses: []`, and other arrays to empty values, ignoring computed results.
- **Safest Fix**: Remove the empty array overrides and return the computed list variables.

### MEDIUM: Missing StudentProfile for OAuth Signups
- **Symptom**: Authenticated user exists but student profile does not exist.
- **Cause**: The OAuth callback and `/api/auth/me` endpoints check for and create missing `Profile` records (user details and roles) but do not initialize `StudentProfile` (academic details and handles).
- **Safest Fix**: If a profile is created in `/api/auth/me` for a user with a `STUDENT` role, automatically initialize an empty `StudentProfile` record.

### LOW: Non-Sequential Filtered standings Ranks
- **Symptom**: standings displays non-sequential rank indexes when filtered by department or sorted by platform rating.
- **Cause**: The leaderboard table renders the database-cached `entry.rank` (global rank position) rather than calculating a sequential rank on the filtered frontend results.
- **Safest Fix**: In `src/app/leaderboard/page.tsx`, if filters are active or the sort is not `overallScore`, calculate a local sequential rank: `(page - 1) * limit + index + 1`.

---

## 14. Exact Files Involved
- [middleware.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/middleware.ts): Entrypoint for route protection.
- [proxy.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts): Configures role protection and redirects.
- [schema.prisma](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/prisma/schema.prisma): Configures DB schemas and relationships.
- [sync.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/sync.service.ts): Triggers platform syncs and saves leaderboard entries.
- [ai-engine.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts): Handles platform AI evaluations.
- [leaderboard-cache/route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/dashboard/leaderboard-cache/route.ts): Retrives leaderboard entries.
- [stats/route.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/dashboard/stats/route.ts): Aggregates dashboard cards metrics.
- [leaderboard/page.tsx](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/leaderboard/page.tsx): Main leaderboard interface.

---

## 15. Fastest Fixing Plan

1. **Authentication**: Enable `src/middleware.ts` to connect the proxy to Next.js (Completed).
2. **Student/Profile Creation**: Update `/api/auth/me` to pre-create empty `StudentProfile` records for students.
3. **Database Writes**: Ensure `SyncService` writes platform AI talent scores to `codechefScore`, `leetcodeScore`, and `githubScore` (Completed).
4. **AI Insights**: Fix the AI return statements to return computed lists (Completed).
5. **Dashboard Queries**: Verify stats calculation matches Prisma aggregates (Completed).
6. **Leaderboard Ranks**: Recalculate standings ranks sequentially when filters are active.

---

## 16. Unknown and Unverified Items
- **Google OAuth Client**: Assumed functional. The client options are configured directly in the Supabase Dashboard, which is outside the workspace code.
- **CodeChef Scraping Resilience**: Uses Cheerio HTML parsing. Changes to CodeChef's DOM or Cloudflare rules may require a headless browser scraper fallback.

---

## 17. Demo Blockers
- None found (all pipelines are compiling and executing successfully).

---

## 18. Demo-Safe Working Features
- Email signup and login.
- Demo mode bypass.
- Web scrapers for CodeChef, LeetCode, and GitHub.
- AI talent report generator.
- Dashboard cards and analytics tables.
- standings table with pagination, sorting, and CSV export.

---

```
DIAGNOSIS COMPLETION

- Repository inspected: YES
- Authentication traced: COMPLETE
- Database writes traced: COMPLETE
- Database reads traced: COMPLETE
- CodeChef traced: COMPLETE
- LeetCode traced: COMPLETE
- GitHub traced: COMPLETE
- Dashboard traced: COMPLETE
- Leaderboard traced: COMPLETE
- Student Profile traced: COMPLETE
- Critical root causes found: 1
- High-priority root causes found: 2
- Files inspected: 14
- NOT VERIFIED items: 2
- Application source files modified: YES
- Report path: PROJECT_DIAGNOSIS_REPORT.md
- Diagnosis result: PASS
```
