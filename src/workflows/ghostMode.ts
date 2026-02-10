import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

import { git, gitTry, normalizeLineEndings } from "./git.js";
import { getRepoRoot } from "./repo.js";

const execFileAsync = promisify(execFile);

export type PatrolResult = {
  lintErrors: number;
  lintFixed: number;
  unusedImports: string[];
  suggestedOptimizations: string[];
  filesChecked: number;
};

async function runLinter(repoRoot: string): Promise<{ errors: number; fixed: number }> {
  // Try eslint --fix
  try {
    const pkgPath = path.join(repoRoot, "package.json");
    const raw = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);

    if (pkg?.scripts?.lint) {
      try {
        await execFileAsync("npm", ["run", "lint", "--", "--fix"], {
          cwd: repoRoot,
          windowsHide: true,
          timeout: 60000
        });
        return { errors: 0, fixed: 0 };
      } catch (err: unknown) {
        // Parse eslint output for error count
        const e = err as Record<string, unknown> | undefined;
        const output = String(e?.stdout || e?.stderr || "");
        const errorMatch = output.match(/(\d+)\s*error/);
        const errors = errorMatch ? parseInt(errorMatch[1], 10) : 1;
        return { errors, fixed: 0 };
      }
    }
  } catch {
    // no package.json or no lint script
  }

  return { errors: 0, fixed: 0 };
}

async function findUnusedImports(repoRoot: string): Promise<string[]> {
  const unused: string[] = [];

  // Simple heuristic: find imports that are declared but not used
  // This is a basic check - real implementation would use AST parsing
  try {
    const res = await gitTry(["ls-files", "*.ts", "*.tsx", "*.js", "*.jsx"], { cwd: repoRoot });
    const files = normalizeLineEndings(res.stdout).trim().split("\n").filter(Boolean);

    for (const file of files.slice(0, 20)) { // limit to 20 files
      try {
        const content = await fs.readFile(path.join(repoRoot, file), "utf8");
        const importMatches = content.matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from/g);

        for (const match of importMatches) {
          const imported = match[1] || match[2];
          if (!imported) continue;

          const names = imported.split(",").map(n => n.trim().split(" as ")[0].trim());
          for (const name of names) {
            if (!name) continue;
            // Check if name appears elsewhere in file (excluding imports)
            const restOfFile = content.replace(/import\s+.+from.+;?/g, "");
            if (!restOfFile.includes(name)) {
              unused.push(`${file}: ${name}`);
            }
          }
        }
      } catch {
        // ignore file read errors
      }
    }
  } catch {
    // ignore
  }

  return unused.slice(0, 10); // limit results
}

async function checkForOptimizations(repoRoot: string): Promise<string[]> {
  const suggestions: string[] = [];

  // Check for common issues
  try {
    // Large files
    const res = await gitTry(["ls-files"], { cwd: repoRoot });
    const files = normalizeLineEndings(res.stdout).trim().split("\n").filter(Boolean);

    for (const file of files) {
      if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;
      try {
        const stat = await fs.stat(path.join(repoRoot, file));
        if (stat.size > 50000) { // 50KB
          suggestions.push(`Large file: ${file} (${Math.round(stat.size / 1024)}KB) - consider splitting`);
        }
      } catch {
        // ignore
      }
    }

    // Check for console.log in production code
    const grepRes = await gitTry(["grep", "-l", "console.log", "--", "*.ts", "*.tsx"], { cwd: repoRoot });
    if (grepRes.ok) {
      const filesWithLog = normalizeLineEndings(grepRes.stdout).trim().split("\n").filter(Boolean);
      if (filesWithLog.length > 0) {
        suggestions.push(`Found console.log in ${filesWithLog.length} files - consider removing for production`);
      }
    }
  } catch {
    // ignore
  }

  return suggestions.slice(0, 5);
}

export async function patrolMode(input: {
  repoPath?: string;
  runLint?: boolean;
  checkImports?: boolean;
  checkOptimizations?: boolean;
}): Promise<PatrolResult> {
  const repoRoot = await getRepoRoot(input.repoPath);

  let lintErrors = 0;
  let lintFixed = 0;
  let unusedImports: string[] = [];
  let suggestedOptimizations: string[] = [];
  let filesChecked = 0;

  // Run linter
  if (input.runLint !== false) {
    const lint = await runLinter(repoRoot);
    lintErrors = lint.errors;
    lintFixed = lint.fixed;
  }

  // Check imports
  if (input.checkImports !== false) {
    unusedImports = await findUnusedImports(repoRoot);
  }

  // Check optimizations
  if (input.checkOptimizations !== false) {
    suggestedOptimizations = await checkForOptimizations(repoRoot);
  }

  // Count files
  try {
    const res = await gitTry(["ls-files", "--", "*.ts", "*.tsx", "*.js", "*.jsx"], { cwd: repoRoot });
    filesChecked = normalizeLineEndings(res.stdout).trim().split("\n").filter(Boolean).length;
  } catch {
    // ignore
  }

  return {
    lintErrors,
    lintFixed,
    unusedImports,
    suggestedOptimizations,
    filesChecked,
  };
}
