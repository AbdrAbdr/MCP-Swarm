/**
 * Smart Task Routing — Умная маршрутизация задач
 * 
 * Анализирует историю правок агентов и рекомендует лучшего
 * исполнителя для каждой задачи на основе экспертизы.
 * 
 * Алгоритм:
 * 1. Собираем историю правок каждого агента (какие файлы/папки он трогал)
 * 2. Для новой задачи определяем затрагиваемые файлы/папки
 * 3. Находим агента с максимальным "expertise score" для этих файлов
 * 4. Учитываем текущую загрузку агента
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";

const EXPERTISE_FILE = ".swarm/EXPERTISE.json";
const ROUTING_FILE = ".swarm/TASK_ROUTING.json";

// Типы
export interface AgentExpertise {
  agentName: string;
  // Карта: путь -> количество правок
  fileEdits: Record<string, number>;
  // Карта: папка -> количество правок  
  folderEdits: Record<string, number>;
  // Карта: расширение -> количество правок
  extensionEdits: Record<string, number>;
  // Общее количество правок
  totalEdits: number;
  // Последнее обновление
  lastUpdated: number;
}

export interface ExpertiseStore {
  agents: Record<string, AgentExpertise>;
  lastUpdated: number;
}

export interface TaskRoutingResult {
  recommendedAgent: string | null;
  score: number;
  reason: string;
  alternatives: Array<{
    agent: string;
    score: number;
    reason: string;
  }>;
  affectedPaths: string[];
}

export interface RoutingHistory {
  taskId: string;
  recommendedAgent: string;
  actualAgent: string | null;
  score: number;
  timestamp: number;
  success: boolean | null;
}

/**
 * Загрузить хранилище экспертизы
 */
async function loadExpertise(repoRoot: string): Promise<ExpertiseStore> {
  const filePath = path.join(repoRoot, EXPERTISE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as ExpertiseStore;
  } catch {
    return { agents: {}, lastUpdated: Date.now() };
  }
}

/**
 * Сохранить хранилище экспертизы
 */
