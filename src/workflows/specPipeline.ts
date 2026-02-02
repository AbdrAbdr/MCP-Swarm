import fs from "node:fs/promises";
import path from "node:path";

import { git } from "./git.js";
import { getRepoRoot } from "./repo.js";

/**
 * Spec Pipeline: gatherer → researcher → writer → critic
 * 
 * A structured pipeline for creating specifications through 4 roles:
 * 1. GATHERER - Collects requirements, constraints, context
 * 2. RESEARCHER - Investigates prior art, patterns, tradeoffs
 * 3. WRITER - Produces the spec document
 * 4. CRITIC - Reviews and identifies gaps/issues
 */

export type SpecRole = "gatherer" | "researcher" | "writer" | "critic";

export type SpecPhase = {
  role: SpecRole;
  status: "pending" | "in_progress" | "completed";
  startedAt?: number;
  completedAt?: number;
  output?: string;
  feedback?: string;
  [key: string]: unknown;
};

export type SpecPipeline = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  currentRole: SpecRole;
  status: "active" | "completed" | "stalled";
  phases: {
    gatherer: SpecPhase;
    researcher: SpecPhase;
    writer: SpecPhase;
    critic: SpecPhase;
  };
  iterations: number;
  maxIterations: number;
  finalSpec?: string;
  [key: string]: unknown;
};

async function safePush(repoRoot: string): Promise<void> {
  try {
    await git(["push"], { cwd: repoRoot });
  } catch {
    await git(["push", "-u", "origin", "HEAD"], { cwd: repoRoot });
  }
}

