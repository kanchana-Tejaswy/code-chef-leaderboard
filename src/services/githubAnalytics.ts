import { GitHubLanguage, GitHubCommitAnalytics, GitHubContributionStreak, GitHubOpenSourceAnalytics, GitHubDeveloperPortfolio, GitHubCareerInsights, GitHubDeveloperScoreDetails, GitHubProfileDetails, GitHubRepoQuality } from "../types/github";
import { calculateReadmeScore, calculateDocumentationScore, calculateComplexityScore, calculateOrganizationScore, calculateMaintenanceScore, calculateMaturityScore } from "../utils/githubMetrics";

// 20 Categories project classification helper
export function classifyRepo(name: string, desc: string, lang: string, topics: string[]): string[] {
  const categories: string[] = [];
  const n = name.toLowerCase();
  const d = desc.toLowerCase();
  const l = lang.toLowerCase();
  const t = topics.map(x => x.toLowerCase());

  const matches = (keywords: string[]) => {
    return keywords.some(kw => n.includes(kw) || d.includes(kw) || t.includes(kw));
  };

  // 1. AI
  if (matches(["ai", "artificial-intelligence", "openai", "claude", "gemini", "copilot", "llm", "gpt", "chatbot", "rag"])) {
    categories.push("AI");
  }
  // 2. Machine Learning
  if (matches(["ml", "machine-learning", "deep-learning", "pytorch", "tensorflow", "scikit-learn", "keras", "neural", "computer-vision", "nlp"])) {
    categories.push("Machine Learning");
  }
  // 3. Web Development
  if (["html", "css", "javascript", "typescript", "php"].includes(l) || matches(["web", "website", "frontend", "backend", "fullstack", "full-stack"])) {
    categories.push("Web Development");
  }
  // 4. Frontend
  if (matches(["frontend", "react", "vue", "angular", "svelte", "html", "css", "tailwind", "bootstrap", "ui"])) {
    categories.push("Frontend");
  }
  // 5. Backend
  if (matches(["backend", "node", "express", "django", "spring-boot", "flask", "fastapi", "api", "graphql", "database", "sql", "postgres", "mongodb"])) {
    categories.push("Backend");
  }
  // 6. Full Stack
  if (matches(["fullstack", "full-stack", "mern", "mean"]) || (matches(["react", "vue", "angular", "frontend"]) && matches(["node", "express", "django", "spring-boot", "backend", "api"]))) {
    categories.push("Full Stack");
  }
  // 7. Android
  if (l === "kotlin" || (l === "java" && matches(["android", "sdk", "apk"]))) {
    categories.push("Android");
  }
  // 8. iOS
  if (l === "swift" || l === "objective-c" || matches(["ios", "swiftui", "cocoapods", "xcode"])) {
    categories.push("iOS");
  }
  // 9. Python
  if (l === "python" || matches(["python", "pip"])) {
    categories.push("Python");
  }
  // 10. Java
  if ((l === "java" || matches(["java", "maven", "gradle"])) && l !== "javascript") {
    categories.push("Java");
  }
  // 11. C++
  if (l === "c++" || l === "cpp" || matches(["c++", "cpp", "cmake"])) {
    categories.push("C++");
  }
  // 12. JavaScript
  if (l === "javascript" || matches(["javascript", "js"])) {
    categories.push("JavaScript");
  }
  // 13. TypeScript
  if (l === "typescript" || matches(["typescript", "ts"])) {
    categories.push("TypeScript");
  }
  // 14. React
  if (matches(["react", "reactjs", "react-native"])) {
    categories.push("React");
  }
  // 15. Node
  if (matches(["node", "nodejs", "express"])) {
    categories.push("Node");
  }
  // 16. Next.js
  if (matches(["nextjs", "next.js"])) {
    categories.push("Next.js");
  }
  // 17. Flutter
  if (l === "dart" || matches(["flutter", "dart"])) {
    categories.push("Flutter");
  }
  // 18. DevOps
  if (matches(["devops", "docker", "kubernetes", "github-actions", "ci-cd", "aws", "terraform", "ansible", "nginx", "jenkins"])) {
    categories.push("DevOps");
  }
  // 19. Cyber Security
  if (matches(["security", "cybersecurity", "cyber-security", "hacking", "pentest", "vulnerability", "ctf", "exploit"])) {
    categories.push("Cyber Security");
  }
  // 20. Open Source
  if (matches(["open-source", "oss", "hacktoberfest"])) {
    categories.push("Open Source");
  }

  return categories;
}

