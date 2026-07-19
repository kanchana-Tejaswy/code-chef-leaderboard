-- CreateIndex
CREATE INDEX "student_profiles_department_idx" ON "student_profiles"("department");

-- CreateIndex
CREATE INDEX "student_profiles_created_at_idx" ON "student_profiles"("created_at");

-- CreateIndex
CREATE INDEX "codechef_profiles_created_at_idx" ON "codechef_profiles"("created_at");

-- CreateIndex
CREATE INDEX "leetcode_profiles_created_at_idx" ON "leetcode_profiles"("created_at");

-- CreateIndex
CREATE INDEX "leaderboard_entries_updated_at_idx" ON "leaderboard_entries"("updated_at");

-- CreateIndex
CREATE INDEX "leaderboard_entries_rating_idx" ON "leaderboard_entries"("rating");

-- CreateIndex
CREATE INDEX "leaderboard_entries_leetcode_score_idx" ON "leaderboard_entries"("leetcode_score");
