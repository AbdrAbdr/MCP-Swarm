/**
 * Auto Code Review — Автоматическое ревью кода
 * 
 * Когда агент завершает задачу, система автоматически:
 * 1. Находит другого свободного агента
 * 2. Назначает ему ревью изменений
 * 3. Отслеживает результат ревью
 * 4. Требует исправления или аппрувит
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "./repo.js";
import { findBestAgent } from "./smartRouting.js";

const REVIEWS_DIR = ".swarm/reviews";
const REVIEW_INDEX = ".swarm/reviews/INDEX.json";

// Типы
export interface CodeReview {
  id: string;
  // Задача, которую ревьюим
  taskId: string;
  taskTitle: string;
  // Автор кода
  codeAuthor: string;
  // Ревьюер
  reviewer: string | null;
  // Статус ревью
  status: "pending" | "in_progress" | "approved" | "changes_requested" | "cancelled";
  // Изменённые файлы
  changedFiles: string[];
  // Diff или описание изменений
  changesSummary: string;
  // Комментарии ревьюера
  comments: ReviewComment[];
  // Результат
  result?: {
    approved: boolean;
    summary: string;
    blockers: string[];
    suggestions: string[];
  };
  // Временные метки
  createdAt: number;
  assignedAt: number | null;
  completedAt: number | null;
  // Приоритет (наследуется от задачи)
  priority: "low" | "normal" | "high" | "critical";
  // Автоматически созданное ревью
  autoAssigned: boolean;
}

export interface ReviewComment {
  id: string;
  author: string;
  filePath: string;
  lineNumber?: number;
  content: string;
  severity: "info" | "suggestion" | "warning" | "blocker";
  resolved: boolean;
  createdAt: number;
}

export interface ReviewIndex {
  reviews: Record<string, CodeReview>;
  // Индекс по автору кода
  byAuthor: Record<string, string[]>;
  // Индекс по ревьюеру
  byReviewer: Record<string, string[]>;
  // Индекс по статусу
  byStatus: Record<string, string[]>;
  lastUpdated: number;
}

/**
 * Загрузить индекс ревью
 */
