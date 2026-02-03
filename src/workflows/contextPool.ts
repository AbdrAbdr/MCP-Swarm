/**
 * Shared Context Pool — Общий пул контекста
 * 
 * Позволяет агентам делиться заметками о коде, чтобы другие
 * не тратили время на повторное изучение тех же файлов.
 * 
 * Функционал:
 * 1. Сохранение заметок о файле/функции/классе
 * 2. Поиск существующих заметок перед анализом
 * 3. Автоматическое устаревание заметок при изменении файла
 * 4. Теги и категории для быстрого поиска
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepoRoot } from "./repo.js";

const CONTEXT_DIR = ".swarm/context";
const CONTEXT_INDEX = ".swarm/context/INDEX.json";

// Типы
export interface ContextNote {
  id: string;
  // Путь к файлу/папке
  targetPath: string;
  // Опционально: конкретный символ (функция, класс)
  targetSymbol?: string;
  // Хэш содержимого файла на момент создания заметки
  fileHash: string;
  // Содержимое заметки
  content: string;
  // Краткое резюме (для быстрого просмотра)
  summary: string;
  // Теги
  tags: string[];
  // Категория
  category: "architecture" | "api" | "bug" | "performance" | "security" | "documentation" | "other";
  // Автор
  author: string;
  // Временные метки
  createdAt: number;
  updatedAt: number;
  // Количество просмотров
  viewCount: number;
  // Помечена как полезная
  helpful: number;
  // Устарела (файл изменился)
  stale: boolean;
}

export interface ContextIndex {
  notes: Record<string, ContextNote>;
  // Индекс по путям
  byPath: Record<string, string[]>;
  // Индекс по тегам
  byTag: Record<string, string[]>;
  // Индекс по авторам
  byAuthor: Record<string, string[]>;
  // Последнее обновление
  lastUpdated: number;
}

/**
 * Загрузить индекс контекста
 */
async function loadContextIndex(repoRoot: string): Promise<ContextIndex> {
  const indexPath = path.join(repoRoot, CONTEXT_INDEX);
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return JSON.parse(raw) as ContextIndex;
  } catch {
    return {
      notes: {},
      byPath: {},
      byTag: {},
      byAuthor: {},
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Сохранить индекс контекста
 */
async function saveContextIndex(repoRoot: string, index: ContextIndex): Promise<void> {
  const contextDir = path.join(repoRoot, CONTEXT_DIR);
  await fs.mkdir(contextDir, { recursive: true });
  
  index.lastUpdated = Date.now();
  const indexPath = path.join(repoRoot, CONTEXT_INDEX);
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
}

/**
 * Вычислить хэш содержимого файла
 */
async function getFileHash(repoRoot: string, filePath: string): Promise<string> {
  try {
    const fullPath = path.join(repoRoot, filePath);
    const content = await fs.readFile(fullPath, "utf8");
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 12);
  } catch {
    return "unknown";
  }
}

/**
 * Добавить заметку о контексте
 */
export async function addContextNote(input: {
  repoPath?: string;
  targetPath: string;
  targetSymbol?: string;
  content: string;
  summary: string;
  tags?: string[];
  category?: ContextNote["category"];
  author: string;
}): Promise<{ success: boolean; noteId: string; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const normalizedPath = input.targetPath.replace(/\\/g, "/");
  const fileHash = await getFileHash(repoRoot, normalizedPath);
  
  const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const note: ContextNote = {
    id: noteId,
    targetPath: normalizedPath,
    targetSymbol: input.targetSymbol,
    fileHash,
    content: input.content,
    summary: input.summary,
    tags: input.tags || [],
    category: input.category || "other",
    author: input.author,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    viewCount: 0,
    helpful: 0,
    stale: false,
  };
  
  // Добавляем в индексы
  index.notes[noteId] = note;
  
  if (!index.byPath[normalizedPath]) {
    index.byPath[normalizedPath] = [];
  }
  index.byPath[normalizedPath].push(noteId);
  
  for (const tag of note.tags) {
    if (!index.byTag[tag]) {
      index.byTag[tag] = [];
    }
    index.byTag[tag].push(noteId);
  }
  
  if (!index.byAuthor[input.author]) {
    index.byAuthor[input.author] = [];
  }
  index.byAuthor[input.author].push(noteId);
  
  await saveContextIndex(repoRoot, index);
  
  return {
    success: true,
    noteId,
    message: `Заметка добавлена для ${normalizedPath}`,
  };
}

/**
 * Получить заметки для файла/папки
 */
export async function getContextNotes(input: {
  repoPath?: string;
  targetPath: string;
  includeStale?: boolean;
  checkFreshness?: boolean;
}): Promise<{
  notes: ContextNote[];
  staleCount: number;
  freshCount: number;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const normalizedPath = input.targetPath.replace(/\\/g, "/");
  
  // Собираем заметки для этого пути и родительских путей
  const noteIds = new Set<string>();
  
  // Точное совпадение
  if (index.byPath[normalizedPath]) {
    for (const id of index.byPath[normalizedPath]) {
      noteIds.add(id);
    }
  }
  
  // Заметки для родительских папок
  const parts = normalizedPath.split("/");
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join("/");
    if (index.byPath[parentPath]) {
      for (const id of index.byPath[parentPath]) {
        noteIds.add(id);
      }
    }
  }
  
  // Проверяем свежесть заметок
  let staleCount = 0;
  let freshCount = 0;
  const notes: ContextNote[] = [];
  
  for (const noteId of noteIds) {
    const note = index.notes[noteId];
    if (!note) continue;
    
    // Проверяем, не устарела ли заметка
    if (input.checkFreshness) {
      const currentHash = await getFileHash(repoRoot, note.targetPath);
      if (currentHash !== note.fileHash && currentHash !== "unknown") {
        note.stale = true;
        staleCount++;
      } else {
        freshCount++;
      }
    }
    
    if (!input.includeStale && note.stale) {
      staleCount++;
      continue;
    }
    
    // Увеличиваем счётчик просмотров
    note.viewCount++;
    
    notes.push(note);
  }
  
  // Сохраняем обновлённые данные
  await saveContextIndex(repoRoot, index);
  
  // Сортируем по дате (новые первые)
  notes.sort((a, b) => b.updatedAt - a.updatedAt);
  
  return { notes, staleCount, freshCount };
}