export class GithubAnalyticsService {
  
  /**
   * Computes comprehensive high-fidelity analytics and derived metrics inside the application.
   */
  static computeAnalytics(
    user: any,
    reposList: any[],
    prCreatedCount: number,
    prMergedCount: number,
    prOpenCount: number,
    issuesCreatedCount: number,
    issuesClosedCount: number
  ): any {
    const totalRepositories = reposList.length;
    const totalStars = reposList.reduce((sum, r) => sum + r.stars, 0);
    const totalForks = reposList.reduce((sum, r) => sum + r.forks, 0);

    // 1. Programming Language Analysis (Language name, Bytes count, Percentage, Repository count)
    const langStats: Record<string, { bytes: number; reposCount: number; color: string }> = {};
    reposList.forEach((r: any) => {
      if (Array.isArray(r.languages)) {
        r.languages.forEach((l: any) => {
          const name = l.name;
          const size = l.bytes || 0;
          const color = l.color || "#8B5CF6";
          if (!langStats[name]) {
            langStats[name] = { bytes: 0, reposCount: 0, color };
          }
          langStats[name].bytes += size;
        });
      }
      
      const uniqueLangsInRepo = new Set<string>((r.languages || []).map((l: any) => l.name));
      uniqueLangsInRepo.forEach((name) => {
        if (langStats[name]) {
          langStats[name].reposCount++;
        }
      });
    });

    const totalBytes = Object.values(langStats).reduce((sum, l) => sum + l.bytes, 0);
    const languages: GitHubLanguage[] = Object.entries(langStats).map(([name, stats]) => {
      const percentage = totalBytes > 0 ? Number(((stats.bytes / totalBytes) * 100).toFixed(1)) : 0.0;
      return {
        name,
        value: percentage, // percentage
        bytes: stats.bytes, // REAL bytes
        color: stats.color,
        totalRepos: stats.reposCount,
        totalLines: Math.round(stats.bytes / 40) // proxy lines of code
      };
    }).sort((a, b) => b.bytes - a.bytes);

    // 2. Contribution Calendar Heatmap & Streak (GraphQL-driven only, no hardcoding/fake stats)
    const weeks = user.contributionsCollection?.contributionCalendar?.weeks || [];
    const hasCalendar = weeks.length > 0;
    const contribDays: { date: string; count: number }[] = [];
    const contributionsMap: Record<string, any> = {};

    let currentStreak: any = null;
    let longestStreak: any = null;
    let activeDays = 0;
    let streaks: GitHubContributionStreak | null = null;
    let contributions: any = null;

    if (hasCalendar) {
      weeks.forEach((w: any) => {
        w.contributionDays?.forEach((d: any) => {
          const dateStr = d.date;
          const count = d.contributionCount || 0;
          contribDays.push({ date: dateStr, count });
          contributionsMap[dateStr] = count;
        });
      });

      contribDays.sort((a, b) => a.date.localeCompare(b.date));

      let runningStreak = 0;
      let calculatedLongest = 0;
      contribDays.forEach((day) => {
        if (day.count > 0) {
          activeDays++;
          runningStreak++;
          if (runningStreak > calculatedLongest) {
            calculatedLongest = runningStreak;
          }
        } else {
          runningStreak = 0;
        }
      });
      longestStreak = calculatedLongest;

      // Current Streak backwards
      let calculatedCurrent = 0;
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const activeRecently = (contributionsMap[todayStr] || 0) > 0 || (contributionsMap[yesterdayStr] || 0) > 0;
      
      if (activeRecently) {
        for (let i = contribDays.length - 1; i >= 0; i--) {
          const day = contribDays[i];
          if (day.count > 0) {
            calculatedCurrent++;
          } else {
            if (day.date === todayStr) continue;
            break;
          }
        }
      }
      currentStreak = calculatedCurrent;

      streaks = {
        current: currentStreak,
        longest: longestStreak,
        activeDays
      };
      contributions = contributionsMap;
    } else {
      // Flag as Unavailable from GitHub API
      contributions = { isUnavailable: true };
      streaks = null;
    }

    // 3. Commit Analytics timeline
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthSums: Record<string, number> = {};
    const pastMonths: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const name = months[d.getMonth()];
      pastMonths.push(name);
      monthSums[name] = 0;
    }

