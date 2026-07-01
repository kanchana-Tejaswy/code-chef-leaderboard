const token = process.env.GITHUB_TOKEN;

// simple in-memory cache
class MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private defaultTtlMs = 10 * 60 * 1000; // 10 minutes default

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: any, ttlMs: number = this.defaultTtlMs): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const githubCache = new MemoryCache();

interface RequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  useCache?: boolean;
}

/**
 * Handle HTTP response and checks for rate-limit details or HTTP errors.
 */
async function handleResponse(response: Response) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");

  if (remaining && parseInt(remaining) === 0) {
    const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : "unknown";
    throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}.`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`GitHub API HTTP ${response.status} ${response.statusText}: ${errorText || "No response details"}`);
  }

  return response.json();
}

/**
 * Queries the GitHub GraphQL API with retry mechanism, in-memory caching, and timeout checks.
 */
export async function queryGitHubGraphQL(
  query: string,
  variables: Record<string, any>,
  options: RequestOptions = {}
): Promise<any> {
  const { timeoutMs = 15000, maxRetries = 3, useCache = true } = options;

  if (!token) {
    throw new Error("GITHUB_TOKEN is missing in environment variables.");
  }

  const cacheKey = `graphql:${JSON.stringify({ query, variables })}`;
  if (useCache) {
    const cached = githubCache.get(cacheKey);
    if (cached) return cached;
  }

  const url = "https://api.github.com/graphql";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `bearer ${token}`,
          "User-Agent": "ACE-Platform-Analytics"
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const payload = await handleResponse(response);
      if (payload.errors) {
        throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
      }

      const data = payload.data;
      if (useCache && data) {
        githubCache.set(cacheKey, data);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`GitHub GraphQL attempt ${attempt}/${maxRetries} failed:`, err.message || err);

      if (attempt === maxRetries || err.message?.includes("rate limit exceeded")) {
        throw err;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
}

/**
 * Queries the GitHub REST API with retry mechanism, in-memory caching, and timeout checks.
 */
export async function queryGitHubREST(
  endpoint: string,
  options: RequestOptions = {}
): Promise<any> {
  const { timeoutMs = 15000, maxRetries = 3, useCache = true } = options;

  if (!token) {
    throw new Error("GITHUB_TOKEN is missing in environment variables.");
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const cacheKey = `rest:${cleanEndpoint}`;

  if (useCache) {
    const cached = githubCache.get(cacheKey);
    if (cached) return cached;
  }

  const url = `https://api.github.com${cleanEndpoint}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${token}`,
          "User-Agent": "ACE-Platform-Analytics",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await handleResponse(response);
      if (useCache && data) {
        githubCache.set(cacheKey, data);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`GitHub REST API attempt ${attempt}/${maxRetries} failed for ${cleanEndpoint}:`, err.message || err);

      if (attempt === maxRetries || err.message?.includes("rate limit exceeded")) {
        throw err;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
}