/**
 * Поиск заметок по тегу
 */
export async function searchContextByTag(input: {
  repoPath?: string;
  tag: string;
}): Promise<{ notes: ContextNote[] }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const noteIds = index.byTag[input.tag] || [];
  const notes = noteIds
    .map(id => index.notes[id])
    .filter((n): n is ContextNote => n !== undefined && !n.stale)
    .sort((a, b) => b.helpful - a.helpful);
  
  return { notes };
}

/**
 * Поиск заметок по ключевым словам
 */
export async function searchContext(input: {
  repoPath?: string;
  query: string;
  limit?: number;
}): Promise<{ notes: ContextNote[]; total: number }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const queryLower = input.query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  const scoredNotes: Array<{ note: ContextNote; score: number }> = [];
  
  for (const note of Object.values(index.notes)) {
    if (note.stale) continue;
    
    let score = 0;
    const searchText = `${note.summary} ${note.content} ${note.tags.join(" ")} ${note.targetPath}`.toLowerCase();
    
    for (const word of queryWords) {
      if (searchText.includes(word)) {
        score += 1;
        // Бонус за совпадение в summary
        if (note.summary.toLowerCase().includes(word)) {
          score += 2;
        }
        // Бонус за совпадение в тегах
        if (note.tags.some(t => t.toLowerCase().includes(word))) {
          score += 3;
        }
      }
    }
    
    if (score > 0) {
      // Бонус за helpful
      score += note.helpful * 0.5;
      scoredNotes.push({ note, score });
    }
  }
  
  // Сортируем по score
  scoredNotes.sort((a, b) => b.score - a.score);
  
  const limit = input.limit || 20;
  const notes = scoredNotes.slice(0, limit).map(s => s.note);
  
  return { notes, total: scoredNotes.length };
}

/**
 * Отметить заметку как полезную
 */