    if (hasCalendar) {
      contribDays.forEach((day) => {
        const dateObj = new Date(day.date);
        const name = months[dateObj.getMonth()];
        if (name in monthSums) {
          monthSums[name] += day.count;
        }
      });
    }

    const commitTimeline = pastMonths.map((name) => ({
      month: name,
      commits: monthSums[name] || 0
    }));

    // Commit velocities calculations
    const totalCommits = reposList.reduce((sum, r) => sum + r.commits, 0);
    const thisYearCommits = hasCalendar
      ? contribDays.filter((day) => new Date(day.date).getFullYear() === now.getFullYear()).reduce((sum, day) => sum + day.count, 0)
      : totalCommits; // Fallback to totalCommits if calendar is missing

    const thisMonthCommits = hasCalendar
      ? contribDays.filter((day) => {
          const d = new Date(day.date);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).reduce((sum, day) => sum + day.count, 0)
      : Math.round(totalCommits / 12);

    const thisWeekCommits = hasCalendar
      ? contribDays.slice(-7).reduce((sum, day) => sum + day.count, 0)
      : Math.round(totalCommits / 52);

    // Weekday active aggregates
    let activeWeekday = "Not available from platform.";
    let activeMonth = "Not available from platform.";
    if (hasCalendar && contribDays.length > 0) {
      const weekdaySums = [0, 0, 0, 0, 0, 0, 0];
      const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const monthSumsYear = Array(12).fill(0);
      contribDays.forEach((day) => {
        const d = new Date(day.date);
        weekdaySums[d.getDay()] += day.count;
        monthSumsYear[d.getMonth()] += day.count;
      });
      const maxWdIdx = weekdaySums.indexOf(Math.max(...weekdaySums));
      const maxMoIdx = monthSumsYear.indexOf(Math.max(...monthSumsYear));
      activeWeekday = weekdayNames[maxWdIdx];
      activeMonth = months[maxMoIdx];
    }

    const commitAnalytics: GitHubCommitAnalytics = {
      total: totalCommits,
      commitsThisYear: thisYearCommits,
      commitsThisMonth: thisMonthCommits,
      weeklyCommits: thisWeekCommits,
      dailyAverage: parseFloat((thisYearCommits / 365).toFixed(2)),
      monthlyAverage: parseFloat((thisYearCommits / 12).toFixed(2)),
      mostActiveWeekday: activeWeekday,
      mostActiveMonth: activeMonth
    };

    // 4. Open Source Metrics
    const forkContributions = reposList.filter((r) => r.isFork === false && r.forks > 0).length;
    const orgsCount = user.organizations?.totalCount || 0;
    const releasesCount = reposList.filter((r) => r.releasesCount > 0).length;

    const openSource: GitHubOpenSourceAnalytics = {
      pullRequests: prCreatedCount,
      pullRequestsMerged: prMergedCount,
      pullRequestsOpen: prOpenCount,
      issuesCreated: issuesCreatedCount,
      issuesClosed: issuesClosedCount,
      organizations: orgsCount,
      forkContributions,
      discussions: user.repositoryDiscussionComments?.totalCount || 0,
      releases: releasesCount
    };

    // 5. Project Classifications (20 categories counts)
    let fullStackCount = 0;
    let aiCount = 0;
    let webCount = 0;
    let mobileCount = 0;
    let osCount = 0;
    let collegeCount = 0;
    let hackathonCount = 0;

    // Attach categories classification list to each repository item
    const repos = reposList.map((r) => {
      const classifications = classifyRepo(r.name, r.description, r.language, r.topics);
      if (classifications.includes("Full Stack")) fullStackCount++;
      if (classifications.includes("AI")) aiCount++;
      if (classifications.includes("Web Development")) webCount++;
      if (classifications.includes("Android") || classifications.includes("iOS") || classifications.includes("Flutter")) mobileCount++;
      if (classifications.includes("Open Source")) osCount++;
      // Legacy indicators matching UI
      if (r.topics.includes("college") || r.topics.includes("lab") || r.name.includes("assignment")) collegeCount++;
      if (r.topics.includes("hackathon") || r.name.includes("submission")) hackathonCount++;

      return {
        ...r,
        classifications
      };
    });

    const portfolio: GitHubDeveloperPortfolio = {
      fullStack: fullStackCount,
      ai: aiCount,
      web: webCount,
      mobile: mobileCount,
      openSource: osCount,
      college: collegeCount,
      hackathon: hackathonCount
    };

    // 6. Repository Quality & Metrics calculations (Documentation, Maintenance, Complexity, Organization, Maturity)
    let docSum = 0;
    let compSum = 0;
    let orgSum = 0;
    let maintSum = 0;
    let matureSum = 0;
    let qualitySum = 0;

    const reposWithScores = repos.map((r: any) => {
      const doc = calculateDocumentationScore(r.readmeSize, r.license !== "Not available from platform.", r.topics.length, r.description !== "No description provided.");
      const comp = calculateComplexityScore(r.stars, r.forks, r.commits, r.size);
      const org = calculateOrganizationScore(r.topics.length, r.description !== "No description provided.", r.size, r.defaultBranch);
      const maint = calculateMaintenanceScore(r.lastUpdated);
      const mature = calculateMaturityScore(r.createdDate);

      // Repository Quality score calculation based on real metadata criteria
      let quality = 0;
      if (r.readmeSize > 0) quality += 15;
      if (r.license !== "Not available from platform.") quality += 15;
      if (r.description && r.description !== "No description provided.") quality += 15;
      if (r.topics.length > 0) quality += 15;
      
      const lastUpdateMs = Date.now() - new Date(r.lastUpdated).getTime();
      const updatedRecently = lastUpdateMs <= 90 * 24 * 60 * 60 * 1000;
      if (updatedRecently) quality += 15;
      if (r.releasesCount > 0) quality += 10;
      if (r.openIssues > 0 || r.contributors?.length > 1) quality += 5;
      if (r.stars > 0) quality += 5;
      if (r.forks > 0) quality += 5;

      docSum += doc;
      compSum += comp;
      orgSum += org;
      maintSum += maint;
      matureSum += mature;
      qualitySum += quality;

      return {
        ...r,
        qualityScore: quality,
        documentationScore: doc,
        complexityScore: comp,
        organizationScore: org,
        maintenanceScore: maint,
        maturityScore: mature
      };
    });

    const divisor = totalRepositories || 1;
    const avgDoc = Math.round(docSum / divisor);
    const avgComp = Math.round(compSum / divisor);
    const avgOrg = Math.round(orgSum / divisor);
    const avgMaint = Math.round(maintSum / divisor);
    const avgMature = Math.round(matureSum / divisor);
    const repositoryScore = totalRepositories > 0 ? Math.round(qualitySum / divisor) : 0;

    const repoQualityScore: GitHubRepoQuality[] = [
      { subject: "Documentation", A: avgDoc },
      { subject: "Complexity", A: avgComp },
      { subject: "Organization", A: avgOrg },
      { subject: "Maintenance", A: avgMaint },
      { subject: "Maturity", A: avgMature },
      { subject: "License Score", A: totalRepositories > 0 ? Math.round(reposList.filter((r) => r.license !== "Not available from platform.").length / divisor * 100) : 0 }
    ];

    // 7. Core Sub-Scores Calculations (0 - 100)
    
    // Technology Diversity: distinct languages Count
    const uniqueLangsCount = Object.keys(langStats).length;
    const technologyDiversity = Math.min(100, uniqueLangsCount * 20);

    // Project Diversity: number of unique active categories out of 20
    const activeCategories = new Set<string>();
    repos.forEach((r) => {
      if (Array.isArray(r.classifications)) {
        r.classifications.forEach((c: string) => activeCategories.add(c));
      }
    });
    const projectDiversity = Math.min(100, activeCategories.size * 15);

    // Activity Score
    let activityScore = 0;
    if (hasCalendar) {
      const commitsScore = Math.min(100, Math.round((thisYearCommits / 150) * 100));
      const streakScore = Math.min(100, Math.round((activeDays / 60) * 100));
      const velocityScore = Math.min(100, Math.round((thisMonthCommits / 25) * 100));
      activityScore = Math.round(commitsScore * 0.4 + streakScore * 0.3 + velocityScore * 0.3);
    } else {
      // Proxy activity based on commit totals
      activityScore = Math.min(100, Math.round((totalCommits / 250) * 100));
    }

    // Open Source Score
    const prScore = Math.min(100, prMergedCount * 15);
    const issueScore = Math.min(100, issuesClosedCount * 8);
    const forkScore = Math.min(100, forkContributions * 10);
    const openSourceScoreVal = Math.min(100, Math.round(prScore * 0.5 + issueScore * 0.25 + forkScore * 0.25));

    // Portfolio Score
    const sizeScore = Math.min(100, Math.round((totalRepositories / 15) * 100));
    const engagementScore = Math.min(100, totalStars * 8 + totalForks * 12);
    const portfolioScoreVal = Math.round(sizeScore * 0.3 + engagementScore * 0.3 + projectDiversity * 0.4);

    // Developer Score (weighted aggregation)
    const developerScoreVal = Math.round(
      repositoryScore * 0.20 +
      activityScore * 0.20 +
      openSourceScoreVal * 0.20 +
      avgDoc * 0.15 +
      technologyDiversity * 0.15 +
      portfolioScoreVal * 0.10
    );

    const developerScore: GitHubDeveloperScoreDetails = {
      score: Math.min(100, Math.max(10, developerScoreVal)),
      quality: avgOrg,
      codingActivity: Math.min(100, Math.round((thisYearCommits / 200) * 100)),
      consistency: hasCalendar ? Math.min(100, Math.round((activeDays / 120) * 100)) : 40,
      openSource: openSourceScoreVal,
      technologyDiversity,
      documentation: avgDoc,
      complexity: avgComp,
      community: Math.min(100, Math.round((totalStars * 10 + totalForks * 5 + user.followers.totalCount * 8)))
    };

    // 8. Repository Intelligence (extract outstanding nodes)
    const sortedByStars = [...reposWithScores].sort((a, b) => b.stars - a.stars);
    const sortedByForks = [...reposWithScores].sort((a, b) => b.forks - a.forks);
    const sortedByCommits = [...reposWithScores].sort((a, b) => b.commits - a.commits);
    const sortedBySize = [...reposWithScores].sort((a, b) => b.size - a.size);
    const sortedByCreated = [...reposWithScores].sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
    const sortedByUpdated = [...reposWithScores].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    const intelligence = {
      mostStarredRepository: sortedByStars[0]?.name || "Not available from platform.",
      mostForkedRepository: sortedByForks[0]?.name || "Not available from platform.",
      mostActiveRepository: sortedByCommits[0]?.name || "Not available from platform.",
      largestRepository: sortedBySize[0]?.name || "Not available from platform.",
      newestRepository: sortedByCreated[sortedByCreated.length - 1]?.name || "Not available from platform.",
      oldestRepository: sortedByCreated[0]?.name || "Not available from platform.",
      mostRecentlyUpdatedRepository: sortedByUpdated[0]?.name || "Not available from platform."
    };

    // 9. AI Career Insights
    const strongestSkills = languages.slice(0, 3).map((l) => l.name);
    const weaknesses: string[] = [];
    if (avgDoc < 60) weaknesses.push("Documentation details and README sizes could be expanded.");
    if (hasCalendar && activeDays < 45) weaknesses.push("Consistency in coding schedule could be improved.");
    if (prMergedCount === 0) weaknesses.push("Limited open-source pull request contributions.");
    if (languages.length < 3) weaknesses.push("Concentration in very few programming languages.");
    if (weaknesses.length === 0) weaknesses.push("Maintain deep unit testing coverage across projects.");

    const missingTechnologies: string[] = [];
    const recommendedLearningPath: string[] = [];
    const suggestedProjects: string[] = [];

    if (strongestSkills.includes("JavaScript") || strongestSkills.includes("TypeScript")) {
      missingTechnologies.push("Jest/Cypress", "Docker", "Redis");
      recommendedLearningPath.push(
        "Master frontend testing with Jest and React Testing Library",
        "Docker containerization for Node.js backend APIs",
        "Microservices architecture structure"
      );
      suggestedProjects.push(
        "Build a multi-tenant SaaS admin template with test coverage",
        "Design a high-concurrency real-time notifications service using Redis"
      );
    } else if (strongestSkills.includes("Python")) {
      missingTechnologies.push("FastAPI", "PyTest", "Docker", "Kubernetes");
      recommendedLearningPath.push(
        "REST API optimizations with FastAPI async endpoints",
        "Unit testing frameworks with PyTest mocks",
        "Deploying machine learning pipelines with Docker & Kubernetes"
      );
      suggestedProjects.push(
        "Build a document summary CLI tool using custom LLM embedding algorithms",
        "Create an API rate limiting wrapper using Python and Redis cache"
      );
    } else {
      missingTechnologies.push("GitHub Actions CI/CD", "Docker", "GraphQL");
      recommendedLearningPath.push(
        "Automating build pipelines with GitHub Actions CI/CD workflows",
        "Containerizing local microservices with Docker",
        "GraphQL API architectures and schema design"
      );
      suggestedProjects.push(
        "Create a custom package repository with CI/CD distribution automation",
        "Build a CLI tool that scrapes and analyzes local system directories"
      );
    }

    const hiringReadiness =
      developerScoreVal >= 85 ? "Immediate Tier-1 Ready" :
      developerScoreVal >= 70 ? "Product SDE Ready" :
      developerScoreVal >= 50 ? "Standard SDE Ready" : "Emerging Developer";

    const resumeStrength = Math.round(developerScoreVal * 0.95 + (user.isHireable ? 5 : 0));
    const portfolioStrength = Math.round(avgOrg * 0.5 + avgComp * 0.3 + avgDoc * 0.2);
    const openSourceReadiness = prMergedCount > 5 ? "High" : prMergedCount > 0 ? "Medium" : "Low";
    const industryReadiness = Math.round((developerScoreVal + avgMaint + avgDoc) / 3);

    const careerInsights: GitHubCareerInsights = {
      strongestSkills,
      weaknesses,
      missingTechnologies,
      recommendedLearningPath,
      hiringReadiness,
      resumeStrength,
      portfolioStrength,
      openSourceReadiness,
      industryReadiness,
      suggestedProjects,
      interviewPrep: [
        "Data structures (specifically trees, hash maps, queues)",
        "System Design patterns (API gateways, caching layers)",
        "Behavioral criteria (collaborating on pull request threads)"
      ]
    };

    // 10. Profile Details
    const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
    const accountAgeYears = parseFloat((accountAgeMs / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));

    const orgsListLogins = (user.organizations?.nodes || []).map((o: any) => o.login);

    const profileDetails: GitHubProfileDetails = {
      username: user.login,
      name: user.name || "Not available from platform.",
      bio: user.bio || "Not available from platform.",
      avatarUrl: user.avatarUrl,
      followers: user.followers?.totalCount || 0,
      following: user.following?.totalCount || 0,
      publicRepos: user.publicRepositories?.totalCount || 0,
      publicGists: user.gists?.totalCount || 0,
      company: user.company || "Not available from platform.",
      location: user.location || "Not available from platform.",
      blog: user.websiteUrl || "Not available from platform.",
      twitter: user.twitterUsername || "Not available from platform.",
      email: user.email || "Not available from platform.",
      accountAgeYears,
      createdDate: new Date(user.createdAt).toLocaleDateString(),
      lastUpdate: new Date(user.updatedAt).toLocaleDateString(),
      isHireable: !!user.isHireable,
      organizationsList: orgsListLogins,
      pinnedRepositories: user.pinnedItems?.nodes || []
    } as any;

    return {
      totalRepositories,
      totalStars,
      totalForks,
      followers: user.followers?.totalCount || 0,
      openSourceScore: developerScore.score,
      contributions,
      languages,
      repos: {
        list: reposWithScores,
        intelligence,
        portfolio,
        commitAnalytics,
        openSource,
        careerInsights,
        profileDetails,
        developerScore
      },
      commitTimeline,
      repoQualityScore,
      streaks,
      commitAnalytics,
      openSource,
      portfolio,
      careerInsights,
      profileDetails,
      developerScore
    };
  }
}
