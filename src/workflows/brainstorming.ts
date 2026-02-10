/**
 * Brainstorming Skill - Interactive Design Refinement
 * 
 * Based on superpowers brainstorming methodology:
 * - Ask questions one at a time (multiple choice preferred)
 * - Validate design in sections (200-300 words each)
 * - Save design documents to docs/plans/
 * 
 * v0.6.0
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export interface BrainstormSession {
  [key: string]: unknown;
  id: string;
  taskId?: string;
  agentId: string;
  status: "gathering" | "exploring" | "designing" | "validating" | "completed";
  createdAt: string;
  updatedAt: string;

  // Gathered context
  projectContext?: ProjectContext;

  // Questions and answers
  questions: BrainstormQuestion[];

  // Design sections
  designSections: DesignSection[];

  // Final design document path
  designDocPath?: string;
}

export interface ProjectContext {
  recentCommits: string[];
  mainFiles: string[];
  techStack: string[];
  existingPatterns: string[];
}

export interface BrainstormQuestion {
  id: string;
  questionNumber: number;
  type: "multiple_choice" | "open_ended" | "yes_no" | "priority_ranking";
  question: string;
  options?: QuestionOption[];
  answer?: string;
  answeredAt?: string;
  category: "purpose" | "constraints" | "success_criteria" | "approach" | "tradeoffs";
}

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface DesignSection {
  id: string;
  sectionNumber: number;
  title: string;
  content: string;  // 200-300 words max
  category: "architecture" | "components" | "data_flow" | "error_handling" | "testing" | "security" | "performance";
  validated: boolean;
  validatedAt?: string;
  feedback?: string;
}

export interface ApproachOption {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
}

// ============================================================================
// Storage
// ============================================================================

function getBrainstormDir(repoPath?: string): string {
  const root = repoPath || process.cwd();
  return path.join(root, "orchestrator", "brainstorm");
}

function getDesignDocsDir(repoPath?: string): string {
  const root = repoPath || process.cwd();
  return path.join(root, "docs", "plans");
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getSessionPath(sessionId: string, repoPath?: string): string {
  return path.join(getBrainstormDir(repoPath), `${sessionId}.json`);
}

function loadSession(sessionId: string, repoPath?: string): BrainstormSession | null {
  const sessionPath = getSessionPath(sessionId, repoPath);
  if (!fs.existsSync(sessionPath)) return null;
  return JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
}

function saveSession(session: BrainstormSession, repoPath?: string): void {
  ensureDir(getBrainstormDir(repoPath));
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(getSessionPath(session.id, repoPath), JSON.stringify(session, null, 2));
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Start a brainstorming session
 */
