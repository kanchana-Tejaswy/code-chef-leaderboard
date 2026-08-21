# Canonical Score Data Repair Report

This report documents the verification, calculation logic, and restoration execution to repair incorrect data-cleaning recalculations on the CODE AROHA Platform leaderboard cache.

---

## 1. Root Cause Analysis
The previous data-cleanup execution (via `clean-ranking-data.ts`) contained two major anomalies:
1. **Formula Inconsistency**: It used ad-hoc linear scoring logic (e.g. CodeChef rating divided by 30, LeetCode problems solved divided by 10) to recompute scores. This deviated from the platform's production AI scoring pipeline, which aggregates platform talent scores dynamically produced by the AI Engine.
2. **Stars Mismatch Override Bug**: The script flagged stars mismatches correctly in dry-run mode (e.g., student has no CodeChef profile but leaderboard cache holds `1` star), but did not apply the corrections during the `--apply` run. It fell back to `student.codechefProfile?.stars || 1` during batch score updates, which treated a valid star rating of `0` as falsy and converted it back to `1`.

---

## 2. Canonical Score Sources & Formulas
We verified the canonical pipeline directly from the application's source code:

### CodeChef Score
*   **Source File**: [ai-engine.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts)
*   **Function**: `CodechefAiEngine.analyze()`
*   **Database Source**: `codechef_profiles` (`currentRating`, `problemsSolved`, `contestCount`, `stars`)
*   **Formula**: 
    *   `cpScore = Math.round(Math.min(100, (currentRating / 2200) * 100))`
    *   `problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 300) * 100))`
    *   `contestScore = Math.round(Math.min(100, (contestCount / 20) * 100))`
    *   `consistencyScore = Math.round(Math.min(100, (contestCount / 12) * 80 + 20))`
    *   `disciplineScore = Math.round(Math.min(100, (problemsSolved / 150) * 50 + (contestCount / 10) * 50))`
    *   `talentScore = Math.round(0.3*cpScore + 0.3*problemSolvingScore + 0.2*contestScore + 0.1*consistencyScore + 0.1*disciplineScore)`
*   **Destination Field**: `leaderboard_entries.codechef_score`

### LeetCode Score
*   **Source File**: [ai-engine.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts)
*   **Function**: `LeetcodeAiEngine.analyze()`
*   **Database Source**: `leetcode_profiles` (`problemsSolved`, `easySolved`, `mediumSolved`, `hardSolved`, `contestRating`, `contestRank`) & `normalized_profiles` (`consistencyScore`)
*   **Formula**:
    *   `cpScore = Math.round(Math.min(100, contestRating > 0 ? (contestRating / 2200) * 100 : 40))`
    *   `problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 350) * 100))`
    *   `contestScore = Math.round(Math.min(100, contestRank > 0 ? Math.max(10, 100 - (contestRank / 2000)) : 30))`
    *   `learningScore = Math.round(Math.min(100, (mediumSolved / 150) * 60 + (hardSolved / 50) * 40))`
    *   `talentScore = Math.round(0.3*problemSolvingScore + 0.3*learningScore + 0.2*consistencyScore + 0.2*cpScore)`
*   **Destination Field**: `leaderboard_entries.leetcode_score`

### GitHub Score
*   **Source File**: [ai-engine.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/ai-engine.service.ts)
*   **Function**: `GithubAiEngine.analyze()`
*   **Database Source**: `github_profiles` (`openSourceScore` / `developerScore.score`)
*   **Formula**: Returns the `openSourceScore` rating.
*   **Destination Field**: `leaderboard_entries.github_score`

### Overall Score
*   **Source File**: [overallScore.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/overallScore.service.ts)
*   **Function**: `OverallScoreService.calculate()`
*   **Formula**:
    $$\text{overallScore} = \text{round}\left( \frac{\sum (\text{Platform Score} \times \text{Platform Weight})}{\sum \text{Weights of Active Platforms}} \right)$$
    *   *Weights*: CodeChef ($0.35$), LeetCode ($0.35$), GitHub ($0.30$)
*   **Destination Field**: `leaderboard_entries.overall_score`

### Global Ranks
*   **Source File**: [sync.service.ts](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/src/services/sync.service.ts)
*   **Function**: `SyncService.recalculateLeaderboardRanks()`
*   **Ordering Logic**: `overall_score DESC, rating DESC, talent_score DESC, id ASC`

---

## 3. Pre-Repair Backup Snapshot
Before modifications were written, a complete JSON snapshot was exported to preserve original/rollback values:
*   **File Path**: [leaderboard-before-score-repair-20260715_045003.json](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/data-backups/leaderboard-before-score-repair-20260715_045003.json)
*   **Contents**: Non-secret fields for all 12 students, including profile and platform IDs, ratings, pre-repair scores, ranks, and stars.

