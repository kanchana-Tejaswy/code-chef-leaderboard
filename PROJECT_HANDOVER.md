# Project Handover Document: CodeChef Leaderboard / ACE Talent Intelligence Platform

> **Metadata**  
> - **Project Name:** ACE Talent Intelligence Platform / CodeChef Leaderboard  
> - **Document Purpose:** Master Project Handover & Architecture Specification  
> - **Last Verified Date:** 2026-07-22  
> - **Verified Source Commit Hash:** `e87cd53ab43c427e392cfcd5e5b21796f6545c2a`  

---

## 1. Project Overview
- **Application Purpose**: ACE Talent Intelligence Platform & CodeChef/LeetCode Leaderboard. It tracks, aggregates, analyzes, ranks, and reports student competitive programming performance (CodeChef, LeetCode, GitHub) for institutional placement readiness and talent analytics.
- **Primary Users**:
  - **STUDENT**: View own profile, ranks, platform stats, and global leaderboard.
  - **HOD (Head of Department)**: View department-wide leaderboard, student analytics, and department performance metrics.
  - **GK_SIR (Management / Director)**: View institutional analytics, overall leaderboards, and executive insights.
  - **ADMIN**: Full system control including account access management, staff provisioning, student provisioning, manual data sync, and account suspension/disabling.
- **Main Problem Solved**: Eliminates manual tracking of student coding profiles across multiple platforms (CodeChef, LeetCode, GitHub) by providing automated scraping, normalized scoring algorithms, AI-driven placement readiness analysis, role-based dashboards, and controlled account provisioning.
- **Current Development Stage**: Phase 6 Complete (Admin Access Management & Account Provisioning implemented, tested, and deployed to Production). Phase 7 (First-Admin live bootstrap & real user onboarding) pending execution.
- **Runnable Status**: Runnable locally via `npm run dev` and tested with Vitest (`npx vitest run`).
- **Production-Ready Status**: Core auth, role enforcement, protected API 401/403 handlers, admin access management, scraping algorithms, and Vercel deployment are production-ready. Live Admin account bootstrap on Production remains to be executed once `BOOTSTRAP_ADMIN_EMAIL` is provided.

---

## 2. Technology Stack
- **Framework**: Next.js 16.2.9 (App Router) - Configured in [`next.config.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/next.config.ts) & [`src/proxy.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts).
- **Programming Language**: TypeScript ^5 (Strict mode) - Configured in [`tsconfig.json`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/tsconfig.json).
- **UI Library & Components**: React 18.2.0, Framer Motion ^10.15.0, Lucide React ^1.21.0.
- **Styling**: TailwindCSS ^4 with PostCSS - Configured in [`postcss.config.mjs`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/postcss.config.mjs) & [`src/app/globals.css`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/globals.css).
- **Authentication**: Supabase Auth (`@supabase/ssr` ^0.12.0 & `@supabase/supabase-js` ^2.108.2) + Custom Prisma `UserAccess` role management & OTP flow.
- **Database**: PostgreSQL (Supabase Managed Postgres) - Configured in [`prisma/schema.prisma`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/prisma/schema.prisma) & [`src/lib/prisma.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/lib/prisma.ts).
- **ORM**: Prisma ^7.8.0 with `@prisma/adapter-pg` (driver adapters enabled).
- **Charts**: Recharts ^3.9.0 (Radar, Line, Bar charts for talent & skill analytics).
- **Scraping Tools**: Cheerio ^1.2.0 (CodeChef HTML scraping) & native `fetch` (LeetCode GraphQL API).
- **Form Handling & Validation**: React Hook Form ^7.81.0, Zod ^4.4.3, `@hookform/resolvers` ^5.4.0.
- **Excel Export/Import**: XLSX ^0.18.5.
- **Hosting / Infrastructure**: Vercel (Production deployment ready).
- **Package Manager**: npm.
- **Testing Tools**: Vitest ^4.1.10 - Configured in [`vitest.config.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/vitest.config.ts) & [`tests/`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/tests/).

---

