import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getErrorMessage } from "../utils/errorUtils.js";

const execFileAsync = promisify(execFile);

export async function git(
  args: string[],
  opts: { cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd: opts.cwd,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
}

export async function gitTry(
  args: string[],
  opts: { cwd?: string } = {}
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await git(args, opts);
    return { ok: true, stdout, stderr };
  } catch (err: unknown) {
    const e = err as Record<string, unknown> | undefined;
    const stdout = String(e?.stdout ?? "");
    const stderr = String(e?.stderr ?? getErrorMessage(err));
    return { ok: false, stdout, stderr };
  }
}

export function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

export async function syncWithBaseBranch(opts: {
  repoRoot: string;
  baseBranch?: string;
}): Promise<{ baseBranch: string; rebased: boolean }> {
  const baseBranch = opts.baseBranch || process.env.SWARM_BASE_BRANCH || "main";

  await gitTry(["fetch", "origin", baseBranch], { cwd: opts.repoRoot });

  const head = await gitTry(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: opts.repoRoot });
  const currentBranch = normalizeLineEndings(head.stdout).trim();

  if (!currentBranch || currentBranch === "HEAD" || currentBranch === baseBranch) {
    return { baseBranch, rebased: false };
  }

  await git(["rebase", `origin/${baseBranch}`], { cwd: opts.repoRoot });
  return { baseBranch, rebased: true };
}