async function saveExpertise(repoRoot: string, store: ExpertiseStore): Promise<void> {
  const filePath = path.join(repoRoot, EXPERTISE_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  store.lastUpdated = Date.now();
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Записать правку файла агентом
 */
export async function recordFileEdit(input: {
  repoPath?: string;
  agentName: string;
  filePath: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const store = await loadExpertise(repoRoot);

  // Инициализация агента если не существует
  if (!store.agents[input.agentName]) {
    store.agents[input.agentName] = {
      agentName: input.agentName,
      fileEdits: {},
      folderEdits: {},
      extensionEdits: {},
      totalEdits: 0,
      lastUpdated: Date.now(),
    };
  }

  const agent = store.agents[input.agentName];

  // Нормализуем путь
  const normalizedPath = input.filePath.replace(/\\/g, "/");
  const folder = path.dirname(normalizedPath);
  const ext = path.extname(normalizedPath).toLowerCase();

  // Увеличиваем счётчики
  agent.fileEdits[normalizedPath] = (agent.fileEdits[normalizedPath] || 0) + 1;
  agent.folderEdits[folder] = (agent.folderEdits[folder] || 0) + 1;
  if (ext) {
    agent.extensionEdits[ext] = (agent.extensionEdits[ext] || 0) + 1;
  }
  agent.totalEdits += 1;
  agent.lastUpdated = Date.now();

  await saveExpertise(repoRoot, store);

  return {
    success: true,
    message: `Recorded edit for ${input.agentName}: ${normalizedPath}`,
  };
}

/**
 * Записать правки нескольких файлов
 */
export async function recordMultipleEdits(input: {
  repoPath?: string;
  agentName: string;
  filePaths: string[];
}): Promise<{ success: boolean; count: number }> {
  for (const filePath of input.filePaths) {
    await recordFileEdit({
      repoPath: input.repoPath,
      agentName: input.agentName,
      filePath,
    });
  }
  return { success: true, count: input.filePaths.length };
}

/**
 * Вычислить score экспертизы агента для набора путей
 */
function calculateExpertiseScore(
  agent: AgentExpertise,
  paths: string[],
  allAgents: AgentExpertise[]
): { score: number; breakdown: Record<string, number> } {
  let score = 0;
  const breakdown: Record<string, number> = {};

  for (const p of paths) {
    const normalizedPath = p.replace(/\\/g, "/");
    const folder = path.dirname(normalizedPath);
    const ext = path.extname(normalizedPath).toLowerCase();

    // Точное совпадение файла (вес 10)
    if (agent.fileEdits[normalizedPath]) {
      const fileScore = agent.fileEdits[normalizedPath] * 10;
      score += fileScore;
      breakdown[`file:${normalizedPath}`] = fileScore;
    }

    // Совпадение папки (вес 3)
    if (agent.folderEdits[folder]) {
      const folderScore = agent.folderEdits[folder] * 3;
      score += folderScore;
      breakdown[`folder:${folder}`] = folderScore;
    }

    // Родительские папки (вес 1)
    const parts = folder.split("/");
    for (let i = 1; i < parts.length; i++) {
      const parentFolder = parts.slice(0, i).join("/");
      if (agent.folderEdits[parentFolder]) {
        const parentScore = agent.folderEdits[parentFolder] * 1;
        score += parentScore;
        breakdown[`parent:${parentFolder}`] = parentScore;
      }
    }

    // Расширение файла (вес 2)
    if (ext && agent.extensionEdits[ext]) {
      const extScore = agent.extensionEdits[ext] * 2;
      score += extScore;
      breakdown[`ext:${ext}`] = extScore;
    }
  }

  // Нормализация относительно общего количества правок
  // Агент с большим опытом получает бонус, но не подавляющий
  const experienceBonus = Math.log10(agent.totalEdits + 1) * 5;
  score += experienceBonus;
  breakdown["experience_bonus"] = experienceBonus;

  return { score, breakdown };
}

/**
 * Найти лучшего агента для задачи
 */
export async function findBestAgent(input: {
  repoPath?: string;
  affectedPaths: string[];
  excludeAgents?: string[];
  taskComplexity?: "simple" | "medium" | "complex";
}): Promise<TaskRoutingResult> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const store = await loadExpertise(repoRoot);

  const excludeSet = new Set(input.excludeAgents || []);
  const agents = Object.values(store.agents).filter(a => !excludeSet.has(a.agentName));

  if (agents.length === 0) {
    return {
      recommendedAgent: null,
      score: 0,
      reason: "Нет агентов с историей правок",
      alternatives: [],
      affectedPaths: input.affectedPaths,
    };
  }

  // Вычисляем score для каждого агента
  const scores = agents.map(agent => {
    const { score, breakdown } = calculateExpertiseScore(agent, input.affectedPaths, agents);
    return { agent: agent.agentName, score, breakdown };
  });

  // Сортируем по score
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  const alternatives = scores.slice(1, 4).map(s => ({
    agent: s.agent,
    score: s.score,
    reason: `Score: ${s.score.toFixed(1)}`,
  }));

  // Формируем причину выбора
  let reason = `Лучший score: ${best.score.toFixed(1)}`;
  const topReasons = Object.entries(best.breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}: +${v.toFixed(1)}`)
    .join(", ");
  if (topReasons) {
    reason += ` (${topReasons})`;
  }

  return {
    recommendedAgent: best.agent,
    score: best.score,
    reason,
    alternatives,
    affectedPaths: input.affectedPaths,
  };
}

/**
 * Получить экспертизу всех агентов
 */
export async function getExpertiseMap(input: {
  repoPath?: string;
}): Promise<{
  agents: Array<{
    name: string;
    totalEdits: number;
    topFiles: Array<{ path: string; count: number }>;
    topFolders: Array<{ path: string; count: number }>;
    topExtensions: Array<{ ext: string; count: number }>;
  }>;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const store = await loadExpertise(repoRoot);

  const agents = Object.values(store.agents).map(agent => {
    const topFiles = Object.entries(agent.fileEdits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const topFolders = Object.entries(agent.folderEdits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    const topExtensions = Object.entries(agent.extensionEdits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => ({ ext, count }));

    return {
      name: agent.agentName,
      totalEdits: agent.totalEdits,
      topFiles,
      topFolders,
      topExtensions,
    };
  });

  // Сортируем по общему количеству правок
  agents.sort((a, b) => b.totalEdits - a.totalEdits);

  return { agents };
}

/**
 * Предсказать затрагиваемые файлы на основе описания задачи
 * (простой эвристический подход)
 */
export async function predictAffectedPaths(input: {
  repoPath?: string;
  taskDescription: string;
  taskTitle: string;
}): Promise<{
  predictedPaths: string[];
  confidence: number;
  method: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const store = await loadExpertise(repoRoot);

  // Собираем все известные пути
  const allPaths = new Set<string>();
  for (const agent of Object.values(store.agents)) {
    for (const filePath of Object.keys(agent.fileEdits)) {
      allPaths.add(filePath);
    }
  }

  const text = `${input.taskTitle} ${input.taskDescription}`.toLowerCase();
  const predictedPaths: string[] = [];

  // Ищем упоминания файлов/папок в тексте задачи
  for (const p of allPaths) {
    const fileName = path.basename(p).toLowerCase();
    const folderName = path.basename(path.dirname(p)).toLowerCase();

    if (text.includes(fileName) || text.includes(folderName)) {
      predictedPaths.push(p);
    }
  }

  // Ищем ключевые слова
  const keywords: Record<string, string[]> = {
    "api": ["src/api", "api/", "routes/", "controllers/"],
    "auth": ["auth/", "authentication", "login", "session"],
    "test": ["test/", "tests/", "__tests__/", ".test.", ".spec."],
    "ui": ["components/", "ui/", "views/", "pages/"],
    "database": ["models/", "db/", "database/", "migrations/"],
    "config": ["config/", ".config", "settings"],
  };

  for (const [keyword, patterns] of Object.entries(keywords)) {
    if (text.includes(keyword)) {
      for (const p of allPaths) {
        for (const pattern of patterns) {
          if (p.includes(pattern) && !predictedPaths.includes(p)) {
            predictedPaths.push(p);
          }
        }
      }
    }
  }

  const confidence = predictedPaths.length > 0
    ? Math.min(0.8, 0.3 + predictedPaths.length * 0.1)
    : 0.1;

  return {
    predictedPaths: predictedPaths.slice(0, 20),
    confidence,
    method: "keyword_matching",
  };
}

/**
 * Автоматически назначить задачу лучшему агенту
 */
export async function autoAssignTask(input: {
  repoPath?: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  availableAgents: string[];
}): Promise<{
  assignedTo: string | null;
  routing: TaskRoutingResult;
  prediction: { predictedPaths: string[]; confidence: number };
}> {
  const repoRoot = await getRepoRoot(input.repoPath);

  // Предсказываем затрагиваемые пути
  const prediction = await predictAffectedPaths({
    repoPath: input.repoPath,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
  });

  // Если не можем предсказать пути, возвращаем null
  if (prediction.predictedPaths.length === 0) {
    return {
      assignedTo: null,
      routing: {
        recommendedAgent: null,
        score: 0,
        reason: "Не удалось определить затрагиваемые файлы",
        alternatives: [],
        affectedPaths: [],
      },
      prediction,
    };
  }

  // Ищем лучшего агента
  const routing = await findBestAgent({
    repoPath: input.repoPath,
    affectedPaths: prediction.predictedPaths,
    excludeAgents: [], // Можно добавить занятых агентов
  });

  // Проверяем, что рекомендованный агент доступен
  const assignedTo = routing.recommendedAgent &&
    input.availableAgents.includes(routing.recommendedAgent)
    ? routing.recommendedAgent
    : null;

  // Сохраняем историю роутинга
  const historyPath = path.join(repoRoot, ROUTING_FILE);
  let history: RoutingHistory[] = [];
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    history = JSON.parse(raw);
  } catch { }

  history.push({
    taskId: input.taskId,
    recommendedAgent: routing.recommendedAgent || "",
    actualAgent: assignedTo,
    score: routing.score,
    timestamp: Date.now(),
    success: null, // Будет обновлено после завершения задачи
  });

  // Храним последние 1000 записей
  if (history.length > 1000) {
    history = history.slice(-1000);
  }

  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");

  return { assignedTo, routing, prediction };
}

// ─── Legacy-compatible exports (merged from agentSpecialization.ts) ───

/**
 * @deprecated Use recordFileEdit instead
 * Legacy wrapper for backward compatibility with agentSpecialization.ts consumers
 */
export async function recordAgentEdit(input: {
  repoPath?: string;
  agent: string;
  filesEdited: string[];
  taskKeywords?: string[];
}): Promise<{ tracked: boolean; agent: string; filesCount: number }> {
  for (const f of input.filesEdited) {
    await recordFileEdit({ repoPath: input.repoPath, agentName: input.agent, filePath: f });
  }
  return { tracked: true, agent: input.agent, filesCount: input.filesEdited.length };
}

type SuggestAgentInput = {
  repoPath?: string;
  taskDescription: string;
  files?: string[];
  directories?: string[];
  keywords?: string[];
  filesLikelyInvolved?: string[];
};

type SuggestAgentOutput = {
  suggestedAgent: string | null;
  confidence: number;
  reason: string;
  alternatives: Array<{ agent: string; score: number }>;
};

/**
 * @deprecated Use findBestAgent instead
 */
export async function suggestAgentForTask(input: SuggestAgentInput): Promise<SuggestAgentOutput> {
  const paths = [
    ...(input.files || []),
    ...(input.filesLikelyInvolved || []),
    ...(input.directories || []).map(d => d + "/index.ts"),
  ];
  if (paths.length === 0) {
    const prediction = await predictAffectedPaths({
      repoPath: input.repoPath,
      taskTitle: input.taskDescription,
      taskDescription: input.taskDescription,
    });
    paths.push(...prediction.predictedPaths);
  }
  const result = await findBestAgent({ repoPath: input.repoPath, affectedPaths: paths });
  return {
    suggestedAgent: result.recommendedAgent,
    confidence: result.score > 0 ? Math.min(1, result.score / 100) : 0,
    reason: result.reason,
    alternatives: result.alternatives.map(a => ({ agent: a.agent, score: a.score })),
  };
}

/**
 * @deprecated Use getExpertiseMap instead
 */
export async function getTopExperts(input: {
  repoPath?: string;
  area: string;
  limit?: number;
}): Promise<{ experts: Array<{ agent: string; score: number; edits: number }> }> {
  const map = await getExpertiseMap({ repoPath: input.repoPath });
  const experts = map.agents
    .filter(a => {
      const hasFolder = a.topFolders.some(f => f.path.includes(input.area));
      const hasFile = a.topFiles.some(f => f.path.includes(input.area));
      const hasExt = a.topExtensions.some(e => e.ext.includes(input.area));
      return hasFolder || hasFile || hasExt;
    })
    .map(a => ({
      agent: a.name,
      score: a.totalEdits,
      edits: a.totalEdits,
    }))
    .slice(0, input.limit || 10);
  return { experts };
}

/**
 * @deprecated Use getExpertiseMap instead
 */
export async function listAllAgentExpertise(input: {
  repoPath?: string;
}): Promise<{ agents: Array<{ agent: string; totalEdits: number; topFiles: string[]; topKeywords: string[] }> }> {
  const map = await getExpertiseMap({ repoPath: input.repoPath });
  return {
    agents: map.agents.map(a => ({
      agent: a.name,
      totalEdits: a.totalEdits,
      topFiles: a.topFiles.map(f => f.path),
      topKeywords: a.topExtensions.map(e => e.ext),
    })),
  };
}