## 3. Current Git State
- **Current Branch**: `main`
- **Git Status**: Working tree clean (no uncommitted or untracked changes).
- **Recent 15 Commits**:
  1. `e87cd53` Merge branch 'implement-access-management'
  2. `7a95c8f` feat: add admin access management and account provisioning
  3. `961de26` Merge branch 'fix-api-auth-responses'
  4. `ac32566` test: update API auth and role tests
  5. `f25ca93` fix: return API authorization responses without redirects
  6. `3547997` feat: enforce role-based page and API access
  7. `a5364f6` feat: add password setup and account login
  8. `51138c7` feat: Implement Phase 3 Authentication OTP request and verification
  9. `55b7471` test: complete authentication core verification
  10. `6d9df72` chore: finalize and secure auth core (phase 2 refinement)
  11. `7bf0f7c` feat(auth): implement phase 2 auth core and provisioning services
  12. `e59edf9` Merge branch 'implement-auth-foundation'
  13. `0f4c148` feat: add authentication data foundation
  14. `5d8fe83` fix: add missing student profile email column
  15. `88134d2` Merge branch 'add-linkedin-and-simplify-github'
- **Remote Synchronization**: Branch is up to date with `origin/main`.

---

## 4. Project Folder Structure
```text
code-chef-leaderboard/
├── .env.example                # Template for environment variables
├── .env.local / .env.production# Local/prod environment variable configurations
├── README.md                   # Project instructions
├── next.config.ts              # Next.js configuration and rewrites
├── postcss.config.mjs          # PostCSS / Tailwind CSS configuration
├── prisma.config.ts            # Prisma setup file
├── tsconfig.json               # TypeScript compiler config
├── vitest.config.ts            # Vitest test runner config
├── prisma/
│   ├── schema.prisma           # Complete database schema (models & enums)
│   ├── seed.ts                 # Database seeding script
│   └── migrations/             # SQL migrations (0_init to 20260721000001)
├── scripts/                    # Maintenance & administrative CLI scripts
│   ├── bootstrap-admin.ts      # Bootstrap first Admin account CLI tool
│   ├── clean-ranking-data.ts   # Recalculates all scores and ranks across platform
│   ├── provision-existing-students.ts # Student batch account provisioner
│   └── retry-sync.ts           # Retries failed profile scraping jobs
├── src/
│   ├── proxy.ts                # Next.js route proxy / edge middleware authentication deflection
│   ├── app/                    # App Router pages and API route handlers
│   │   ├── admin/access/       # Admin access management dashboard UI
│   │   ├── analytics/          # Institutional performance analytics page
│   │   ├── api/                # REST API endpoints (auth, admin, profile, sync, leaderboard)
│   │   ├── auth/               # OTP verification & password creation pages
│   │   ├── dashboard/          # Executive & HOD dashboard page
│   │   ├── departments/        # Department breakdown page
│   │   ├── insights/           # AI talent insights page
│   │   ├── leaderboard/        # Public/authenticated student leaderboard
│   │   ├── login/              # Login page (Roll Number / Email & Password)
│   │   └── student/[id]/       # Student profile deep dive page
│   ├── components/             # Reusable UI components
│   │   ├── dashboard/          # Performance, rating, radar charts
│   │   ├── leaderboard/        # Contest cards & tables
│   │   └── shared/             # Navbar, toast notifications
│   ├── lib/
│   │   ├── auth.ts             # Server-side authentication & role-based gatekeeping (requireAdmin, requireRole)
│   │   ├── prisma.ts           # Singleton Prisma Client with PostgreSQL adapter
│   │   └── write-access.ts     # Public demo mode / cron secret validation
│   ├── services/               # Core domain logic & platform services
│   │   ├── activity.service.ts # Audit & activity log writer
│   │   ├── ai-engine.service.ts# AI analysis calculation engine
│   │   ├── analytics.service.ts# Institutional analytics aggregator
│   │   ├── audit.service.ts    # AuditLog service with AuditAction enum
│   │   ├── auth-provisioning.service.ts # Staff & Student account provisioning engine
│   │   ├── codechef.service.ts # CodeChef HTML scraper & parser
│   │   ├── insights.service.ts # Talent insights & placement readiness generator
│   │   ├── leetcode.service.ts # LeetCode GraphQL API scraper
│   │   ├── normalization.service.ts # Multi-platform score normalization
│   │   ├── overallScore.service.ts # Weighted overall score & ranking formula
│   │   └── sync.service.ts     # Profile fetch & database sync orchestrator
│   ├── types/                  # TypeScript interface definitions
│   └── utils/                  # Helper utilities (password validation, Supabase clients)
└── tests/                      # Integration & unit test suites (auth, role, response tests)
```