async function loadReviewIndex(repoRoot: string): Promise<ReviewIndex> {
  const indexPath = path.join(repoRoot, REVIEW_INDEX);
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return JSON.parse(raw) as ReviewIndex;
  } catch {
    return {
      reviews: {},
      byAuthor: {},
      byReviewer: {},
      byStatus: {},
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Сохранить индекс ревью
 */
async function saveReviewIndex(repoRoot: string, index: ReviewIndex): Promise<void> {
  const reviewsDir = path.join(repoRoot, REVIEWS_DIR);
  await fs.mkdir(reviewsDir, { recursive: true });
  
  index.lastUpdated = Date.now();
  const indexPath = path.join(repoRoot, REVIEW_INDEX);
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
}

/**
 * Обновить индексы статуса
 */
function updateStatusIndex(index: ReviewIndex, reviewId: string, oldStatus: string | null, newStatus: string): void {
  // Удаляем из старого статуса
  if (oldStatus && index.byStatus[oldStatus]) {
    index.byStatus[oldStatus] = index.byStatus[oldStatus].filter(id => id !== reviewId);
  }
  // Добавляем в новый статус
  if (!index.byStatus[newStatus]) {
    index.byStatus[newStatus] = [];
  }
  if (!index.byStatus[newStatus].includes(reviewId)) {
    index.byStatus[newStatus].push(reviewId);
  }
}

/**
 * Создать запрос на ревью
 */
export async function createReviewRequest(input: {
  repoPath?: string;
  taskId: string;
  taskTitle: string;
  codeAuthor: string;
  changedFiles: string[];
  changesSummary: string;
  priority?: CodeReview["priority"];
  autoAssign?: boolean;
}): Promise<{
  success: boolean;
  reviewId: string;
  assignedTo: string | null;
  message: string;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // Автоматический подбор ревьюера
  let reviewer: string | null = null;
  
  if (input.autoAssign !== false) {
    // Ищем агента, который знает эти файлы, но НЕ автора
    const routing = await findBestAgent({
      repoPath: input.repoPath,
      affectedPaths: input.changedFiles,
      excludeAgents: [input.codeAuthor],
    });
    
    if (routing.recommendedAgent) {
      reviewer = routing.recommendedAgent;
    }
  }
  
  const review: CodeReview = {
    id: reviewId,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    codeAuthor: input.codeAuthor,
    reviewer,
    status: reviewer ? "in_progress" : "pending",
    changedFiles: input.changedFiles,
    changesSummary: input.changesSummary,
    comments: [],
    createdAt: Date.now(),
    assignedAt: reviewer ? Date.now() : null,
    completedAt: null,
    priority: input.priority || "normal",
    autoAssigned: !!reviewer,
  };
  
  // Добавляем в индексы
  index.reviews[reviewId] = review;
  
  if (!index.byAuthor[input.codeAuthor]) {
    index.byAuthor[input.codeAuthor] = [];
  }
  index.byAuthor[input.codeAuthor].push(reviewId);
  
  if (reviewer) {
    if (!index.byReviewer[reviewer]) {
      index.byReviewer[reviewer] = [];
    }
    index.byReviewer[reviewer].push(reviewId);
  }
  
  updateStatusIndex(index, reviewId, null, review.status);
  
  await saveReviewIndex(repoRoot, index);
  
  return {
    success: true,
    reviewId,
    assignedTo: reviewer,
    message: reviewer 
      ? `Ревью создано и назначено ${reviewer}`
      : "Ревью создано, ожидает назначения ревьюера",
  };
}

/**
 * Назначить ревьюера вручную
 */
export async function assignReviewer(input: {
  repoPath?: string;
  reviewId: string;
  reviewer: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const review = index.reviews[input.reviewId];
  if (!review) {
    return { success: false, message: "Ревью не найдено" };
  }
  
  if (review.reviewer === input.reviewer) {
    return { success: false, message: "Этот ревьюер уже назначен" };
  }
  
  if (review.codeAuthor === input.reviewer) {
    return { success: false, message: "Автор кода не может быть ревьюером" };
  }
  
  // Удаляем из старого ревьюера
  if (review.reviewer && index.byReviewer[review.reviewer]) {
    index.byReviewer[review.reviewer] = index.byReviewer[review.reviewer]
      .filter(id => id !== input.reviewId);
  }
  
  // Добавляем нового ревьюера
  review.reviewer = input.reviewer;
  review.assignedAt = Date.now();
  
  const oldStatus = review.status;
  review.status = "in_progress";
  
  if (!index.byReviewer[input.reviewer]) {
    index.byReviewer[input.reviewer] = [];
  }
  index.byReviewer[input.reviewer].push(input.reviewId);
  
  updateStatusIndex(index, input.reviewId, oldStatus, review.status);
  
  await saveReviewIndex(repoRoot, index);
  
  return { success: true, message: `Ревьюер назначен: ${input.reviewer}` };
}

/**
 * Добавить комментарий к ревью
 */
export async function addReviewComment(input: {
  repoPath?: string;
  reviewId: string;
  author: string;
  filePath: string;
  lineNumber?: number;
  content: string;
  severity?: ReviewComment["severity"];
}): Promise<{ success: boolean; commentId: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const review = index.reviews[input.reviewId];
  if (!review) {
    return { success: false, commentId: "" };
  }
  
  const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  review.comments.push({
    id: commentId,
    author: input.author,
    filePath: input.filePath,
    lineNumber: input.lineNumber,
    content: input.content,
    severity: input.severity || "info",
    resolved: false,
    createdAt: Date.now(),
  });
  
  await saveReviewIndex(repoRoot, index);
  
  return { success: true, commentId };
}

/**
 * Завершить ревью
 */
export async function completeReview(input: {
  repoPath?: string;
  reviewId: string;
  reviewer: string;
  approved: boolean;
  summary: string;
  blockers?: string[];
  suggestions?: string[];
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const review = index.reviews[input.reviewId];
  if (!review) {
    return { success: false, message: "Ревью не найдено" };
  }
  
  if (review.reviewer !== input.reviewer) {
    return { success: false, message: "Только назначенный ревьюер может завершить ревью" };
  }
  
  const oldStatus = review.status;
  review.status = input.approved ? "approved" : "changes_requested";
  review.completedAt = Date.now();
  review.result = {
    approved: input.approved,
    summary: input.summary,
    blockers: input.blockers || [],
    suggestions: input.suggestions || [],
  };
  
  updateStatusIndex(index, input.reviewId, oldStatus, review.status);
  
  await saveReviewIndex(repoRoot, index);
  
  return {
    success: true,
    message: input.approved 
      ? "Ревью завершено: APPROVED"
      : `Ревью завершено: CHANGES REQUESTED (${input.blockers?.length || 0} блокеров)`,
  };
}

/**
 * Разрешить комментарий
 */
export async function resolveComment(input: {
  repoPath?: string;
  reviewId: string;
  commentId: string;
}): Promise<{ success: boolean }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const review = index.reviews[input.reviewId];
  if (!review) {
    return { success: false };
  }
  
  const comment = review.comments.find(c => c.id === input.commentId);
  if (!comment) {
    return { success: false };
  }
  
  comment.resolved = true;
  
  await saveReviewIndex(repoRoot, index);
  
  return { success: true };
}

/**
 * Получить ревью для агента (как ревьюера)
 */
export async function getReviewsForReviewer(input: {
  repoPath?: string;
  reviewer: string;
  status?: CodeReview["status"];
}): Promise<{ reviews: CodeReview[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const reviewIds = index.byReviewer[input.reviewer] || [];
  let reviews = reviewIds
    .map(id => index.reviews[id])
    .filter((r): r is CodeReview => r !== undefined);
  
  if (input.status) {
    reviews = reviews.filter(r => r.status === input.status);
  }
  
  // Сортируем по приоритету и дате
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  reviews.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt - b.createdAt;
  });
  
  return { reviews };
}

/**
 * Получить ревью для автора кода
 */
export async function getReviewsForAuthor(input: {
  repoPath?: string;
  author: string;
  status?: CodeReview["status"];
}): Promise<{ reviews: CodeReview[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const reviewIds = index.byAuthor[input.author] || [];
  let reviews = reviewIds
    .map(id => index.reviews[id])
    .filter((r): r is CodeReview => r !== undefined);
  
  if (input.status) {
    reviews = reviews.filter(r => r.status === input.status);
  }
  
  reviews.sort((a, b) => b.createdAt - a.createdAt);
  
  return { reviews };
}

/**
 * Получить pending ревью (для автоматического назначения)
 */
export async function getPendingReviews(input: {
  repoPath?: string;
}): Promise<{ reviews: CodeReview[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const pendingIds = index.byStatus["pending"] || [];
  const reviews = pendingIds
    .map(id => index.reviews[id])
    .filter((r): r is CodeReview => r !== undefined);
  
  return { reviews };
}

/**
 * Получить статистику ревью
 */
export async function getReviewStats(input: {
  repoPath?: string;
}): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  approved: number;
  changesRequested: number;
  avgReviewTime: number;
  topReviewers: Array<{ reviewer: string; count: number; approvalRate: number }>;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadReviewIndex(repoRoot);
  
  const reviews = Object.values(index.reviews);
  
  const pending = reviews.filter(r => r.status === "pending").length;
  const inProgress = reviews.filter(r => r.status === "in_progress").length;
  const approved = reviews.filter(r => r.status === "approved").length;
  const changesRequested = reviews.filter(r => r.status === "changes_requested").length;
  
  // Среднее время ревью
  const completedReviews = reviews.filter(r => r.completedAt && r.assignedAt);
  const totalTime = completedReviews.reduce((sum, r) => sum + (r.completedAt! - r.assignedAt!), 0);
  const avgReviewTime = completedReviews.length > 0 ? totalTime / completedReviews.length : 0;
  
  // Топ ревьюеров
  const reviewerStats: Record<string, { count: number; approved: number }> = {};
  for (const review of reviews) {
    if (!review.reviewer) continue;
    if (!reviewerStats[review.reviewer]) {
      reviewerStats[review.reviewer] = { count: 0, approved: 0 };
    }
    reviewerStats[review.reviewer].count++;
    if (review.status === "approved") {
      reviewerStats[review.reviewer].approved++;
    }
  }
  
  const topReviewers = Object.entries(reviewerStats)
    .map(([reviewer, stats]) => ({
      reviewer,
      count: stats.count,
      approvalRate: stats.count > 0 ? stats.approved / stats.count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    total: reviews.length,
    pending,
    inProgress,
    approved,
    changesRequested,
    avgReviewTime,
    topReviewers,
  };
}
