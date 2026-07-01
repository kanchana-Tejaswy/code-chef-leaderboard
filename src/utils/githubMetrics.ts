import { GitHubRepo } from "../types/github";

/**
 * Classifies a repository into portfolio project types based on metadata.
 */
export function classifyProject(repo: GitHubRepo): {
  isFullStack: boolean;
  isAI: boolean;
  isWeb: boolean;
  isMobile: boolean;
  isOpenSource: boolean;
  isCollege: boolean;
  isHackathon: boolean;
} {
  const name = (repo.name || "").toLowerCase();
  const desc = (repo.description || "").toLowerCase();
  const lang = (repo.language || "").toLowerCase();
  const topics = (repo.topics || []).map((t) => t.toLowerCase());

  // Topic & string helpers
  const matches = (keywords: string[]) => {
    return (
      keywords.some((kw) => name.includes(kw)) ||
      keywords.some((kw) => desc.includes(kw)) ||
      keywords.some((kw) => topics.includes(kw))
    );
  };

  // AI & Machine Learning indicators
  const isAI = matches([
    "ai",
    "ml",
    "machine-learning",
    "deep-learning",
    "neural",
    "openai",
    "pytorch",
    "tensorflow",
    "nlp",
    "llm",
    "keras",
    "artificial-intelligence",
    "stable-diffusion",
    "transformers",
    "computer-vision",
    "chatbot"
  ]);

  // Mobile indicators
  const isMobile =
    ["kotlin", "swift", "objective-c"].includes(lang) ||
    matches(["android", "ios", "mobile", "react-native", "flutter", "swiftui", "cordova"]);

  // Web indicators
  const isWeb =
    ["html", "css", "javascript", "typescript", "php"].includes(lang) ||
    matches(["web", "frontend", "react", "vue", "angular", "nextjs", "svelte", "bootstrap", "tailwind", "jquery"]);

  // Full Stack indicators (requires client-side languages + server/database indicators)
  const hasFrontend =
    ["javascript", "typescript", "html", "css"].includes(lang) ||
    matches(["react", "vue", "angular", "nextjs", "frontend", "client", "ui"]);
  
  const hasBackendOrDb =
    ["python", "java", "go", "rust", "c#", "php"].includes(lang) ||
    matches(["django", "spring", "node", "express", "fastapi", "server", "backend", "api", "database", "sql", "postgres", "mysql", "mongodb", "sqlite", "prisma"]);
  
  const isFullStack =
    matches(["fullstack", "full-stack", "mern", "mean"]) || (hasFrontend && hasBackendOrDb);

  // Open Source indicators (licensed and not a fork or explicitly tagged)
  const isOpenSource =
    (repo.license && repo.license !== "Not available from platform.") ||
    matches(["open-source", "oss", "hacktoberfest"]);

  // Hackathon indicators
  const isHackathon = matches(["hackathon", "hack", "submission", "hackfest", "devpost"]);

  // College/Academic indicators
  const isCollege = matches([
    "college",
    "university",
    "assignment",
    "lab",
    "academic",
    "course",
    "homework",
    "theory",
    "syllabus",
    "curriculum",
    "btech",
    "mtech"
  ]);

  return {
    isFullStack,
    isAI,
    isWeb: isWeb && !isMobile, // Exclude mobile from pure web
    isMobile,
    isOpenSource,
    isCollege,
    isHackathon
  };
}

/**
 * Calculates README quality score based on byte size.
 */
export function calculateReadmeScore(sizeInBytes: number): number {
  if (sizeInBytes >= 2500) return 100;
  if (sizeInBytes >= 1000) return 85;
  if (sizeInBytes >= 300) return 60;
  if (sizeInBytes > 0) return 30;
  return 0;
}

/**
 * Calculates overall documentation quality score (0 - 100).
 */
export function calculateDocumentationScore(
  readmeSize: number,
  hasLicense: boolean,
  topicsCount: number,
  hasDescription: boolean
): number {
  const readmeScore = calculateReadmeScore(readmeSize);
  const licenseScore = hasLicense ? 100 : 0;
  const topicsScore = Math.min(100, topicsCount * 20); // 5+ topics = max score
  const descScore = hasDescription ? 100 : 0;

  return Math.round(
    readmeScore * 0.5 + // 50% weight
    licenseScore * 0.2 + // 20% weight
    topicsScore * 0.15 + // 15% weight
    descScore * 0.15 // 15% weight
  );
}

/**
 * Calculates repository complexity score (0 - 100).
 */
export function calculateComplexityScore(stars: number, forks: number, commits: number, sizeKb: number): number {
  const starWeight = stars * 8;
  const forkWeight = forks * 12;
  const commitWeight = Math.min(40, commits * 0.4);
  const sizeWeight = Math.min(20, sizeKb / 200);

  return Math.round(Math.min(100, Math.max(10, starWeight + forkWeight + commitWeight + sizeWeight + 20)));
}

/**
 * Calculates code organization score (0 - 100).
 */
export function calculateOrganizationScore(topicsCount: number, hasDescription: boolean, sizeKb: number, defaultBranch: string): number {
  let score = 40; // Base score
  if (topicsCount > 0) score += 20;
  if (hasDescription) score += 20;
  if (["main", "master"].includes(defaultBranch.toLowerCase())) score += 10;
  if (sizeKb > 0 && sizeKb < 500000) score += 10; // Penalize massive monolithic folders without architecture
  return Math.min(100, score);
}

/**
 * Calculates repository maintenance score based on days since last update.
 */
export function calculateMaintenanceScore(lastUpdatedStr: string): number {
  const updatedDate = new Date(lastUpdatedStr);
  if (isNaN(updatedDate.getTime())) return 30;

  const diffMs = Date.now() - updatedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 30) return 100;
  if (diffDays <= 90) return 85;
  if (diffDays <= 180) return 60;
  if (diffDays <= 365) return 40;
  return 20;
}

/**
 * Calculates repository maturity score based on age.
 */
export function calculateMaturityScore(createdDateStr: string): number {
  const createdDate = new Date(createdDateStr);
  if (isNaN(createdDate.getTime())) return 50;

  const diffMs = Date.now() - createdDate.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

  if (diffYears >= 2) return 100;
  if (diffYears >= 1) return 85;
  if (diffYears >= 0.5) return 70;
  return 50;
}