---

## 5. Application Routes and Pages

| Route | Page Purpose | Main File | Access Role | Status | Important Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Landing page / Auto-redirect to Home | [`src/app/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/page.tsx) | Public | Working | Navbar |
| `/login` | User login (Roll Number or Email + Password) | [`src/app/login/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/login/page.tsx) | Public | Working | `/api/auth/login/password`, Supabase Auth |
| `/auth/verify-otp` | First-login OTP request & verification | [`src/app/auth/verify-otp/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/auth/verify-otp/page.tsx) | Public / Pending Users | Working | `/api/auth/first-login/request-otp`, `verify-otp` |
| `/auth/set-password` | First-login password creation | [`src/app/auth/set-password/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/auth/set-password/page.tsx) | Authenticated (Must set pass) | Working | `/api/auth/set-password` |
| `/dashboard` | Admin & Executive Overview Dashboard | [`src/app/dashboard/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/dashboard/page.tsx) | ADMIN | Working | `requireAdmin()`, `/api/dashboard/stats` |
| `/leaderboard` | Main Leaderboard across departments | [`src/app/leaderboard/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/leaderboard/page.tsx) | ADMIN, GK_SIR, HOD, STUDENT | Working | `requireLeaderboardAccess()`, `/api/leaderboard` |
| `/student/[id]` | Student Profile & platform analytics | [`src/app/student/[id]/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/student/%5Bid%5D/page.tsx) | ADMIN, GK_SIR, HOD (dept), STUDENT (own) | Working | `requireStudentProfileReadAccess()`, `/api/profile` |
| `/admin/access` | Admin Access Management & Provisioning | [`src/app/admin/access/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/admin/access/page.tsx) | ADMIN | Working | `requireAdmin()`, `/api/admin/access/*` |
| `/analytics` | Platform-wide Performance Analytics | [`src/app/analytics/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/analytics/page.tsx) | ADMIN, GK_SIR, HOD | Working | `requireStaffReadAccess()`, `/api/analytics` |
| `/insights` | AI Placement Readiness & Insights | [`src/app/insights/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/insights/page.tsx) | ADMIN, GK_SIR, HOD | Working | `requireStaffReadAccess()`, `/api/insights` |
| `/departments` | Departmental Comparative Performance | [`src/app/departments/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/departments/page.tsx) | ADMIN, GK_SIR, HOD | Working | `requireStaffReadAccess()`, `/api/departments` |
| `/codechef-contests` | CodeChef Contests List | [`src/app/codechef-contests/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/codechef-contests/page.tsx) | Public / Authenticated | Working | `/api/contests?platform=codechef` |
| `/leetcode-contests` | LeetCode Contests List | [`src/app/leetcode-contests/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/leetcode-contests/page.tsx) | Public / Authenticated | Working | `/api/contests?platform=leetcode` |

---

## 6. Authentication System
- **Login Flow**:
  - **Login Page**: [`src/app/login/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/login/page.tsx). Supports login using Roll Number (for students) or Email (for staff/admin).
  - **Password Login Endpoint**: [`src/app/api/auth/login/password/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/login/password/route.ts). Authenticates via Supabase Auth `signInWithPassword` and validates active `UserAccess` record in database.
- **First-Time Student/Staff Activation (OTP)**:
  - **Request OTP**: [`src/app/api/auth/first-login/request-otp/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/first-login/request-otp/route.ts). Sends OTP via Supabase Auth `signInWithOtp`.
  - **Verify OTP**: [`src/app/api/auth/first-login/verify-otp/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/first-login/verify-otp/route.ts). Verifies OTP token and initiates password creation flow.
  - **Set Password**: [`src/app/api/auth/set-password/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/set-password/route.ts). Updates user password in Supabase Auth and sets `mustSetPassword: false`, `status: ACTIVE` in `UserAccess`.