export function startBrainstorm(params: {
  agentId: string;
  taskId?: string;
  taskDescription?: string;
  repoPath?: string;
}): {
  session: BrainstormSession;
  nextStep: string;
  suggestedQuestions: BrainstormQuestion[];
} {
  const { agentId, taskId, taskDescription, repoPath } = params;

  const sessionId = `brainstorm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Analyze project context
  const projectContext = analyzeProjectContext(repoPath);

  // Generate initial questions based on task description
  const suggestedQuestions = generateInitialQuestions(taskDescription, projectContext);

  const session: BrainstormSession = {
    id: sessionId,
    taskId,
    agentId,
    status: "gathering",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectContext,
    questions: [],
    designSections: [],
  };

  saveSession(session, repoPath);

  return {
    session,
    nextStep: "Ask the first question to understand the user's intent. Use ask_brainstorm_question with the suggested question.",
    suggestedQuestions,
  };
}

/**
 * Ask a brainstorming question
 * Key principle: ONE question at a time, multiple choice preferred
 */
export function askBrainstormQuestion(params: {
  sessionId: string;
  question: string;
  type?: "multiple_choice" | "open_ended" | "yes_no" | "priority_ranking";
  options?: QuestionOption[];
  category?: "purpose" | "constraints" | "success_criteria" | "approach" | "tradeoffs";
  repoPath?: string;
}): {
  questionId: string;
  formattedQuestion: string;
  waitingForAnswer: boolean;
} {
  const { sessionId, question, type = "multiple_choice", options, category = "purpose", repoPath } = params;

  const session = loadSession(sessionId, repoPath);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const questionId = `q-${session.questions.length + 1}`;
  const questionNumber = session.questions.length + 1;

  const newQuestion: BrainstormQuestion = {
    id: questionId,
    questionNumber,
    type,
    question,
    options,
    category,
  };

  session.questions.push(newQuestion);
  session.status = "gathering";
  saveSession(session, repoPath);

  // Format question for display
  let formattedQuestion = `**Question ${questionNumber}:** ${question}\n\n`;

  if (options && options.length > 0) {
    options.forEach((opt, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C, ...
      const recommended = opt.recommended ? " *(Recommended)*" : "";
      formattedQuestion += `${letter}) ${opt.label}${recommended}\n`;
      if (opt.description) {
        formattedQuestion += `   ${opt.description}\n`;
      }
    });
  }

  return {
    questionId,
    formattedQuestion,
    waitingForAnswer: true,
  };
}

/**
 * Record answer to a question
 */
export function answerBrainstormQuestion(params: {
  sessionId: string;
  questionId: string;
  answer: string;
  repoPath?: string;
}): {
  recorded: boolean;
  questionsAnswered: number;
  questionsTotal: number;
  suggestNextQuestion: boolean;
  nextQuestionSuggestion?: BrainstormQuestion;
  readyForDesign: boolean;
} {
  const { sessionId, questionId, answer, repoPath } = params;

  const session = loadSession(sessionId, repoPath);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const question = session.questions.find(q => q.id === questionId);
  if (!question) throw new Error(`Question not found: ${questionId}`);

  question.answer = answer;
  question.answeredAt = new Date().toISOString();
  saveSession(session, repoPath);

  const questionsAnswered = session.questions.filter(q => q.answer).length;
  const questionsTotal = session.questions.length;

  // Check if we have enough information to proceed to design
  const categoriesCovered = new Set(session.questions.filter(q => q.answer).map(q => q.category));
  const requiredCategories = ["purpose", "constraints", "success_criteria"];
  const readyForDesign = requiredCategories.every(c => categoriesCovered.has(c as BrainstormQuestion["category"]));

  // Suggest next question if not ready
  let nextQuestionSuggestion: BrainstormQuestion | undefined;
  if (!readyForDesign) {
    const missingCategory = requiredCategories.find(c => !categoriesCovered.has(c as BrainstormQuestion["category"]));
    if (missingCategory) {
      nextQuestionSuggestion = generateQuestionForCategory(missingCategory as BrainstormQuestion["category"], session);
    }
  }

  return {
    recorded: true,
    questionsAnswered,
    questionsTotal,
    suggestNextQuestion: !readyForDesign,
    nextQuestionSuggestion,
    readyForDesign,
  };
}

/**
 * Propose multiple approaches with trade-offs
 */
export function proposeApproaches(params: {
  sessionId: string;
  approaches: ApproachOption[];
  repoPath?: string;
}): {
  formatted: string;
  waitingForSelection: boolean;
} {
  const { sessionId, approaches, repoPath } = params;

  const session = loadSession(sessionId, repoPath);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  session.status = "exploring";
  saveSession(session, repoPath);

  let formatted = "## Proposed Approaches\n\n";

  // Put recommended first
  const sortedApproaches = [...approaches].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return 0;
  });

  sortedApproaches.forEach((approach, i) => {
    const num = i + 1;
    const recommended = approach.recommended ? " ⭐ *Recommended*" : "";

    formatted += `### ${num}. ${approach.name}${recommended}\n\n`;
    formatted += `${approach.description}\n\n`;
    formatted += `**Effort:** ${approach.effort} | **Risk:** ${approach.risk}\n\n`;

    formatted += "**Pros:**\n";
    approach.pros.forEach(pro => {
      formatted += `- ✅ ${pro}\n`;
    });

    formatted += "\n**Cons:**\n";
    approach.cons.forEach(con => {
      formatted += `- ⚠️ ${con}\n`;
    });

    formatted += "\n---\n\n";
  });

  formatted += "\nWhich approach would you like to proceed with?";

  return {
    formatted,
    waitingForSelection: true,
  };
}

/**
 * Present a design section for validation (200-300 words max)
 */
export function presentDesignSection(params: {
  sessionId: string;
  title: string;
  content: string;
  category: "architecture" | "components" | "data_flow" | "error_handling" | "testing" | "security" | "performance";
  repoPath?: string;
}): {
  sectionId: string;
  formatted: string;
  wordCount: number;
  waitingForValidation: boolean;
} {
  const { sessionId, title, content, category, repoPath } = params;

  const session = loadSession(sessionId, repoPath);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const sectionId = `section-${session.designSections.length + 1}`;
  const sectionNumber = session.designSections.length + 1;

  // Word count check
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 350) {
    console.warn(`Design section exceeds recommended length: ${wordCount} words (max 300)`);
  }

  const section: DesignSection = {
    id: sectionId,
    sectionNumber,
    title,
    content,
    category,
    validated: false,
  };

  session.designSections.push(section);
  session.status = "designing";
  saveSession(session, repoPath);

  const formatted = `## Section ${sectionNumber}: ${title}\n\n${content}\n\n---\n\n**Does this look right so far?** If not, please share what needs to be clarified or changed.`;

  return {
    sectionId,
    formatted,
    wordCount,
    waitingForValidation: true,
  };
}

