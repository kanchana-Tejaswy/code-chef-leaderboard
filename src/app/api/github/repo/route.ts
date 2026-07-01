import { NextRequest, NextResponse } from "next/server";
import { queryGitHubREST } from "@/lib/github";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const repoName = searchParams.get("repo");

  if (!username || !repoName) {
    return NextResponse.json({ error: "Missing username or repo parameters" }, { status: 400 });
  }

  try {
    // 1. Fetch README (decode base64 if present, or handle missing)
    let readmeText = "No README.md found.";
    try {
      const readmeRes = await queryGitHubREST(`/repos/${username}/${repoName}/readme`, { useCache: true });
      if (readmeRes && readmeRes.content) {
        readmeText = Buffer.from(readmeRes.content, "base64").toString("utf-8");
      }
    } catch (err: any) {
      console.warn(`README not found for ${username}/${repoName}:`, err.message);
    }

    // 2. Fetch Commits (last 10)
    let commits: any[] = [];
    try {
      const commitsRes = await queryGitHubREST(`/repos/${username}/${repoName}/commits?per_page=10`, { useCache: true });
      if (Array.isArray(commitsRes)) {
        commits = commitsRes.map((c: any) => ({
          sha: c.sha ? c.sha.substring(0, 7) : "",
          message: c.commit?.message || "No commit message",
          author: c.commit?.author?.name || c.commit?.committer?.name || "Unknown",
          date: c.commit?.author?.date || c.commit?.committer?.date || "",
          avatarUrl: c.author?.avatar_url || null
        }));
      }
    } catch (err: any) {
      console.warn(`Commits fetch failed for ${username}/${repoName}:`, err.message);
    }

    // 3. Fetch Contributors (top 10)
    let contributors: any[] = [];
    try {
      const contributorsRes = await queryGitHubREST(`/repos/${username}/${repoName}/contributors?per_page=10`, { useCache: true });
      if (Array.isArray(contributorsRes)) {
        contributors = contributorsRes.map((c: any) => ({
          login: c.login,
          avatarUrl: c.avatar_url,
          contributions: c.contributions
        }));
      }
    } catch (err: any) {
      console.warn(`Contributors fetch failed for ${username}/${repoName}:`, err.message);
    }

    // 4. Fetch Languages lines of code
    let languages: Record<string, number> = {};
    try {
      const languagesRes = await queryGitHubREST(`/repos/${username}/${repoName}/languages`, { useCache: true });
      if (languagesRes && typeof languagesRes === "object") {
        languages = languagesRes;
      }
    } catch (err: any) {
      console.warn(`Languages fetch failed for ${username}/${repoName}:`, err.message);
    }

    // 5. Fetch Pull Requests and Issues for activity timeline
    let pulls: any[] = [];
    let issues: any[] = [];
    try {
      const [pullsRes, issuesRes] = await Promise.all([
        queryGitHubREST(`/repos/${username}/${repoName}/pulls?state=all&per_page=5`, { useCache: true }).catch(() => []),
        queryGitHubREST(`/repos/${username}/${repoName}/issues?state=all&per_page=5`, { useCache: true }).catch(() => [])
      ]);

      if (Array.isArray(pullsRes)) {
        pulls = pullsRes.map((p: any) => ({
          number: p.number,
          title: p.title,
          state: p.state,
          createdDate: p.created_at,
          mergedDate: p.merged_at || null
        }));
      }

      if (Array.isArray(issuesRes)) {
        // GitHub API returns PRs inside issues endpoint, filter them out
        issues = issuesRes
          .filter((i: any) => !i.pull_request)
          .map((i: any) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            createdDate: i.created_at
          }));
      }
    } catch (err: any) {
      console.warn(`Timeline data fetch failed for ${username}/${repoName}:`, err.message);
    }

    return NextResponse.json({
      success: true,
      readme: readmeText,
      commits,
      contributors,
      languages,
      pulls,
      issues
    });
  } catch (error: any) {
    console.error(`Repository detail load error for ${username}/${repoName}:`, error);
    return NextResponse.json({ error: error.message || "Failed to load repository details" }, { status: 500 });
  }
}