- **Google OAuth**: NOT IMPLEMENTED / PLANNED.
- **Session & Middleware Deflection**:
  - **Edge Proxy**: [`src/proxy.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts). Uses `@supabase/ssr` to refresh session cookies. Unauthenticated requests to non-public page routes are redirected to `/login`. Unauthenticated requests to `/api/*` pass through to Route Handlers so Route Handlers can return Direct HTTP 401 JSON.
  - **Route Handlers**: Direct server-side authorization gatekeepers in [`src/lib/auth.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/lib/auth.ts) return direct HTTP 401 JSON for missing credentials and HTTP 403 JSON for unauthorized roles.
- **Logout**: [`src/app/api/auth/logout/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/logout/route.ts). Clears Supabase session cookies and redirects to `/login`.

---

## 7. Roles and Permissions

Verified Roles in Database Enum (`UserRole`): `ADMIN`, `GK_SIR`, `HOD`, `STUDENT`.

### Permission Matrix

| Feature / Action | STUDENT | HOD | GK_SIR | ADMIN | Enforced At |
| :--- | :---: | :---: | :---: | :---: | :--- |
| View Dashboard (`/dashboard`) | ❌ | ❌ | ❌ | ✅ | Server (`requireAdmin()`) |
| View Leaderboard (`/leaderboard`) | ✅ | ✅ | ✅ | ✅ | Server (`requireLeaderboardAccess()`) |
| View Analytics (`/analytics`) | ❌ | ✅ | ✅ | ✅ | Server (`requireStaffReadAccess()`) |
| View Insights (`/insights`) | ❌ | ✅ | ✅ | ✅ | Server (`requireStaffReadAccess()`) |
| View Departments (`/departments`) | ❌ | ✅ | ✅ | ✅ | Server (`requireStaffReadAccess()`) |
| View Own Student Profile | ✅ | ✅ | ✅ | ✅ | Server (`requireStudentProfileReadAccess()`) |
| View Other Student Profile | ❌ | ✅ (Dept only) | ✅ | ✅ | Server (`requireStudentProfileReadAccess()`) |
| Edit Own Profile | ❌ | ❌ | ❌ | ✅ | Server (`requireProfileEditAccess()`) |
| Add / Import Students | ❌ | ❌ | ❌ | ✅ | Server (`requireAdmin()`) |
| Provision Staff / Students | ❌ | ❌ | ❌ | ✅ | Server (`requireAdmin()`) |
| Suspend / Disable Accounts | ❌ | ❌ | ❌ | ✅ | Server (`requireAdmin()`) |
| Trigger Manual Scraping / Sync | ❌ | ❌ | ❌ | ✅ | Server (`requireAdmin()`) |

---

## 8. Database Architecture

Inspected schema file: [`prisma/schema.prisma`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/prisma/schema.prisma).

### Primary Database Models
1. **`StudentProfile`** (`student_profiles`):
   - Fields: `id` (UUID), `name`, `rollNumber` (unique), `department`, `year`, `branch`, `section`, `profilePictureUrl`, `codechefUsername` (unique), `leetcodeUsername` (unique), `githubUsername` (unique), `linkedinUrl`, `email` (unique), `verificationStatus`, `createdAt`, `updatedAt`.
2. **`CodechefProfile`** (`codechef_profiles`):
   - Stores scraped CodeChef stats (rating, stars, problems solved by difficulty, contest count, ranks, rating history, contest history JSON).
3. **`LeetcodeProfile`** (`leetcode_profiles`):
   - Stores scraped LeetCode stats (problems solved by difficulty, contest rating, contest rank, acceptance rate, heatmap JSON).
4. **`GithubProfile`** (`github_profiles`):
   - Stores GitHub repositories, stars, forks, followers, languages JSON, contributions JSON.
5. **`AiAnalysis`** (`ai_analysis`):
   - Stores talent score, consistency score, problem solving score, competitive programming score, placement readiness, strengths/weaknesses JSON.
6. **`LeaderboardEntry`** (`leaderboard_entries`):
   - Indexed view model storing rank, rating, stars, talent score, overall score, platform sub-scores, trend direction.
7. **`UserAccess`** (`user_access`):
   - Connects authentication (`authUserId` from Supabase Auth) to authorization roles (`role`: `ADMIN` | `GK_SIR` | `HOD` | `STUDENT`), `loginId` (Roll Number or Email), `status` (`PENDING` | `ACTIVE` | `SUSPENDED` | `DISABLED`), `studentProfileId` foreign key.
8. **`AuditLog`** (`audit_logs`):
   - Logs administrative operations with `actorUserId` (UserAccess relation), `action` string (e.g. `STAFF_ACCOUNT_PROVISIONED`), `targetType`, `targetId`, `metadata` JSON, `ipAddress`.
9. **`SyncLog`**, **`ActivityLog`**, **`NormalizedProfile`**, **`SyncJob`**, **`FetchLog`**.

---

## 9. Environment Variables

Inspected from [`.env.example`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/.env.example) and code searches:

| Variable Name | Purpose | Scope | Required / Optional | Referenced File |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL database connection string (Prisma) | Server | Required | [`src/lib/prisma.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/lib/prisma.ts) |
| `DIRECT_URL` | Direct connection string for Prisma migrations | Server | Required | [`prisma/schema.prisma`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/prisma/schema.prisma) |
| `POSTGRES_PRISMA_URL` | Vercel Postgres pooled connection URL | Server | Optional (Vercel) | [`src/lib/prisma.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/lib/prisma.ts) |
| `POSTGRES_URL` | Vercel Postgres raw connection URL | Server | Optional (Vercel) | [`src/lib/prisma.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/lib/prisma.ts) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API endpoint URL | Client & Server | Required | [`src/utils/supabase/client.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/utils/supabase/client.ts) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Supabase Anonymous Public Key | Client & Server | Required | [`src/proxy.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/proxy.ts) |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase Admin Service Role Key | Server | Required | [`src/utils/supabase/admin.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/utils/supabase/admin.ts) |
| `CRON_SECRET` | Authorization token for automated cron endpoints | Server | Required for Cron | [`src/lib/write-access.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/lib/write-access.ts) |
| `BOOTSTRAP_ADMIN_EMAIL` | Target email for initial Admin bootstrap CLI | CLI Script | Required for Bootstrap | [`scripts/bootstrap-admin.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/scripts/bootstrap-admin.ts) |

---

## 10. Implemented Features

1. **Admin Access Management & Account Provisioning**:
   - UI: [`src/app/admin/access/AdminAccessClient.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/admin/access/AdminAccessClient.tsx).
   - Allows ADMIN to view all account access records, provision staff accounts (`ADMIN`, `GK_SIR`, `HOD`), preview existing student profiles pending account creation, batch-provision student accounts (with concurrency control limit of 2), and toggle account statuses (`ACTIVE`, `SUSPENDED`, `DISABLED`). Includes full AuditLog tracking.
2. **First-Time Login & Password Creation**:
   - UI: [`src/app/auth/verify-otp/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/auth/verify-otp/page.tsx) & [`src/app/auth/set-password/page.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/auth/set-password/page.tsx).
   - Allows students or staff with `PENDING` status to verify their OTP via email, set a secure password meeting institutional policy, and activate their account.
3. **Role-Gated Protected API Response Handlers**:
   - Protected API route handlers enforce `requireAdmin()`, `requireStaffReadAccess()`, or `requireStudentProfileReadAccess()`. Unauthenticated calls return Direct HTTP 401 JSON; unauthorized role calls return Direct HTTP 403 JSON.
4. **CodeChef Real-Time Scraper**:
   - Service: [`src/services/codechef.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/codechef.service.ts).
   - Scrapes profile details, global/country ranks, stars, rating history, and contest history using Cheerio with exponential backoff retries.
5. **LeetCode GraphQL Scraper**:
   - Service: [`src/services/leetcode.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/leetcode.service.ts).
   - Queries LeetCode's public GraphQL endpoint for AC submission stats by difficulty, contest rating, contest rank, and submission calendar heatmap.
6. **Multi-Platform Score Normalization & Ranking**:
   - Service: [`src/services/overallScore.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/overallScore.service.ts).
   - Computes weighted overall scores combining CodeChef rating, LeetCode rating, and problem counts to establish dynamic leaderboard rankings.
7. **AI Talent Analysis & Placement Readiness**:
   - Service: [`src/services/ai-engine.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts).
   - Computes composite scores (talent, consistency, problem solving, learning score) and generates placement readiness assessments.

---

## 11. API Routes and Server Actions

| Endpoint | Method | Purpose | Auth Requirement | Authorization | File Path |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `/api/auth/login/password` | POST | User login with password | Public | None | [`src/app/api/auth/login/password/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/login/password/route.ts) |
| `/api/auth/first-login/request-otp` | POST | Send OTP for first-time account activation | Public | PENDING Account | [`src/app/api/auth/first-login/request-otp/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/first-login/request-otp/route.ts) |
| `/api/auth/first-login/verify-otp` | POST | Verify OTP token | Public | Valid Token | [`src/app/api/auth/first-login/verify-otp/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/first-login/verify-otp/route.ts) |
| `/api/auth/set-password` | POST | Set password for account | Authenticated | Must set password | [`src/app/api/auth/set-password/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/set-password/route.ts) |
| `/api/auth/logout` | POST | User logout | Authenticated | Any active user | [`src/app/api/auth/logout/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/auth/logout/route.ts) |
| `/api/admin/access/accounts` | GET | List all account access records | Authenticated | ADMIN | [`src/app/api/admin/access/accounts/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/admin/access/accounts/route.ts) |
| `/api/admin/access/accounts/[id]/status` | PATCH | Update account status (Active/Suspended/Disabled) | Authenticated | ADMIN | [`src/app/api/admin/access/accounts/[id]/status/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/admin/access/accounts/%5Bid%5D/status/route.ts) |
| `/api/admin/access/staff/provision` | POST | Provision staff account (HOD/GK_SIR/ADMIN) | Authenticated | ADMIN | [`src/app/api/admin/access/staff/provision/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/admin/access/staff/provision/route.ts) |
| `/api/admin/access/students/preview` | POST | Preview student accounts to provision | Authenticated | ADMIN | [`src/app/api/admin/access/students/preview/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/admin/access/students/preview/route.ts) |
| `/api/admin/access/students/provision` | POST | Batch-provision student accounts | Authenticated | ADMIN | [`src/app/api/admin/access/students/provision/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/admin/access/students/provision/route.ts) |
| `/api/admin/access/audit` | GET | Fetch administrative audit logs | Authenticated | ADMIN | [`src/app/api/admin/access/audit/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/admin/access/audit/route.ts) |
| `/api/leaderboard` | GET | Fetch leaderboard entries | Authenticated | ADMIN, GK_SIR, HOD, STUDENT | [`src/app/api/leaderboard/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/leaderboard/route.ts) |
| `/api/dashboard/stats` | GET | Executive overview statistics | Authenticated | ADMIN | [`src/app/api/dashboard/stats/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/dashboard/stats/route.ts) |
| `/api/analytics` | GET | Platform analytics | Authenticated | ADMIN, GK_SIR, HOD | [`src/app/api/analytics/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/analytics/route.ts) |
| `/api/insights` | GET | AI Insights data | Authenticated | ADMIN, GK_SIR, HOD | [`src/app/api/insights/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/insights/route.ts) |
| `/api/departments` | GET | Departmental comparative stats | Authenticated | ADMIN, GK_SIR, HOD | [`src/app/api/departments/route.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/api/departments/route.ts) |

---

## 12. Data Scraping System

1. **CodeChef Scraper**:
   - File: [`src/services/codechef.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/codechef.service.ts).
   - Input: CodeChef handle or full profile URL.
   - External Endpoint: `https://www.codechef.com/users/{username}`.
   - Parsing: Cheerio parsing HTML DOM for rating headers, contest tables, problem stats, and star counts.
   - Error Handling: 3-attempt exponential backoff retry logic. Writes `FetchLog` entry (SUCCESS/FAILURE).
   - Reliability: Working.
2. **LeetCode Scraper**:
   - File: [`src/services/leetcode.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/leetcode.service.ts).
   - Input: LeetCode handle or URL.
   - External Endpoint: `https://leetcode.com/graphql`.
   - Parsing: Native GraphQL POST queries fetching `matchedUser`, `userProfile`, `userContestRanking`, and submission calendar.
   - Error Handling: Fallback parsing & `FetchLog` entry creation.
   - Reliability: Working.
3. **GitHub Integration**:
   - File: [`src/utils/urlValidation.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/utils/urlValidation.ts) (URL validation and profile storing).
   - Status: Basic URL storing implemented. Live API repository scraping is NOT IMPLEMENTED / PLANNED.
4. **Other Platforms (Codeforces, HackerRank, GeeksForGeeks, Kaggle)**:
   - Status: NOT IMPLEMENTED / PLANNED ONLY.

---

## 13. Frontend Architecture
- **Layout System**: Root layout [`src/app/layout.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/layout.tsx) provides Geist font optimization, `Providers` wrapper, and shared Navbar [`src/components/shared/navbar.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/components/shared/navbar.tsx).
- **Navigation & Navbar**: Role-aware navbar displaying links relevant to user's active role (`ADMIN` sees Access & Dashboard; `STUDENT` sees Profile & Leaderboard; `HOD` sees Analytics & Departments).
- **State Management & Data Fetching**: Client components use standard React state (`useState`, `useEffect`) with native `fetch` and toast notifications [`src/components/shared/toast.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/components/shared/toast.tsx).
- **Charts**: Built with Recharts (Radar charts for skill matrix, Line charts for rating history, Bar charts for problem solving difficulty distributions).

---

## 14. Data Flow
1. **Student Import / Provisioning**:
   - Admin imports student profiles via CSV/Excel or provisions accounts via `/admin/access`.
   - Admin service [`src/services/auth-provisioning.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/auth-provisioning.service.ts) creates Supabase Auth user + `UserAccess` record (`PENDING` status).
2. **First Login Activation**:
   - Student enters Roll Number on `/login`.
   - System prompts student to send OTP to registered email via `/api/auth/first-login/request-otp`.
   - Student submits OTP token on `/auth/verify-otp`.
   - Student creates new password on `/auth/set-password`. Status updates to `ACTIVE`.
3. **Platform Data Scraping & Normalization**:
   - Cron or manual trigger calls `SyncService` [`src/services/sync.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/sync.service.ts).
   - Scrapes CodeChef via `CodechefService` and LeetCode via `LeetcodeService`.
   - Updates `CodechefProfile` & `LeetcodeProfile` in database.
   - Runs `OverallScoreService` [`src/services/overallScore.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/overallScore.service.ts) & `AiEngineService` to update `LeaderboardEntry` ranks and `AiAnalysis` placement scores.
4. **Role-Gated Presentation**:
   - Student visits `/leaderboard` or `/student/[id]`. Page calls gatekeeper in `src/lib/auth.ts`. API returns normalized profile & leaderboard position.

---

## 15. Known Problems and Broken Areas
- **Pre-existing ESLint Type Warnings**:
  - *Evidence*: 333 pre-existing linter warnings (mostly `@typescript-eslint/no-explicit-any`).
  - *Impact*: Low. Code builds and tests pass cleanly, but explicit typing can be improved in future phases.
- **Vercel Deployment Protection Interception during Direct Curl**:
  - *Evidence*: Unauthenticated direct `curl` requests to Vercel production preview URL trigger Vercel's platform-level SSO redirect (`vercel.com/sso-api`) when Vercel Auth is turned on in Project Settings.
  - *Impact*: Medium. When accessing production directly without Vercel credentials, Vercel SSO catches requests before Next.js edge middleware. (Application-level 401/403 responses work as designed once past platform auth).
- **GitHub Live API Scraper**:
  - *Status*: NOT IMPLEMENTED / PLANNED. GitHub URL validation exists, but real-time GraphQL/REST API repository scraping is not built.
- **Google OAuth Login**:
  - *Status*: PLANNED / NOT IMPLEMENTED. Password & OTP verification are fully implemented.

---

## 16. Security Review
- **Exposed Secrets**: Clean. No API keys, database passwords, or JWT secrets are hardcoded in source files. All loaded via `process.env`.
- **Server-Side Authorization**: Secure. All protected API route handlers and server pages call server-side gatekeepers (`requireAdmin()`, `requireStaffReadAccess()`, `requireStudentProfileReadAccess()`). Client-side role checks only affect UI rendering.
- **Insecure Direct Object Reference (IDOR)**: Protected. `requireStudentProfileReadAccess(studentProfileId)` verifies that `STUDENT` role users can ONLY view their own profile (`access.studentProfileId === studentProfileId`).
- **OTP Security**: OTP generation and verification rely on Supabase Auth's secure rate-limited token engine.
- **SQL Injection**: Prevented by Prisma ORM parameter binding and PostgreSQL query escaping.

---

## 17. Deployment Configuration
- **Platform**: Vercel.
- **Build Command**: `npm run build` (`prisma generate && next build`).
- **Start Command**: `next start`.
- **Database Connection**: Uses Supabase PostgreSQL with pooled connection strings (`DATABASE_URL` / `POSTGRES_PRISMA_URL`) for serverless environment compatibility.
- **Production URL**: `https://code-chef-leaderboard-fp24om7pw-kanchana-tejaswys-projects.vercel.app`

---

## 18. What Has Been Completed
- [x] Database Schema Foundation (Prisma models, migrations, indexes)
- [x] Supabase Auth & SSR Integration
- [x] First-Time User Activation (OTP Request & Verification)
- [x] Secure Password Setup & Password Login
- [x] Role-Based Server Gatekeeping (`requireAdmin`, `requireRole`, `requireStudentProfileReadAccess`)
- [x] Direct HTTP 401 / 403 API Response Handlers
- [x] Admin Access Management & Account Provisioning Dashboard (`/admin/access`)
- [x] Concurrency-Controlled Student Batch Account Provisioning
- [x] Staff Account Provisioning (`ADMIN`, `GK_SIR`, `HOD`)
- [x] Account Status Transitions (`ACTIVE`, `SUSPENDED`, `DISABLED`)
- [x] Administrative Audit Logging (`AuditLog` & `AuditAction`)
- [x] CodeChef HTML Scraper & Parser
- [x] LeetCode GraphQL Scraper
- [x] Score Normalization & Leaderboard Ranking Algorithms
- [x] Comprehensive Integration Test Suite (125 passing tests in Vitest)
- [x] Vercel Production Deployment

---

## 19. Immediate Next Tasks

### P0 – Execute Live Admin Bootstrap on Production
- **Objective**: Run `scripts/bootstrap-admin.ts --execute --confirmation=BOOTSTRAP_FIRST_ADMIN` on Production once the approved `BOOTSTRAP_ADMIN_EMAIL` is provided.
- **Files**: [`scripts/bootstrap-admin.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/scripts/bootstrap-admin.ts).
- **Expected Result**: First Admin account created in Supabase Auth & `UserAccess` table with `ACTIVE` status.

### P1 – Real Student & Faculty Batch Onboarding (Phase 7)
- **Objective**: Provision initial cohort of actual institutional students and department HODs via `/admin/access`.
- **Files**: [`src/services/auth-provisioning.service.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/auth-provisioning.service.ts), [`src/app/admin/access/AdminAccessClient.tsx`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/app/admin/access/AdminAccessClient.tsx).

### P2 – GitHub Live Scraper Implementation
- **Objective**: Expand `GithubProfile` model to fetch real-time public repository, commit count, and contribution data via GitHub REST API.
- **Files**: Create `src/services/github.service.ts`.

---

## 20. Recommended Next Development Step
**Recommended Action**: **Execute First-Admin Production Bootstrap (Phase 7 Preparation)**.

- **Why Highest Priority**: All Phase 6 access management features and admin dashboards require a live `ADMIN` account in the production database to begin onboarding actual students and staff.
- **Files Involved**: [`scripts/bootstrap-admin.ts`](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/scripts/bootstrap-admin.ts).
- **Verification**: Run script with `BOOTSTRAP_ADMIN_EMAIL` in environment, verify exact write count = 1 for UserAccess and 1 for Supabase Auth, verify password setup link / OTP.
- **Constraint**: Do not execute until user explicitly provides the target first-Admin email address.

---

## 21. Prompt for the Next AI

```text
You are continuing development on the ACE Talent Intelligence Platform & CodeChef/LeetCode Leaderboard.

Project Location: D:\code chef leader board ace\code-chef-leaderboard
Current Branch: main
Stack: Next.js 16 (App Router), TypeScript, Prisma 7 ORM, Supabase Auth & PostgreSQL, TailwindCSS, Vitest.

Current State:
- Phase 6 (Admin Access Management & Account Provisioning) is fully implemented, tested (125 tests passing), and deployed to Production Vercel.
- Protected API routes correctly return Direct HTTP 401 JSON (unauthenticated) and Direct HTTP 403 JSON (unauthorized roles).
- Server-side gatekeepers in src/lib/auth.ts enforce role permissions (ADMIN, GK_SIR, HOD, STUDENT).

Rules & Safety Instructions:
1. Do not modify schema.prisma or run database migrations without explicit user instruction.
2. Do not create real Supabase Auth users during local development unless running approved scripts.
3. Reuse existing services in src/services/ for provisioning and scraping.
4. Ensure all new admin actions log an entry to AuditLog via AuditService.
5. Always inspect source code and run verification tests (npx vitest run) after making changes.

Next Priority Task:
Execute or configure Phase 7 First-Admin Bootstrap & Account Onboarding. Refer to PROJECT_HANDOVER.md for full details.
```