async function ensureSpecDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "orchestrator", "specs");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadPipeline(repoRoot: string, pipelineId: string): Promise<SpecPipeline | null> {
  const specDir = await ensureSpecDir(repoRoot);
  const filePath = path.join(specDir, `${pipelineId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function savePipeline(repoRoot: string, pipeline: SpecPipeline, commitMode: "none" | "local" | "push"): Promise<void> {
  const specDir = await ensureSpecDir(repoRoot);
  const filePath = path.join(specDir, `${pipeline.id}.json`);
  
  pipeline.updatedAt = Date.now();
  await fs.writeFile(filePath, JSON.stringify(pipeline, null, 2) + "\n", "utf8");
  
  const relPath = path.posix.join("orchestrator", "specs", `${pipeline.id}.json`);
  
  if (commitMode !== "none") {
    await git(["add", relPath], { cwd: repoRoot });
    await git(["commit", "-m", `spec-pipeline: ${pipeline.currentRole} phase for ${pipeline.title}`], { cwd: repoRoot });
    if (commitMode === "push") await safePush(repoRoot);
  }
}

// ==================== TOOL FUNCTIONS ====================

/**
 * Start a new spec pipeline
 */
export async function startSpecPipeline(input: {
  repoPath?: string;
  title: string;
  description: string;
  maxIterations?: number;
  commitMode: "none" | "local" | "push";
}): Promise<{ pipelineId: string; currentRole: SpecRole }> {
  const repoRoot = input.repoPath || process.cwd();
  
  const pipelineId = `spec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const pipeline: SpecPipeline = {
    id: pipelineId,
    title: input.title,
    description: input.description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentRole: "gatherer",
    status: "active",
    phases: {
      gatherer: { role: "gatherer", status: "pending" },
      researcher: { role: "researcher", status: "pending" },
      writer: { role: "writer", status: "pending" },
      critic: { role: "critic", status: "pending" },
    },
    iterations: 0,
    maxIterations: input.maxIterations || 3,
  };
  
  await savePipeline(repoRoot, pipeline, input.commitMode);
  
  return { pipelineId, currentRole: "gatherer" };
}

/**
 * Start working on a role's phase
 */
export async function startSpecPhase(input: {
  repoPath?: string;
  pipelineId: string;
  role: SpecRole;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; instructions: string }> {
  const repoRoot = input.repoPath || process.cwd();
  const pipeline = await loadPipeline(repoRoot, input.pipelineId);
  
  if (!pipeline) {
    return { success: false, instructions: `Pipeline ${input.pipelineId} not found` };
  }
  
  if (pipeline.currentRole !== input.role) {
    return { 
      success: false, 
      instructions: `Cannot start ${input.role} phase. Current role is ${pipeline.currentRole}` 
    };
  }
  
  pipeline.phases[input.role].status = "in_progress";
  pipeline.phases[input.role].startedAt = Date.now();
  
  await savePipeline(repoRoot, pipeline, input.commitMode);
  
  const instructions: Record<SpecRole, string> = {
    gatherer: `
## GATHERER PHASE

Your job is to GATHER all requirements and context. Ask questions like:
1. What problem are we solving?
2. Who are the stakeholders?
3. What are the constraints (time, budget, tech)?
4. What does success look like?
5. What are the non-functional requirements (performance, security)?
6. What existing systems must we integrate with?

OUTPUT: A structured list of requirements, constraints, and success criteria.
`,
    researcher: `
## RESEARCHER PHASE

Your job is to RESEARCH prior art and patterns. Investigate:
1. How have others solved this problem?
2. What libraries/frameworks exist?
3. What are common pitfalls?
4. What are the tradeoffs between approaches?
5. Are there any standards or best practices?

OUTPUT: Research findings with pros/cons of different approaches.
`,
    writer: `
## WRITER PHASE

Your job is to WRITE the specification document. Include:
1. **Overview** - What we're building and why
2. **Requirements** - From gatherer phase
3. **Architecture** - High-level design
4. **Components** - Detailed breakdown
5. **Interfaces** - APIs, data contracts
6. **Testing Strategy** - How we verify it works
7. **Rollout Plan** - How we deploy

OUTPUT: A complete specification document in markdown.
`,
    critic: `
## CRITIC PHASE

Your job is to CRITIQUE the spec. Check for:
1. **Completeness** - Are any requirements missing?
2. **Clarity** - Is anything ambiguous?
3. **Feasibility** - Can this actually be built?
4. **Consistency** - Do parts contradict each other?
5. **Testability** - Can we verify the requirements?
6. **Security** - Any security concerns?
7. **Performance** - Any scalability issues?

OUTPUT: List of issues, questions, and suggestions. Be specific!
`,
  };
  
  return { success: true, instructions: instructions[input.role] };
}

/**
 * Complete a role's phase with output
 */
export async function completeSpecPhase(input: {
  repoPath?: string;
  pipelineId: string;
  role: SpecRole;
  output: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; nextRole: SpecRole | "done"; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  const pipeline = await loadPipeline(repoRoot, input.pipelineId);
  
  if (!pipeline) {
    return { success: false, nextRole: "gatherer", message: `Pipeline ${input.pipelineId} not found` };
  }
  
  if (pipeline.currentRole !== input.role) {
    return { 
      success: false, 
      nextRole: pipeline.currentRole,
      message: `Cannot complete ${input.role}. Current role is ${pipeline.currentRole}` 
    };
  }
  
  pipeline.phases[input.role].status = "completed";
  pipeline.phases[input.role].completedAt = Date.now();
  pipeline.phases[input.role].output = input.output;
  
  // Determine next role
  const roleOrder: SpecRole[] = ["gatherer", "researcher", "writer", "critic"];
  const currentIndex = roleOrder.indexOf(input.role);
  
  if (currentIndex < roleOrder.length - 1) {
    // Move to next role
    pipeline.currentRole = roleOrder[currentIndex + 1];
    await savePipeline(repoRoot, pipeline, input.commitMode);
    return { 
      success: true, 
      nextRole: pipeline.currentRole,
      message: `${input.role} phase completed. Moving to ${pipeline.currentRole} phase.`
    };
  } else {
    // Critic phase completed - check if we need another iteration
    pipeline.iterations++;
    
    if (pipeline.iterations >= pipeline.maxIterations) {
      // Finalize
      pipeline.status = "completed";
      pipeline.finalSpec = pipeline.phases.writer.output;
      await savePipeline(repoRoot, pipeline, input.commitMode);
      return {
        success: true,
        nextRole: "done",
        message: `Spec pipeline completed after ${pipeline.iterations} iterations!`
      };
    } else {
      // Loop back to writer with critic feedback
      pipeline.currentRole = "writer";
      pipeline.phases.writer.status = "pending";
      pipeline.phases.writer.feedback = input.output; // critic's output becomes writer's feedback
      pipeline.phases.critic.status = "pending";
      
      await savePipeline(repoRoot, pipeline, input.commitMode);
      return {
        success: true,
        nextRole: "writer",
        message: `Iteration ${pipeline.iterations}/${pipeline.maxIterations} complete. Writer needs to address critic's feedback.`
      };
    }
  }
}

/**
 * Get pipeline status
 */
export async function getSpecPipeline(input: {
  repoPath?: string;
  pipelineId: string;
}): Promise<{ pipeline: SpecPipeline | null }> {
  const repoRoot = input.repoPath || process.cwd();
  const pipeline = await loadPipeline(repoRoot, input.pipelineId);
  return { pipeline };
}

/**
 * List all spec pipelines
 */
export async function listSpecPipelines(input: {
  repoPath?: string;
  status?: "active" | "completed" | "stalled";
}): Promise<{ pipelines: Array<{ id: string; title: string; status: string; currentRole: SpecRole; iterations: number }> }> {
  const repoRoot = input.repoPath || process.cwd();
  const specDir = await ensureSpecDir(repoRoot);
  
  const files = await fs.readdir(specDir).catch(() => []);
  const pipelines: Array<{ id: string; title: string; status: string; currentRole: SpecRole; iterations: number }> = [];
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(specDir, file), "utf8");
      const p: SpecPipeline = JSON.parse(raw);
      if (!input.status || p.status === input.status) {
        pipelines.push({
          id: p.id,
          title: p.title,
          status: p.status,
          currentRole: p.currentRole,
          iterations: p.iterations,
        });
      }
    } catch {
      // skip invalid files
    }
  }
  
  return { pipelines };
}

