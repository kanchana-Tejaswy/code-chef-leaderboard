const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  // Get total student profiles
  const resStudents = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=id,profile_status,codechef_username,leetcode_username,leaderboard_eligible,dashboard_eligible`, { headers });
  if (!resStudents.ok) {
    console.error("Failed to fetch students:", resStudents.status, await resStudents.text());
    return;
  }
  const students: any[] = await resStudents.json();

  const totalStudents = students.length;
  const withCodeChef = students.filter(s => s.codechef_username && s.codechef_username.trim() !== "").length;
  const withLeetCode = students.filter(s => s.leetcode_username && s.leetcode_username.trim() !== "").length;
  const withBoth = students.filter(s => s.codechef_username && s.codechef_username.trim() !== "" && s.leetcode_username && s.leetcode_username.trim() !== "").length;
  const missingCodeChef = students.filter(s => !s.codechef_username || s.codechef_username.trim() === "").length;
  const missingLeetCode = students.filter(s => !s.leetcode_username || s.leetcode_username.trim() === "").length;

  const profileStatusGroups: Record<string, number> = {};
  students.forEach(s => {
    const status = s.profile_status || "UNKNOWN";
    profileStatusGroups[status] = (profileStatusGroups[status] || 0) + 1;
  });

  // Codechef profiles
  const resCc = await fetch(`${supabaseUrl}/rest/v1/codechef_profiles?select=student_id`, { headers });
  const ccProfiles: any[] = resCc.ok ? await resCc.json() : [];
  const countCodechefProfile = ccProfiles.length;
  const ccStudentIds = new Set(ccProfiles.map(p => p.student_id));

  // Leetcode profiles
  const resLc = await fetch(`${supabaseUrl}/rest/v1/leetcode_profiles?select=student_id`, { headers });
  const lcProfiles: any[] = resLc.ok ? await resLc.json() : [];
  const countLeetcodeProfile = lcProfiles.length;
  const lcStudentIds = new Set(lcProfiles.map(p => p.student_id));

  const countBothPlatformProfiles = students.filter(s => ccStudentIds.has(s.id) && lcStudentIds.has(s.id)).length;

  // Leaderboard entries
  const resLb = await fetch(`${supabaseUrl}/rest/v1/leaderboard_entries?select=student_id`, { headers });
  const lbEntries: any[] = resLb.ok ? await resLb.json() : [];
  const countLeaderboardEntry = lbEntries.length;

  const leaderboardEligibleCount = students.filter(s => s.leaderboard_eligible === true).length;
  const dashboardEligibleCount = students.filter(s => s.dashboard_eligible === true).length;

  const requiringSync = students.filter(s => {
    const hasCcUser = s.codechef_username && s.codechef_username.trim() !== "";
    const hasLcUser = s.leetcode_username && s.leetcode_username.trim() !== "";
    if (!hasCcUser || !hasLcUser) return false;
    const isVerified = s.profile_status === "VERIFIED" && s.leaderboard_eligible && s.dashboard_eligible && ccStudentIds.has(s.id) && lcStudentIds.has(s.id);
    return !isVerified;
  }).length;

  console.log("=== PRODUCTION DATA DIAGNOSTIC RESULTS (via Supabase REST) ===");
  console.log(`Total StudentProfile count            : ${totalStudents}`);
  console.log(`With CodeChef username               : ${withCodeChef}`);
  console.log(`With LeetCode username               : ${withLeetCode}`);
  console.log(`With both usernames                  : ${withBoth}`);
  console.log(`Missing CodeChef                     : ${missingCodeChef}`);
  console.log(`Missing LeetCode                     : ${missingLeetCode}`);
  console.log("Count grouped by profileStatus        :");
  Object.entries(profileStatusGroups).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });
  console.log(`Count with CodechefProfile           : ${countCodechefProfile}`);
  console.log(`Count with LeetcodeProfile           : ${countLeetcodeProfile}`);
  console.log(`Count with both platform profiles    : ${countBothPlatformProfiles}`);
  console.log(`Count with LeaderboardEntry          : ${countLeaderboardEntry}`);
  console.log(`Count leaderboardEligible = true     : ${leaderboardEligibleCount}`);
  console.log(`Count dashboardEligible = true       : ${dashboardEligibleCount}`);
  console.log(`Number requiring synchronization     : ${requiringSync}`);
  console.log("=============================================================");
}

run().catch(console.error);