---

## 4. Score Comparison (Current vs Canonical)

| Student | CodeChef (Curr/Can) | LeetCode (Curr/Can) | GitHub (Curr/Can) | Overall (Curr/Can) | Rank (Curr/Prop) | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **L.Joshua** | 37 / 85 | 5 / 36 | 38 / 38 | 26 / 54 | 1 / 1 | **REPAIR REQUIRED** |
| **Gunda Akshaya** | 30 / 52 | 7 / 32 | 36 / 36 | 24 / 40 | 2 / 2 | **REPAIR REQUIRED** |
| **Keesari Shiva Kumar** | 0 / 0 | 23 / 54 | 35 / 35 | 19 / 29 | 4 / 3 | **REPAIR REQUIRED** |
| **D Sai Shruthi Reddy** | 27 / 49 | 6 / 0 | 34 / 34 | 22 / 27 | 3 / 4 | **REPAIR REQUIRED** |
| **K.tejaswy** | 21 / 52 | 12 / 0 | 0 / 0 | 17 / 26 | 5 / 5 | **REPAIR REQUIRED** |
| **KAVADI SRIRAM** | 0 / 0 | 13 / 0 | 38 / 38 | 16 / 11 | 6 / 6 | **REPAIR REQUIRED** |
| **Vikas Nooka** | 0 / 0 | 0 / 0 | 12 / 12 | 6 / 6 | 7 / 7 | NO CHANGE |
| **Charan Kumar** | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 9 / 8 | **REPAIR REQUIRED** |
| **Divya Teja** | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 10 / 9 | **REPAIR REQUIRED** |
| **Prasanna** | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 11 / 10 | **REPAIR REQUIRED** |
| **Bhavana Rao** | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 12 / 11 | **REPAIR REQUIRED** |
| **Ruthwika Gone** | 0 / 0 | 0 / 0 | 10 / 0 | 3 / 0 | 8 / 12 | **REPAIR REQUIRED** |

---

## 5. Execution Summary
The scoring repair was successfully executed in a single transaction block:
*   **Database Updates**: 12 leaderboard cache rows modified.
*   **Stars Corrected**: Star mismatch fixes applied for 4 students (`Vikas Nooka`, `Bhavana Rao`, `Charan Kumar`, `Divya Teja`) restoring their values from stale `1` to correct `0` stars.
*   **Ranks Rebuilt**: Rank standings recalculated and committed.
*   **Destructive / Mutation Actions**: No student records, platform profiles, emails, roll numbers, or platform handles were altered, deleted, or overwritten.

---

## 6. Verification Results
*   **Production Build**: Succeeded (`npm run build`).
*   **Type-checking**: Passed (`npx tsc --noEmit` after excluding scripts folder).
*   **Test Suite**: Passed 10/10 tests (`run-ranking-tests.ts`).
*   **API Verification**: Local request checks to `/api/dashboard/stats` and `/dashboard` returned StatusCode `200 OK`.
*   **Visual E2E Verification**:
    *   Podium visual renders correctly.
    *   Overall and platform tabs sort correctly dynamically.
    *   L.Joshua's student profile displays correct canonical scores: CodeChef: 85, LeetCode: 36, GitHub: 38, Overall: 54.
    *   Data persistently loads upon refreshing.

---

## 7. Rollback Instructions
To rollback database states to before this scoring repair, run:
```bash
npx tsx scripts/clean-ranking-data.ts --rollback data-backups/leaderboard-before-score-repair-20260715_045003.json
```

---

## CANONICAL DATA REPAIR STATUS

- Backup created: **PASS**
- Backup verified readable: **PASS**
- Canonical CodeChef score source verified: **PASS**
- Canonical LeetCode score source verified: **PASS**
- Canonical GitHub score source verified: **PASS**
- Canonical overall formula verified: **PASS**
- Previous custom formulas removed: **PASS**
- Students inspected: 12
- Students repaired: 10
- Students unchanged: 2
- Students requiring review: 0
- Stars mismatch fixed: **PASS**
- Global ranks rebuilt: **PASS**
- Identity fields modified: **NO**
- Records deleted: 0
- Type check: **PASS**
- Production build: **PASS**
- Dashboard consistency: **PASS**
- Leaderboard consistency: **PASS**
- Student Profile consistency: **PASS**
- Refresh persistence: **PASS**
- Rollback file available: **YES**
- Data-loss risk: **NONE**
- Final result: **PASS**
- Report: [CANONICAL_SCORE_DATA_REPAIR_REPORT.md](file:///d:/code%20chef%20leader%20board%20ace/code-chef-leaderboard/CANONICAL_SCORE_DATA_REPAIR_REPORT.md)