export async function markNoteHelpful(input: {
  repoPath?: string;
  noteId: string;
}): Promise<{ success: boolean; helpful: number }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const note = index.notes[input.noteId];
  if (!note) {
    return { success: false, helpful: 0 };
  }
  
  note.helpful++;
  await saveContextIndex(repoRoot, index);
  
  return { success: true, helpful: note.helpful };
}

/**
 * Обновить заметку
 */
export async function updateContextNote(input: {
  repoPath?: string;
  noteId: string;
  content?: string;
  summary?: string;
  tags?: string[];
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const note = index.notes[input.noteId];
  if (!note) {
    return { success: false, message: "Заметка не найдена" };
  }
  
  // Обновляем поля
  if (input.content !== undefined) note.content = input.content;
  if (input.summary !== undefined) note.summary = input.summary;
  
  // Обновляем теги (переиндексация)
  if (input.tags !== undefined) {
    // Удаляем из старых тегов
    for (const oldTag of note.tags) {
      const tagNotes = index.byTag[oldTag];
      if (tagNotes) {
        index.byTag[oldTag] = tagNotes.filter(id => id !== input.noteId);
      }
    }
    // Добавляем в новые теги
    note.tags = input.tags;
    for (const newTag of input.tags) {
      if (!index.byTag[newTag]) {
        index.byTag[newTag] = [];
      }
      index.byTag[newTag].push(input.noteId);
    }
  }
  
  // Обновляем хэш файла (заметка снова свежая)
  note.fileHash = await getFileHash(repoRoot, note.targetPath);
  note.stale = false;
  note.updatedAt = Date.now();
  
  await saveContextIndex(repoRoot, index);
  
  return { success: true, message: "Заметка обновлена" };
}

/**
 * Удалить устаревшие заметки
 */
export async function cleanupStaleNotes(input: {
  repoPath?: string;
  olderThanDays?: number;
}): Promise<{ deleted: number; remaining: number }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const maxAge = (input.olderThanDays || 30) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deleted = 0;
  
  for (const [noteId, note] of Object.entries(index.notes)) {
    // Проверяем свежесть
    const currentHash = await getFileHash(repoRoot, note.targetPath);
    if (currentHash !== note.fileHash && currentHash !== "unknown") {
      note.stale = true;
    }
    
    // Удаляем старые устаревшие заметки
    if (note.stale && (now - note.updatedAt) > maxAge) {
      // Удаляем из индексов
      delete index.notes[noteId];
      
      const pathNotes = index.byPath[note.targetPath];
      if (pathNotes) {
        index.byPath[note.targetPath] = pathNotes.filter(id => id !== noteId);
      }
      
      for (const tag of note.tags) {
        const tagNotes = index.byTag[tag];
        if (tagNotes) {
          index.byTag[tag] = tagNotes.filter(id => id !== noteId);
        }
      }
      
      const authorNotes = index.byAuthor[note.author];
      if (authorNotes) {
        index.byAuthor[note.author] = authorNotes.filter(id => id !== noteId);
      }
      
      deleted++;
    }
  }
  
  await saveContextIndex(repoRoot, index);
  
  return { deleted, remaining: Object.keys(index.notes).length };
}

/**
 * Получить статистику контекстного пула
 */
export async function getContextStats(input: {
  repoPath?: string;
}): Promise<{
  totalNotes: number;
  staleNotes: number;
  topAuthors: Array<{ author: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  avgHelpful: number;
}> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const index = await loadContextIndex(repoRoot);
  
  const notes = Object.values(index.notes);
  const staleNotes = notes.filter(n => n.stale).length;
  
  // Считаем авторов
  const authorCounts: Record<string, number> = {};
  for (const note of notes) {
    authorCounts[note.author] = (authorCounts[note.author] || 0) + 1;
  }
  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([author, count]) => ({ author, count }));
  
  // Считаем теги
  const tagCounts: Record<string, number> = {};
  for (const note of notes) {
    for (const tag of note.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  
  // Средняя полезность
  const totalHelpful = notes.reduce((sum, n) => sum + n.helpful, 0);
  const avgHelpful = notes.length > 0 ? totalHelpful / notes.length : 0;
  
  return {
    totalNotes: notes.length,
    staleNotes,
    topAuthors,
    topTags,
    avgHelpful,
  };
}
