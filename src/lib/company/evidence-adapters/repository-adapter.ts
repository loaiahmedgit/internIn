import "server-only";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_TREE_ENTRIES = 40;

/**
 * Best-effort real evidence from a public code-repository link the student
 * provided — README + top-level file listing, via each host's own public
 * API (no auth token, so only public repos are readable; that's an honest
 * limitation, not a bug). Private/inaccessible/unsupported hosts return
 * null — the caller marks that "requires human review", never fabricates
 * file contents. Untrusted external data: only used as evidence text,
 * never as instructions.
 */
export async function fetchRepositorySummary(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [owner, repo] = segments;
  const repoName = repo.replace(/\.git$/, "");

  if (parsed.hostname === "github.com") return fetchGithubSummary(owner, repoName);
  if (parsed.hostname === "gitlab.com") return fetchGitlabSummary(owner, repoName);
  return null;
}

async function safeJsonFetch(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/vnd.github+json", "User-Agent": "internIn-evidence-adapter" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchGithubSummary(owner: string, repo: string): Promise<string | null> {
  const [repoInfo, tree, readme] = await Promise.all([
    safeJsonFetch(`https://api.github.com/repos/${owner}/${repo}`),
    safeJsonFetch(`https://api.github.com/repos/${owner}/${repo}/contents/`),
    safeJsonFetch(`https://api.github.com/repos/${owner}/${repo}/readme`),
  ]);
  if (!repoInfo) return null; // private, missing, or rate-limited — honest "unavailable"

  const info = repoInfo as { description?: string; language?: string; stargazers_count?: number };
  const entries = Array.isArray(tree) ? (tree as { name: string; type: string }[]).slice(0, MAX_TREE_ENTRIES) : [];
  const readmeContent = readme && typeof readme === "object" && "content" in readme
    ? Buffer.from((readme as { content: string }).content, "base64").toString("utf8").slice(0, 4000)
    : null;

  return [
    `Repository: ${owner}/${repo}`,
    info.description ? `Description: ${info.description}` : null,
    info.language ? `Primary language: ${info.language}` : null,
    entries.length ? `Top-level files:\n${entries.map((e) => `- ${e.name} (${e.type})`).join("\n")}` : null,
    readmeContent ? `README:\n${readmeContent}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function fetchGitlabSummary(owner: string, repo: string): Promise<string | null> {
  const projectPath = encodeURIComponent(`${owner}/${repo}`);
  const projectInfo = await safeJsonFetch(`https://gitlab.com/api/v4/projects/${projectPath}`);
  if (!projectInfo) return null;

  const info = projectInfo as { description?: string; star_count?: number; default_branch?: string };
  const tree = await safeJsonFetch(
    `https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?ref=${info.default_branch ?? "main"}`,
  );
  const entries = Array.isArray(tree) ? (tree as { name: string; type: string }[]).slice(0, MAX_TREE_ENTRIES) : [];

  return [
    `Repository: ${owner}/${repo}`,
    info.description ? `Description: ${info.description}` : null,
    entries.length ? `Top-level files:\n${entries.map((e) => `- ${e.name} (${e.type})`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