/**
 * Export final spec as markdown
 */
export async function exportSpecAsMarkdown(input: {
  repoPath?: string;
  pipelineId: string;
  commitMode: "none" | "local" | "push";
}): Promise<{ success: boolean; filePath?: string; message: string }> {
  const repoRoot = input.repoPath || process.cwd();
  const pipeline = await loadPipeline(repoRoot, input.pipelineId);
  
  if (!pipeline) {
    return { success: false, message: `Pipeline ${input.pipelineId} not found` };
  }
  
  const docsDir = path.join(repoRoot, "docs", "specs");
  await fs.mkdir(docsDir, { recursive: true });
  
  const safeTitle = pipeline.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const mdPath = path.join(docsDir, `${safeTitle}.md`);
  
  const md = `# ${pipeline.title}

**Created:** ${new Date(pipeline.createdAt).toISOString()}
**Status:** ${pipeline.status}
**Iterations:** ${pipeline.iterations}

## Description
${pipeline.description}

---

## Gathered Requirements
${pipeline.phases.gatherer.output || "_Not completed_"}

---

## Research Findings
${pipeline.phases.researcher.output || "_Not completed_"}

---

## Specification
${pipeline.phases.writer.output || "_Not completed_"}

---

## Critic Feedback
${pipeline.phases.critic.output || "_Not completed_"}

---

_Generated by MCP Swarm Spec Pipeline_
`;

  await fs.writeFile(mdPath, md, "utf8");
  
  const relPath = path.posix.join("docs", "specs", `${safeTitle}.md`);
  
  if (input.commitMode !== "none") {
    await git(["add", relPath], { cwd: repoRoot });
    await git(["commit", "-m", `docs: spec for ${pipeline.title}`], { cwd: repoRoot });
    if (input.commitMode === "push") await safePush(repoRoot);
  }
  
  return { success: true, filePath: relPath, message: "Spec exported to markdown" };
}
