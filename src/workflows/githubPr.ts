import { git, gitTry, normalizeLineEndings } from "./git.js";
import { getRepoRoot } from "./repo.js";
import { getErrorMessage } from "../utils/errorUtils.js";

export type CreatePrInput = {
  repoPath?: string;
  title: string;
  body?: string;
  baseBranch?: string;
  draft?: boolean;
};

export type CreatePrOutput = {
  repoRoot: string;
  branch: string;
  baseBranch: string;
  prUrl?: string;
  error?: string;
};

export async function createGithubPr(input: CreatePrInput): Promise<CreatePrOutput> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const baseBranch = input.baseBranch || process.env.SWARM_BASE_BRANCH || "main";

  const headRes = await gitTry(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot });
  const branch = normalizeLineEndings(headRes.stdout).trim();

  if (!branch || branch === "HEAD" || branch === baseBranch) {
    return { repoRoot, branch, baseBranch, error: "Cannot create PR from base branch itself" };
  }

  // Ensure pushed
  await gitTry(["push", "-u", "origin", branch], { cwd: repoRoot });

  // Try gh CLI
  const args = ["pr", "create", "--base", baseBranch, "--head", branch, "--title", input.title];
  if (input.body) args.push("--body", input.body);
  if (input.draft) args.push("--draft");

  const result = await gitTry(["gh", ...args.slice(1)], { cwd: repoRoot });

  // gh is not installed via git, try direct
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    const ghArgs = ["pr", "create", "--base", baseBranch, "--head", branch, "--title", input.title];
    if (input.body) ghArgs.push("--body", input.body);
    if (input.draft) ghArgs.push("--draft");

    const { stdout } = await execFileAsync("gh", ghArgs, { cwd: repoRoot, windowsHide: true });
    const prUrl = normalizeLineEndings(stdout).trim();
    return { repoRoot, branch, baseBranch, prUrl };
  } catch (err: unknown) {
    return { repoRoot, branch, baseBranch, error: getErrorMessage(err) || "gh CLI failed" };
  }
}

export async function checkMainHealth(input: {
  repoPath?: string;
  baseBranch?: string;
}): Promise<{ healthy: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const baseBranch = input.baseBranch || process.env.SWARM_BASE_BRANCH || "main";

  await gitTry(["fetch", "origin", baseBranch], { cwd: repoRoot });

  // Check if we can reach origin/baseBranch
  const res = await gitTry(["rev-parse", `origin/${baseBranch}`], { cwd: repoRoot });
  if (!res.ok) {
    return { healthy: false, message: `Cannot reach origin/${baseBranch}` };
  }

  // Try to run tests if package.json has test script
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const pkgPath = path.join(repoRoot, "package.json");

  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    if (pkg?.scripts?.test) {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);

      try {
        await execFileAsync("npm", ["test"], { cwd: repoRoot, windowsHide: true, timeout: 120000 });
        return { healthy: true, message: "Tests passed" };
      } catch {
        return { healthy: false, message: "Tests failed on base branch" };
      }
    }
  } catch {
    // no package.json or no test script
  }

  return { healthy: true, message: "No tests configured, assuming healthy" };
}