/**
 * Validate a design section
 */
export function validateDesignSection(params: {
  sessionId: string;
  sectionId: string;
  approved: boolean;
  feedback?: string;
  repoPath?: string;
}): {
  validated: boolean;
  sectionsValidated: number;
  sectionsTotal: number;
  allSectionsValidated: boolean;
} {
  const { sessionId, sectionId, approved, feedback, repoPath } = params;

  const session = loadSession(sessionId, repoPath);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const section = session.designSections.find(s => s.id === sectionId);
  if (!section) throw new Error(`Section not found: ${sectionId}`);

  section.validated = approved;
  section.validatedAt = new Date().toISOString();
  if (feedback) section.feedback = feedback;

  saveSession(session, repoPath);

  const sectionsValidated = session.designSections.filter(s => s.validated).length;
  const sectionsTotal = session.designSections.length;
  const allSectionsValidated = sectionsValidated === sectionsTotal && sectionsTotal > 0;

  if (allSectionsValidated) {
    session.status = "validating";
    saveSession(session, repoPath);
  }

  return {
    validated: approved,
    sectionsValidated,
    sectionsTotal,
    allSectionsValidated,
  };
}

/**
 * Save the final design document
 */
export function saveDesignDocument(params: {
  sessionId: string;
  title: string;
  summary?: string;
  repoPath?: string;
}): {
  documentPath: string;
  content: string;
} {
  const { sessionId, title, summary, repoPath } = params;

  const session = loadSession(sessionId, repoPath);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  ensureDir(getDesignDocsDir(repoPath));

  // Generate filename: YYYY-MM-DD-<topic>-design.md
  const date = new Date().toISOString().split("T")[0];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `${date}-${slug}-design.md`;
  const documentPath = path.join(getDesignDocsDir(repoPath), filename);

  // Build document content
  let content = `# ${title} - Design Document\n\n`;
  content += `> Generated: ${new Date().toISOString()}\n`;
  content += `> Session: ${sessionId}\n`;
  content += `> Agent: ${session.agentId}\n\n`;

  if (summary) {
    content += `## Summary\n\n${summary}\n\n`;
  }

  content += `---\n\n`;

  // Add Q&A section
  if (session.questions.length > 0) {
    content += `## Requirements Discovery\n\n`;
    session.questions.filter(q => q.answer).forEach(q => {
      content += `### ${q.question}\n\n`;
      content += `**Answer:** ${q.answer}\n\n`;
    });
    content += `---\n\n`;
  }

  // Add design sections
  if (session.designSections.length > 0) {
    content += `## Design\n\n`;
    session.designSections.forEach(section => {
      content += `### ${section.title}\n\n`;
      content += `${section.content}\n\n`;
      if (section.feedback) {
        content += `> **Feedback:** ${section.feedback}\n\n`;
      }
    });
  }

  // Add next steps
  content += `---\n\n## Next Steps\n\n`;
  content += `1. Review this design document\n`;
  content += `2. Create implementation plan using \`create_implementation_plan\`\n`;
  content += `3. Set up git worktree for isolated development\n`;
  content += `4. Execute plan with TDD approach\n`;

  fs.writeFileSync(documentPath, content);

  session.designDocPath = documentPath;
  session.status = "completed";
  saveSession(session, repoPath);

  return {
    documentPath,
    content,
  };
}

/**
 * Get session status
 */
export function getBrainstormSession(params: {
  sessionId: string;
  repoPath?: string;
}): BrainstormSession | null {
  return loadSession(params.sessionId, params.repoPath);
}

/**
 * List all brainstorm sessions
 */
