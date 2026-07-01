export async function queryGitHubGraphQL(query: string, variables: Record<string, any>): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is missing in environment variables.");
  }

  const url = "https://api.github.com/graphql";
  const maxRetries = 2;
  const timeoutMs = 12000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `bearer ${token}`,
          "User-Agent": "ACE-Platform"
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GitHub API HTTP ${response.status}: ${response.statusText}`);
      }

      const payload = await response.json();
      if (payload.errors) {
        throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
      }

      return payload.data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`GitHub GraphQL attempt ${attempt} failed:`, err.message || err);
      if (attempt === maxRetries) {
        throw err;
      }
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
}