export function listBrainstormSessions(params: {
  status?: BrainstormSession["status"];
  repoPath?: string;
}): BrainstormSession[] {
  const { status, repoPath } = params;

  const dir = getBrainstormDir(repoPath);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  const sessions: BrainstormSession[] = [];

  for (const file of files) {
    try {
      const session = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as BrainstormSession;
      if (!status || session.status === status) {
        sessions.push(session);
      }
    } catch {
      // Skip invalid files
    }
  }

  return sessions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function analyzeProjectContext(repoPath?: string): ProjectContext {
  const root = repoPath || process.cwd();

  const context: ProjectContext = {
    recentCommits: [],
    mainFiles: [],
    techStack: [],
    existingPatterns: [],
  };

  // Detect tech stack from package.json or other config files
  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.react) context.techStack.push("React");
      if (deps.vue) context.techStack.push("Vue");
      if (deps.angular) context.techStack.push("Angular");
      if (deps.typescript) context.techStack.push("TypeScript");
      if (deps.express) context.techStack.push("Express");
      if (deps.fastify) context.techStack.push("Fastify");
      if (deps.next) context.techStack.push("Next.js");
      if (deps.electron) context.techStack.push("Electron");
    } catch {
      // Ignore parse errors
    }
  }

  // Check for Python
  const pyprojectPath = path.join(root, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    context.techStack.push("Python");
  }

  // Identify main files
  const mainFiles = ["src/index.ts", "src/main.ts", "src/app.ts", "src/server.ts", "main.py", "app.py"];
  for (const file of mainFiles) {
    if (fs.existsSync(path.join(root, file))) {
      context.mainFiles.push(file);
    }
  }

  return context;
}

function generateInitialQuestions(taskDescription?: string, context?: ProjectContext): BrainstormQuestion[] {
  const questions: BrainstormQuestion[] = [];

  // Purpose question
  questions.push({
    id: "suggested-1",
    questionNumber: 1,
    type: "open_ended",
    question: "What problem are you trying to solve? What should users be able to do when this is complete?",
    category: "purpose",
  });

  // Constraints question
  questions.push({
    id: "suggested-2",
    questionNumber: 2,
    type: "multiple_choice",
    question: "What are the main constraints for this feature?",
    category: "constraints",
    options: [
      { id: "time", label: "Time-sensitive", description: "Needs to be done quickly" },
      { id: "perf", label: "Performance-critical", description: "Must be highly optimized" },
      { id: "compat", label: "Backwards compatibility", description: "Must work with existing systems" },
      { id: "security", label: "Security-first", description: "Must be hardened against attacks" },
    ],
  });

  // Success criteria
  questions.push({
    id: "suggested-3",
    questionNumber: 3,
    type: "open_ended",
    question: "How will we know this feature is successful? What are the acceptance criteria?",
    category: "success_criteria",
  });

  return questions;
}

function generateQuestionForCategory(
  category: "purpose" | "constraints" | "success_criteria" | "approach" | "tradeoffs",
  session: BrainstormSession
): BrainstormQuestion {
  const questionNumber = session.questions.length + 1;

  switch (category) {
    case "purpose":
      return {
        id: `suggested-${questionNumber}`,
        questionNumber,
        type: "open_ended",
        question: "Can you describe the main goal in one sentence?",
        category: "purpose",
      };
    case "constraints":
      return {
        id: `suggested-${questionNumber}`,
        questionNumber,
        type: "multiple_choice",
        question: "What's the most important constraint?",
        category: "constraints",
        options: [
          { id: "speed", label: "Development speed", recommended: true },
          { id: "quality", label: "Code quality" },
          { id: "perf", label: "Runtime performance" },
        ],
      };
    case "success_criteria":
      return {
        id: `suggested-${questionNumber}`,
        questionNumber,
        type: "open_ended",
        question: "What does 'done' look like? How will you test it?",
        category: "success_criteria",
      };
    case "approach":
      return {
        id: `suggested-${questionNumber}`,
        questionNumber,
        type: "multiple_choice",
        question: "Which approach appeals to you more?",
        category: "approach",
        options: [
          { id: "simple", label: "Simplest solution", description: "Minimal code, YAGNI", recommended: true },
          { id: "flexible", label: "More flexible", description: "Extensible for future needs" },
        ],
      };
    case "tradeoffs":
      return {
        id: `suggested-${questionNumber}`,
        questionNumber,
        type: "priority_ranking",
        question: "Rank these in order of importance:",
        category: "tradeoffs",
        options: [
          { id: "maintainability", label: "Maintainability" },
          { id: "performance", label: "Performance" },
          { id: "simplicity", label: "Simplicity" },
        ],
      };
    default:
      return {
        id: `suggested-${questionNumber}`,
        questionNumber,
        type: "open_ended",
        question: "Is there anything else we should consider?",
        category: "purpose",
      };
  }
}
