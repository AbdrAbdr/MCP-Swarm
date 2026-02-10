/**
 * MoE Router — Mixture of Experts Model Selection
 * 
 * MCP Swarm v0.9.10
 * 
 * Implements intelligent model routing based on task characteristics:
 * 
 * 1. Expert Classification
 *    - Code generation (Claude, GPT-4, Codex)
 *    - Reasoning (Claude, o1)
 *    - Creative writing (GPT-4, Claude)
 *    - Data analysis (GPT-4, Claude)
 *    - Quick tasks (GPT-3.5, Claude Haiku)
 * 
 * 2. Gating Network
 *    - Task complexity analysis
 *    - Token estimation
 *    - Cost-performance optimization
 *    - Latency requirements
 * 
 * 3. Expert Pool
 *    - Model capabilities database
 *    - Performance history
 *    - Cost tracking
 *    - Availability monitoring
 * 
 * 4. Load Balancing
 *    - Rate limit awareness
 *    - Fallback strategies
 *    - Queue management
 * 
 * Inspired by Mixture of Experts architecture (Shazeer et al.)
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getRepoRoot } from "./repo.js";

// ============ TYPES ============

/**
 * Task category for expert selection
 */
export type TaskCategory =
  | "code_generation"    // Writing new code
  | "code_review"        // Reviewing/analyzing code
  | "code_refactor"      // Refactoring existing code
  | "debugging"          // Finding and fixing bugs
  | "reasoning"          // Complex logical reasoning
  | "math"               // Mathematical computations
  | "creative"           // Creative writing
  | "summarization"      // Summarizing text/code
  | "translation"        // Language translation
  | "data_analysis"      // Analyzing data
  | "quick_answer"       // Simple Q&A
  | "conversation"       // Chat/dialogue
  | "planning"           // Task planning
  | "documentation";     // Writing docs

/**
 * Model provider
 */
export type ModelProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "mistral"
  | "moonshot"
  | "local"
  | "custom";

/**
 * Model tier for cost optimization
 */
export type ModelTier = "economy" | "standard" | "premium" | "flagship";

/**
 * Expert model definition
 */
export interface Expert {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;           // e.g., "claude-3-5-sonnet-20241022"
  tier: ModelTier;
  capabilities: TaskCategory[];
  strengthScores: Record<TaskCategory, number>; // 0-1 per category
  contextWindow: number;     // Max tokens
  costPer1kInput: number;    // $ per 1k input tokens
  costPer1kOutput: number;   // $ per 1k output tokens
  avgLatencyMs: number;      // Average response time
  rateLimit: number;         // Requests per minute
  available: boolean;
  lastUsed: number;
  totalCalls: number;
  successRate: number;       // 0-1
  /** Special features unique to this model */
  specialFeatures?: {
    agentTeams?: boolean;        // Claude Opus 4.6 / Kimi K2.5: parallel agent orchestration
    adaptiveThinking?: boolean;  // Claude Opus 4.6: dynamic reasoning depth
    contextCompaction?: boolean; // Claude Opus 4.6: on-the-fly context compression
    effortLevels?: string[];     // e.g., ["low","medium","high"]
    longContextOptimized?: boolean; // Optimized for 200K+ context
    agenticCoding?: boolean;     // GPT-5.3 Codex: autonomous coding loops
    nativeMultimodal?: boolean;  // Kimi K2.5: vision + text + video in single model
    moeArchitecture?: boolean;   // Kimi K2.5: MoE 1T total / 32B active params
  };
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  selectedExpert: Expert;
  confidence: number;        // 0-1
  alternatives: Expert[];
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
  estimatedTokens: {
    input: number;
    output: number;
  };
  factors: {
    taskMatch: number;       // How well expert matches task
    costEfficiency: number;  // Cost optimization score
    performanceScore: number;// Historical performance
    loadBalance: number;     // Current load consideration
  };
}

/**
 * Task request for routing
 */
export interface TaskRequest {
  content: string;
  category?: TaskCategory;
  complexity?: "trivial" | "simple" | "medium" | "complex" | "extreme";
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: ModelProvider;
  preferredTier?: ModelTier;
  requiredContext?: number;  // Minimum context window needed
  priority?: "low" | "normal" | "high" | "critical";
}

/**
 * Routing result with feedback
 */
export interface RoutingResult {
  requestId: string;
  decision: RoutingDecision;
  timestamp: number;
  actualLatencyMs?: number;
  actualCost?: number;
  success?: boolean;
  feedback?: {
    quality: number;         // 1-5 rating
    comment?: string;
  };
}

/**
 * MoE Configuration
 */
export interface MoEConfig {
  enabled: boolean;
  defaultTier: ModelTier;
  costWeight: number;        // 0-1, how much to prioritize cost
  latencyWeight: number;     // 0-1, how much to prioritize speed
  qualityWeight: number;     // 0-1, how much to prioritize quality
  enableFallback: boolean;
  fallbackChain: string[];   // Expert IDs for fallback
  maxRetries: number;
  learningEnabled: boolean;  // Learn from feedback
  learningRate: number;      // How fast to adapt
}

/**
 * MoE Statistics
 */
export interface MoEStats {
  totalRequests: number;
  successfulRoutes: number;
  fallbacksUsed: number;
  avgLatencyMs: number;
  totalCost: number;
  byCategory: Record<TaskCategory, {
    count: number;
    avgQuality: number;
    preferredExpert: string;
  }>;
  byExpert: Record<string, {
    calls: number;
    avgLatency: number;
    totalCost: number;
    successRate: number;
  }>;
  lastUpdated: number;
}

// ============ CONSTANTS ============

const MOE_DIR = "moe";
const CONFIG_FILE = "config.json";
const EXPERTS_FILE = "experts.json";
const HISTORY_FILE = "history.json";
const STATS_FILE = "stats.json";

const DEFAULT_CONFIG: MoEConfig = {
  enabled: true,
  defaultTier: "standard",
  costWeight: 0.3,
  latencyWeight: 0.2,
  qualityWeight: 0.5,
  enableFallback: true,
  fallbackChain: [],
  maxRetries: 2,
  learningEnabled: true,
  learningRate: 0.1,
};

/**
 * Default expert models (Updated: February 2026 — v0.9.18)
 * 
 * VERIFIED PRICES from official sources:
 * - Anthropic: https://www.anthropic.com/pricing (February 2026)
 * - OpenAI: https://openai.com/api/pricing (February 2026)
 * - Google: Gemini pricing from Vertex AI
 * - Moonshot AI: https://platform.moonshot.ai (February 2026)
 * 
 * Current AI Model Landscape:
 * - Anthropic: Claude 4.6 Opus (flagship) + Claude 4.5 series (Sonnet, Haiku)
 * - OpenAI: GPT-5.x series + o3/o4 reasoning models + GPT-5.3 Codex
 * - Google: Gemini 3.x + Gemini 2.5 series
 * - Moonshot: Kimi K2.5 (code-focused)
 */
const DEFAULT_EXPERTS: Expert[] = [
  // ============ ANTHROPIC (Claude 4.6 + 4.5 Series) ============
  // Source: anthropic.com/pricing - February 2026

  // Claude Opus 4.6 — NEW flagship (1M context, adaptive thinking, agent teams)
  {
    id: "claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    modelId: "claude-opus-4-6-20260205",
    tier: "flagship",
    capabilities: ["code_generation", "code_review", "reasoning", "creative", "planning", "documentation", "debugging", "data_analysis", "math"],
    strengthScores: {
      code_generation: 0.99,
      code_review: 0.99,
      code_refactor: 0.98,
      debugging: 0.98,
      reasoning: 0.99,
      math: 0.97,
      creative: 0.97,
      summarization: 0.97,
      translation: 0.93,
      data_analysis: 0.96,
      quick_answer: 0.90,
      conversation: 0.97,
      planning: 0.99,
      documentation: 0.98,
    },
    contextWindow: 1000000,  // 1M context (official)
    costPer1kInput: 0.005,   // $5/MTok (official, ≤200K; $10/MTok for >200K)
    costPer1kOutput: 0.025,  // $25/MTok (official; $37.50/MTok for >200K)
    avgLatencyMs: 4500,
    rateLimit: 40,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
    specialFeatures: {
      agentTeams: true,           // Parallel agent orchestration
      adaptiveThinking: true,     // Dynamic reasoning depth (/effort)
      contextCompaction: true,    // On-the-fly context compression
      effortLevels: ["low", "medium", "high"],
      longContextOptimized: true, // 1M context with minimal drift
    },
  },
  // Claude Opus 4.5 — downgraded to premium (replaced by Opus 4.6 as flagship)
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    modelId: "claude-opus-4-5-20251101",
    tier: "premium",
    capabilities: ["code_generation", "code_review", "reasoning", "creative", "planning", "documentation", "debugging"],
    strengthScores: {
      code_generation: 0.97,
      code_review: 0.96,
      code_refactor: 0.95,
      debugging: 0.95,
      reasoning: 0.97,
      math: 0.94,
      creative: 0.95,
      summarization: 0.94,
      translation: 0.90,
      data_analysis: 0.93,
      quick_answer: 0.88,
      conversation: 0.95,
      planning: 0.96,
      documentation: 0.96,
    },
    contextWindow: 200000,
    costPer1kInput: 0.005,   // $5/MTok (official)
    costPer1kOutput: 0.025,  // $25/MTok (official)
    avgLatencyMs: 4000,
    rateLimit: 50,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    tier: "premium",
    capabilities: ["code_generation", "code_review", "reasoning", "planning", "debugging"],
    strengthScores: {
      code_generation: 0.96,
      code_review: 0.95,
      code_refactor: 0.94,
      debugging: 0.94,
      reasoning: 0.95,
      math: 0.90,
      creative: 0.92,
      summarization: 0.93,
      translation: 0.87,
      data_analysis: 0.90,
      quick_answer: 0.92,
      conversation: 0.93,
      planning: 0.94,
      documentation: 0.95,
    },
    contextWindow: 200000,
    costPer1kInput: 0.003,   // $3/MTok (official)
    costPer1kOutput: 0.015,  // $15/MTok (official)
    avgLatencyMs: 1800,
    rateLimit: 100,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    tier: "economy",
    capabilities: ["quick_answer", "summarization", "conversation", "code_generation"],
    strengthScores: {
      code_generation: 0.82,
      code_review: 0.78,
      code_refactor: 0.76,
      debugging: 0.75,
      reasoning: 0.78,
      math: 0.72,
      creative: 0.80,
      summarization: 0.88,
      translation: 0.82,
      data_analysis: 0.75,
      quick_answer: 0.94,
      conversation: 0.90,
      planning: 0.76,
      documentation: 0.82,
    },
    contextWindow: 200000,
    costPer1kInput: 0.001,   // $1/MTok (official)
    costPer1kOutput: 0.005,  // $5/MTok (official)
    avgLatencyMs: 400,
    rateLimit: 200,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // ============ OPENAI (GPT-5.x Series + Reasoning) ============
  // Source: openai.com/api/pricing - February 2026
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    modelId: "gpt-5.2",
    tier: "flagship",
    capabilities: ["code_generation", "reasoning", "creative", "data_analysis", "planning", "debugging"],
    strengthScores: {
      code_generation: 0.97,
      code_review: 0.95,
      code_refactor: 0.94,
      debugging: 0.95,
      reasoning: 0.96,
      math: 0.94,
      creative: 0.95,
      summarization: 0.93,
      translation: 0.94,
      data_analysis: 0.95,
      quick_answer: 0.92,
      conversation: 0.94,
      planning: 0.95,
      documentation: 0.93,
    },
    contextWindow: 256000,
    costPer1kInput: 0.00175,  // $1.75/MTok (official)
    costPer1kOutput: 0.014,   // $14/MTok (official)
    avgLatencyMs: 2000,
    rateLimit: 80,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    provider: "openai",
    modelId: "gpt-5.2-pro",
    tier: "flagship",
    capabilities: ["code_generation", "reasoning", "creative", "data_analysis", "planning", "debugging", "math"],
    strengthScores: {
      code_generation: 0.98,
      code_review: 0.96,
      code_refactor: 0.95,
      debugging: 0.96,
      reasoning: 0.98,
      math: 0.97,
      creative: 0.96,
      summarization: 0.94,
      translation: 0.95,
      data_analysis: 0.97,
      quick_answer: 0.90,
      conversation: 0.95,
      planning: 0.97,
      documentation: 0.94,
    },
    contextWindow: 256000,
    costPer1kInput: 0.021,   // $21/MTok (official)
    costPer1kOutput: 0.168,  // $168/MTok (official)
    avgLatencyMs: 3500,
    rateLimit: 50,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    modelId: "gpt-5-mini",
    tier: "standard",
    capabilities: ["code_generation", "quick_answer", "conversation", "summarization"],
    strengthScores: {
      code_generation: 0.88,
      code_review: 0.85,
      code_refactor: 0.83,
      debugging: 0.82,
      reasoning: 0.85,
      math: 0.82,
      creative: 0.86,
      summarization: 0.88,
      translation: 0.86,
      data_analysis: 0.84,
      quick_answer: 0.92,
      conversation: 0.90,
      planning: 0.82,
      documentation: 0.85,
    },
    contextWindow: 128000,
    costPer1kInput: 0.00025,  // $0.25/MTok (official)
    costPer1kOutput: 0.002,   // $2/MTok (official)
    avgLatencyMs: 600,
    rateLimit: 200,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    modelId: "gpt-4.1",
    tier: "premium",
    capabilities: ["code_generation", "reasoning", "creative", "data_analysis"],
    strengthScores: {
      code_generation: 0.93,
      code_review: 0.91,
      code_refactor: 0.89,
      debugging: 0.90,
      reasoning: 0.92,
      math: 0.90,
      creative: 0.93,
      summarization: 0.91,
      translation: 0.92,
      data_analysis: 0.92,
      quick_answer: 0.88,
      conversation: 0.91,
      planning: 0.90,
      documentation: 0.90,
    },
    contextWindow: 128000,
    costPer1kInput: 0.003,   // $3/MTok (official fine-tuning price)
    costPer1kOutput: 0.012,  // $12/MTok (official)
    avgLatencyMs: 1500,
    rateLimit: 100,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    modelId: "gpt-4.1-mini",
    tier: "standard",
    capabilities: ["code_generation", "quick_answer", "conversation", "summarization"],
    strengthScores: {
      code_generation: 0.85,
      code_review: 0.82,
      code_refactor: 0.80,
      debugging: 0.78,
      reasoning: 0.82,
      math: 0.80,
      creative: 0.83,
      summarization: 0.85,
      translation: 0.84,
      data_analysis: 0.82,
      quick_answer: 0.90,
      conversation: 0.88,
      planning: 0.80,
      documentation: 0.82,
    },
    contextWindow: 128000,
    costPer1kInput: 0.0008,  // $0.80/MTok (official)
    costPer1kOutput: 0.0032, // $3.20/MTok (official)
    avgLatencyMs: 500,
    rateLimit: 200,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    modelId: "gpt-4.1-nano",
    tier: "economy",
    capabilities: ["quick_answer", "conversation", "summarization"],
    strengthScores: {
      code_generation: 0.78,
      code_review: 0.74,
      code_refactor: 0.72,
      debugging: 0.70,
      reasoning: 0.75,
      math: 0.72,
      creative: 0.76,
      summarization: 0.82,
      translation: 0.80,
      data_analysis: 0.74,
      quick_answer: 0.90,
      conversation: 0.88,
      planning: 0.72,
      documentation: 0.76,
    },
    contextWindow: 128000,
    costPer1kInput: 0.0002,  // $0.20/MTok (official)
    costPer1kOutput: 0.0008, // $0.80/MTok (official)
    avgLatencyMs: 300,
    rateLimit: 500,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },
  // OpenAI Reasoning Models
  {
    id: "o4-mini",
    name: "OpenAI o4-mini",
    provider: "openai",
    modelId: "o4-mini",
    tier: "standard",
    capabilities: ["reasoning", "math", "code_generation", "debugging", "planning"],
    strengthScores: {
      code_generation: 0.90,
      code_review: 0.88,
      code_refactor: 0.86,
      debugging: 0.92,
      reasoning: 0.95,
      math: 0.96,
      creative: 0.78,
      summarization: 0.82,
      translation: 0.80,
      data_analysis: 0.90,
      quick_answer: 0.78,
      conversation: 0.76,
      planning: 0.92,
      documentation: 0.84,
    },
    contextWindow: 128000,
    costPer1kInput: 0.004,   // $4/MTok (official)
    costPer1kOutput: 0.016,  // $16/MTok (official)
    avgLatencyMs: 5000,
    rateLimit: 60,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // OpenAI GPT-5.3 Codex — NEW agentic coding flagship
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    tier: "flagship",
    capabilities: ["code_generation", "code_review", "code_refactor", "debugging", "reasoning", "planning", "math"],
    strengthScores: {
      code_generation: 0.99,
      code_review: 0.97,
      code_refactor: 0.96,
      debugging: 0.97,
      reasoning: 0.97,
      math: 0.96,
      creative: 0.93,
      summarization: 0.92,
      translation: 0.93,
      data_analysis: 0.95,
      quick_answer: 0.90,
      conversation: 0.92,
      planning: 0.96,
      documentation: 0.94,
    },
    contextWindow: 128000,   // 128K context (official)
    costPer1kInput: 0.002,   // ~$2/MTok (estimated)
    costPer1kOutput: 0.015,  // ~$15/MTok (estimated)
    avgLatencyMs: 2500,
    rateLimit: 60,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
    specialFeatures: {
      agenticCoding: true,        // Autonomous coding loops
      effortLevels: ["low", "medium", "high"],
    },
  },

  // ============ GOOGLE (Gemini 3.x and 2.5.x Series) ============
  // Verified: https://cloud.google.com/vertex-ai/generative-ai/pricing (Feb 2026)

  // Gemini 3 Pro Preview - flagship reasoning model
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "google",
    modelId: "gemini-3.0-pro-preview",
    tier: "flagship",
    capabilities: ["code_generation", "reasoning", "data_analysis", "creative", "planning", "math"],
    strengthScores: {
      code_generation: 0.96,
      code_review: 0.94,
      code_refactor: 0.92,
      debugging: 0.93,
      reasoning: 0.97,
      math: 0.97,
      creative: 0.92,
      summarization: 0.93,
      translation: 0.95,
      data_analysis: 0.96,
      quick_answer: 0.91,
      conversation: 0.92,
      planning: 0.95,
      documentation: 0.93,
    },
    contextWindow: 1000000,  // 1M context (assumed)
    costPer1kInput: 0.002,   // $2.00/1M = $0.002/1K (≤200K)
    costPer1kOutput: 0.012,  // $12.00/1M = $0.012/1K
    avgLatencyMs: 3000,
    rateLimit: 60,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // Gemini 3 Flash Preview - fast and efficient
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    modelId: "gemini-3.0-flash-preview",
    tier: "standard",
    capabilities: ["code_generation", "quick_answer", "data_analysis", "summarization"],
    strengthScores: {
      code_generation: 0.90,
      code_review: 0.87,
      code_refactor: 0.85,
      debugging: 0.85,
      reasoning: 0.88,
      math: 0.90,
      creative: 0.85,
      summarization: 0.89,
      translation: 0.91,
      data_analysis: 0.90,
      quick_answer: 0.93,
      conversation: 0.88,
      planning: 0.86,
      documentation: 0.88,
    },
    contextWindow: 1000000,  // 1M context
    costPer1kInput: 0.0005,  // $0.50/1M = $0.0005/1K
    costPer1kOutput: 0.003,  // $3.00/1M = $0.003/1K
    avgLatencyMs: 700,
    rateLimit: 200,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // Gemini 2.5 Pro - excellent reasoning at lower cost
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    modelId: "gemini-2.5-pro",
    tier: "premium",
    capabilities: ["code_generation", "reasoning", "data_analysis", "creative", "planning"],
    strengthScores: {
      code_generation: 0.95,
      code_review: 0.92,
      code_refactor: 0.90,
      debugging: 0.90,
      reasoning: 0.94,
      math: 0.95,
      creative: 0.90,
      summarization: 0.92,
      translation: 0.94,
      data_analysis: 0.95,
      quick_answer: 0.90,
      conversation: 0.90,
      planning: 0.92,
      documentation: 0.91,
    },
    contextWindow: 1000000,  // 1M+ context
    costPer1kInput: 0.00125, // $1.25/1M = $0.00125/1K (≤200K)
    costPer1kOutput: 0.01,   // $10.00/1M = $0.01/1K
    avgLatencyMs: 2500,
    rateLimit: 100,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // Gemini 2.5 Flash - balanced speed and quality
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    modelId: "gemini-2.5-flash",
    tier: "standard",
    capabilities: ["code_generation", "quick_answer", "data_analysis", "summarization"],
    strengthScores: {
      code_generation: 0.88,
      code_review: 0.85,
      code_refactor: 0.83,
      debugging: 0.82,
      reasoning: 0.86,
      math: 0.88,
      creative: 0.82,
      summarization: 0.88,
      translation: 0.90,
      data_analysis: 0.89,
      quick_answer: 0.92,
      conversation: 0.86,
      planning: 0.84,
      documentation: 0.86,
    },
    contextWindow: 1000000,  // 1M context
    costPer1kInput: 0.0003,  // $0.30/1M = $0.0003/1K
    costPer1kOutput: 0.0025, // $2.50/1M = $0.0025/1K
    avgLatencyMs: 500,
    rateLimit: 300,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // Gemini 2.5 Flash Lite - ultra-cheap for simple tasks
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    modelId: "gemini-2.5-flash-lite",
    tier: "economy",
    capabilities: ["quick_answer", "summarization", "conversation"],
    strengthScores: {
      code_generation: 0.80,
      code_review: 0.78,
      code_refactor: 0.75,
      debugging: 0.75,
      reasoning: 0.78,
      math: 0.80,
      creative: 0.75,
      summarization: 0.82,
      translation: 0.85,
      data_analysis: 0.80,
      quick_answer: 0.88,
      conversation: 0.82,
      planning: 0.76,
      documentation: 0.80,
    },
    contextWindow: 1000000,  // 1M context
    costPer1kInput: 0.0001,  // $0.10/1M = $0.0001/1K
    costPer1kOutput: 0.0004, // $0.40/1M = $0.0004/1K
    avgLatencyMs: 300,
    rateLimit: 500,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
  },

  // ============ MOONSHOT AI (Kimi K2.5) ============
  // Source: platform.moonshot.ai (Feb 2026)
  // MoE architecture: 1T total params, 32B active per request
  // Agent Swarm: up to 100 sub-agents for parallel task execution
  // Native multimodal: text + image + video in single model
  // SWE-Bench Verified: 76.8%
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshot",
    modelId: "kimi-k2.5",
    tier: "premium",
    capabilities: ["code_generation", "code_review", "code_refactor", "debugging", "reasoning", "planning", "data_analysis", "creative"],
    strengthScores: {
      code_generation: 0.95,
      code_review: 0.92,
      code_refactor: 0.90,
      debugging: 0.91,
      reasoning: 0.93,
      math: 0.90,
      creative: 0.87,
      summarization: 0.89,
      translation: 0.90,
      data_analysis: 0.91,
      quick_answer: 0.89,
      conversation: 0.88,
      planning: 0.92,
      documentation: 0.89,
    },
    contextWindow: 262000,   // 262K context (official Jan 2026)
    costPer1kInput: 0.0006,  // $0.60/MTok (official: platform.moonshot.ai)
    costPer1kOutput: 0.0025, // $2.50/MTok (official: platform.moonshot.ai)
    avgLatencyMs: 1500,
    rateLimit: 100,
    available: true,
    lastUsed: 0,
    totalCalls: 0,
    successRate: 1.0,
    specialFeatures: {
      agentTeams: true,           // Agent Swarm: up to 100 parallel sub-agents
      nativeMultimodal: true,     // Vision + Text + Video natively
      moeArchitecture: true,      // 1T total / 32B active (efficient)
      longContextOptimized: true, // 262K with minimal drift
    },
  },
];

// ============ HELPERS ============

async function getMoEDir(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, ".swarm", MOE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function loadJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

async function saveJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Estimate tokens from text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Classify task category from content
 */
function classifyTask(content: string): TaskCategory {
  const lower = content.toLowerCase();

  // Code-related patterns
  if (/\b(write|create|implement|build|generate)\b.*\b(function|class|code|api|component)\b/i.test(content)) {
    return "code_generation";
  }
  if (/\b(review|check|analyze)\b.*\b(code|implementation|pr|pull request)\b/i.test(content)) {
    return "code_review";
  }
  if (/\b(refactor|optimize|improve|clean)\b.*\b(code|function|class)\b/i.test(content)) {
    return "code_refactor";
  }
  if (/\b(debug|fix|bug|error|issue|broken)\b/i.test(content)) {
    return "debugging";
  }

  // Reasoning patterns
  if (/\b(explain|why|how|reason|logic|think|analyze)\b/i.test(content) && content.length > 200) {
    return "reasoning";
  }
  if (/\b(calculate|compute|math|equation|formula|solve)\b/i.test(content)) {
    return "math";
  }

  // Creative patterns
  if (/\b(write|create|compose)\b.*\b(story|poem|essay|article|blog)\b/i.test(content)) {
    return "creative";
  }

  // Summary patterns
  if (/\b(summarize|summary|tldr|brief|overview)\b/i.test(content)) {
    return "summarization";
  }

  // Translation
  if (/\b(translate|translation|convert to)\b.*\b(english|spanish|french|german|chinese|japanese|russian)\b/i.test(content)) {
    return "translation";
  }

  // Data analysis
  if (/\b(analyze|data|statistics|trend|pattern|csv|json|dataset)\b/i.test(content)) {
    return "data_analysis";
  }

  // Planning
  if (/\b(plan|roadmap|architecture|design|strategy|approach)\b/i.test(content)) {
    return "planning";
  }

  // Documentation
  if (/\b(document|documentation|readme|docs|api docs|jsdoc)\b/i.test(content)) {
    return "documentation";
  }

  // Quick questions (short content)
  if (content.length < 100 && /\?$/.test(content.trim())) {
    return "quick_answer";
  }

  // Default to conversation
  return "conversation";
}

/**
 * Estimate complexity from content
 */
function estimateComplexity(content: string): TaskRequest["complexity"] {
  const tokens = estimateTokens(content);
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);
  const hasMultipleParts = content.split(/\d+\./).length > 3;

  if (tokens < 50 && !hasCodeBlocks) return "trivial";
  if (tokens < 200 && !hasMultipleParts) return "simple";
  if (tokens < 500) return "medium";
  if (tokens < 2000 || hasMultipleParts) return "complex";
  return "extreme";
}

// ============ CORE FUNCTIONS ============

/**
 * Load configuration
 */
async function loadConfig(repoRoot: string): Promise<MoEConfig> {
  const dir = await getMoEDir(repoRoot);
  return loadJson(path.join(dir, CONFIG_FILE), DEFAULT_CONFIG);
}

/**
 * Save configuration
 */
async function saveConfig(repoRoot: string, config: MoEConfig): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  await saveJson(path.join(dir, CONFIG_FILE), config);
}

/**
 * Load experts
 */
async function loadExperts(repoRoot: string): Promise<Expert[]> {
  const dir = await getMoEDir(repoRoot);
  const experts = await loadJson<Expert[]>(path.join(dir, EXPERTS_FILE), []);
  return experts.length > 0 ? experts : DEFAULT_EXPERTS;
}

/**
 * Save experts
 */
async function saveExperts(repoRoot: string, experts: Expert[]): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  await saveJson(path.join(dir, EXPERTS_FILE), experts);
}

/**
 * Load history
 */
async function loadHistory(repoRoot: string): Promise<RoutingResult[]> {
  const dir = await getMoEDir(repoRoot);
  return loadJson(path.join(dir, HISTORY_FILE), []);
}

/**
 * Save history
 */
async function saveHistory(repoRoot: string, history: RoutingResult[]): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  // Keep last 1000 entries
  const trimmed = history.slice(-1000);
  await saveJson(path.join(dir, HISTORY_FILE), trimmed);
}

/**
 * Load stats
 */
async function loadStats(repoRoot: string): Promise<MoEStats> {
  const dir = await getMoEDir(repoRoot);
  return loadJson(path.join(dir, STATS_FILE), {
    totalRequests: 0,
    successfulRoutes: 0,
    fallbacksUsed: 0,
    avgLatencyMs: 0,
    totalCost: 0,
    byCategory: {} as MoEStats["byCategory"],
    byExpert: {} as MoEStats["byExpert"],
    lastUpdated: Date.now(),
  });
}

/**
 * Save stats
 */
async function saveStats(repoRoot: string, stats: MoEStats): Promise<void> {
  const dir = await getMoEDir(repoRoot);
  await saveJson(path.join(dir, STATS_FILE), stats);
}

// ============ GATING NETWORK ============

/**
 * Calculate expert score for a task
 */
function calculateExpertScore(
  expert: Expert,
  task: TaskRequest,
  config: MoEConfig
): number {
  const category = task.category || classifyTask(task.content);

  // Task match score (how well expert handles this category)
  const taskMatch = expert.strengthScores[category] || 0.5;

  // Cost efficiency (inverse of cost, normalized)
  const estimatedTokens = estimateTokens(task.content);
  const estimatedCost = (estimatedTokens / 1000) * expert.costPer1kInput +
    (estimatedTokens / 1000) * 0.5 * expert.costPer1kOutput;
  const maxCost = 0.1; // $0.10 as reference
  const costEfficiency = 1 - Math.min(estimatedCost / maxCost, 1);

  // Performance score (historical success)
  const performanceScore = expert.successRate;

  // Load balance (prefer less recently used)
  const now = Date.now();
  const timeSinceUse = now - expert.lastUsed;
  const loadBalance = Math.min(timeSinceUse / 60000, 1); // Max out at 1 minute

  // Weighted combination
  const score =
    taskMatch * config.qualityWeight +
    costEfficiency * config.costWeight +
    performanceScore * 0.1 +
    loadBalance * config.latencyWeight;

  return score;
}

/**
 * Route task to best expert
 */
export async function route(input: {
  repoPath?: string;
  content: string;
  category?: TaskCategory;
  complexity?: TaskRequest["complexity"];
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: ModelProvider;
  preferredTier?: ModelTier;
  requiredContext?: number;
  priority?: TaskRequest["priority"];
}): Promise<RoutingDecision> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const config = await loadConfig(repoRoot);
  const experts = await loadExperts(repoRoot);
  const stats = await loadStats(repoRoot);

  const task: TaskRequest = {
    content: input.content,
    category: input.category || classifyTask(input.content),
    complexity: input.complexity || estimateComplexity(input.content),
    maxLatencyMs: input.maxLatencyMs,
    maxCost: input.maxCost,
    preferredProvider: input.preferredProvider,
    preferredTier: input.preferredTier,
    requiredContext: input.requiredContext,
    priority: input.priority || "normal",
  };

  // Filter available experts
  let candidates = experts.filter(e => e.available);

  // Apply constraints
  if (task.preferredProvider) {
    const providerExperts = candidates.filter(e => e.provider === task.preferredProvider);
    if (providerExperts.length > 0) candidates = providerExperts;
  }

  if (task.preferredTier) {
    const tierExperts = candidates.filter(e => e.tier === task.preferredTier);
    if (tierExperts.length > 0) candidates = tierExperts;
  }

  if (task.requiredContext) {
    candidates = candidates.filter(e => e.contextWindow >= task.requiredContext!);
  }

  if (task.maxLatencyMs) {
    candidates = candidates.filter(e => e.avgLatencyMs <= task.maxLatencyMs!);
  }

  // Score all candidates
  const scored = candidates.map(expert => ({
    expert,
    score: calculateExpertScore(expert, task, config),
    taskMatch: expert.strengthScores[task.category!] || 0.5,
  }));

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    throw new Error("No suitable experts available for this task");
  }

  const selected = scored[0];
  const alternatives = scored.slice(1, 4).map(s => s.expert);

  // Estimate costs
  const inputTokens = estimateTokens(task.content);
  const outputTokens = Math.ceil(inputTokens * 0.5); // Rough estimate
  let estimatedCost =
    (inputTokens / 1000) * selected.expert.costPer1kInput +
    (outputTokens / 1000) * selected.expert.costPer1kOutput;

  // ============ EFFORT-LEVEL AUTO-DOWNGRADE ============
  // Claude Opus 4.6 supports /effort parameter — use medium for simple tasks
  // to reduce cost (~40%) and latency without significant quality loss
  const costOptimizationHints: string[] = [];
  const sf = selected.expert.specialFeatures;

  if (sf?.effortLevels && sf.effortLevels.length > 0) {
    const complexity = task.complexity || "medium";
    if (complexity === "trivial" || complexity === "simple") {
      costOptimizationHints.push(
        `💡 Рекомендация: Используйте /effort medium для ${selected.expert.name} — ` +
        `экономия ~40% стоимости на ${complexity} задачах`
      );
      // Adjust estimated cost to reflect effort medium savings
      estimatedCost *= 0.6;
    }
  }

  // Agent Teams hint for complex multi-file tasks
  if (sf?.agentTeams && (task.complexity === "complex" || task.complexity === "extreme")) {
    costOptimizationHints.push(
      `🤖 Agent Teams доступны: ${selected.expert.name} может orchestrate параллельные sub-agents`
    );
  }

  // Agent Swarm preference: for complex tasks requiring parallel decomposition,
  // prefer models with agentTeams (Kimi K2.5 = up to 100 sub-agents, 9x cheaper than Opus)
  if ((task.complexity === "complex" || task.complexity === "extreme") && !sf?.agentTeams) {
    const swarmCapable = candidates.filter(e => e.specialFeatures?.agentTeams);
    if (swarmCapable.length > 0) {
      const cheapest = swarmCapable.sort((a, b) => a.costPer1kInput - b.costPer1kInput)[0];
      costOptimizationHints.push(
        `🐝 Agent Swarm: ${cheapest.name} поддерживает параллельную декомпозицию ` +
        `(${cheapest.costPer1kInput * 1000}$/MTok vs ${selected.expert.costPer1kInput * 1000}$/MTok — ` +
        `${(selected.expert.costPer1kInput / cheapest.costPer1kInput).toFixed(1)}x дешевле)`
      );
    }
  }

  // Native multimodal hint for image/video tasks
  if (sf?.nativeMultimodal && /\b(image|screenshot|diagram|video|visual|ui|design|mockup)\b/i.test(task.content)) {
    costOptimizationHints.push(
      `🖼️ Native Multimodal: ${selected.expert.name} оптимален для visual → code задач`
    );
  } else if (/\b(image|screenshot|diagram|video|visual|ui|design|mockup)\b/i.test(task.content)) {
    const multimodalExperts = candidates.filter(e => e.specialFeatures?.nativeMultimodal);
    if (multimodalExperts.length > 0) {
      costOptimizationHints.push(
        `🖼️ Multimodal задача: рассмотрите ${multimodalExperts[0].name} для native visual processing`
      );
    }
  }

  // MoE architecture hint — efficient for large workloads
  if (sf?.moeArchitecture) {
    costOptimizationHints.push(
      `⚡ MoE Architecture: ${selected.expert.name} активирует только 32B из 1T параметров — эффективнее dense моделей`
    );
  }

  // Context compaction hint for large contexts
  if (sf?.contextCompaction && inputTokens > 50000) {
    costOptimizationHints.push(
      `📦 Context Compaction: ${selected.expert.name} автоматически сжимает контекст для длинных сессий`
    );
  }

  // Long context preference: if required context > 200K, boost 1M models
  if (task.requiredContext && task.requiredContext > 200000) {
    const longContextExperts = candidates.filter(
      e => e.contextWindow >= 1000000 || e.specialFeatures?.longContextOptimized
    );
    if (longContextExperts.length > 0 && !longContextExperts.includes(selected.expert)) {
      costOptimizationHints.push(
        `⚠️ Контекст ${(task.requiredContext / 1000).toFixed(0)}K: рассмотрите модели с 1M контекстом`
      );
    }
  }

  // Update stats
  stats.totalRequests++;
  stats.lastUpdated = Date.now();
  await saveStats(repoRoot, stats);

  const reasoningParts = [
    `Selected ${selected.expert.name} for ${task.category} task.`,
    `Task match: ${(selected.taskMatch * 100).toFixed(0)}%,`,
    `Tier: ${selected.expert.tier},`,
    `Estimated cost: $${estimatedCost.toFixed(4)}`,
  ];
  if (costOptimizationHints.length > 0) {
    reasoningParts.push(`Hints: ${costOptimizationHints.join("; ")}`);
  }

  return {
    selectedExpert: selected.expert,
    confidence: selected.score,
    alternatives,
    reasoning: reasoningParts.join(" "),
    estimatedCost,
    estimatedLatency: selected.expert.avgLatencyMs,
    estimatedTokens: {
      input: inputTokens,
      output: outputTokens,
    },
    factors: {
      taskMatch: selected.taskMatch,
      costEfficiency: 1 - (estimatedCost / 0.1),
      performanceScore: selected.expert.successRate,
      loadBalance: Math.min((Date.now() - selected.expert.lastUsed) / 60000, 1),
    },
  };
}

/**
 * Record routing result feedback
 */
export async function feedback(input: {
  repoPath?: string;
  requestId: string;
  expertId: string;
  success: boolean;
  actualLatencyMs?: number;
  actualCost?: number;
  quality?: number;
  comment?: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const experts = await loadExperts(repoRoot);
  const config = await loadConfig(repoRoot);
  const stats = await loadStats(repoRoot);
  const history = await loadHistory(repoRoot);

  // Find expert
  const expert = experts.find(e => e.id === input.expertId);
  if (!expert) {
    return { success: false, message: "Expert not found" };
  }

  // Update expert stats
  expert.lastUsed = Date.now();
  expert.totalCalls++;

  // Update success rate with exponential moving average
  if (config.learningEnabled) {
    const newSuccess = input.success ? 1 : 0;
    expert.successRate = expert.successRate * (1 - config.learningRate) +
      newSuccess * config.learningRate;
  }

  // Update latency
  if (input.actualLatencyMs) {
    expert.avgLatencyMs = expert.avgLatencyMs * 0.9 + input.actualLatencyMs * 0.1;
  }

  // Add to history
  history.push({
    requestId: input.requestId,
    decision: {
      selectedExpert: expert,
      confidence: 1,
      alternatives: [],
      reasoning: "Feedback recorded",
      estimatedCost: input.actualCost || 0,
      estimatedLatency: input.actualLatencyMs || 0,
      estimatedTokens: { input: 0, output: 0 },
      factors: { taskMatch: 0, costEfficiency: 0, performanceScore: 0, loadBalance: 0 },
    },
    timestamp: Date.now(),
    actualLatencyMs: input.actualLatencyMs,
    actualCost: input.actualCost,
    success: input.success,
    feedback: input.quality ? {
      quality: input.quality,
      comment: input.comment,
    } : undefined,
  });

  // Update global stats
  if (input.success) stats.successfulRoutes++;
  if (input.actualLatencyMs) {
    stats.avgLatencyMs = stats.avgLatencyMs * 0.9 + input.actualLatencyMs * 0.1;
  }
  if (input.actualCost) {
    stats.totalCost += input.actualCost;
  }

  // Update per-expert stats
  if (!stats.byExpert[expert.id]) {
    stats.byExpert[expert.id] = {
      calls: 0,
      avgLatency: 0,
      totalCost: 0,
      successRate: 1,
    };
  }
  stats.byExpert[expert.id].calls++;
  if (input.actualLatencyMs) {
    stats.byExpert[expert.id].avgLatency =
      stats.byExpert[expert.id].avgLatency * 0.9 + input.actualLatencyMs * 0.1;
  }
  if (input.actualCost) {
    stats.byExpert[expert.id].totalCost += input.actualCost;
  }
  stats.byExpert[expert.id].successRate = expert.successRate;

  stats.lastUpdated = Date.now();

  await saveExperts(repoRoot, experts);
  await saveStats(repoRoot, stats);
  await saveHistory(repoRoot, history);

  return { success: true, message: `Feedback recorded for ${expert.name}` };
}

/**
 * Get all experts
 */
export async function getExperts(input: {
  repoPath?: string;
  provider?: ModelProvider;
  tier?: ModelTier;
  category?: TaskCategory;
}): Promise<Expert[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  let experts = await loadExperts(repoRoot);

  if (input.provider) {
    experts = experts.filter(e => e.provider === input.provider);
  }
  if (input.tier) {
    experts = experts.filter(e => e.tier === input.tier);
  }
  if (input.category) {
    experts = experts.filter(e => e.capabilities.includes(input.category!));
  }

  return experts;
}

/**
 * Add or update expert
 */
export async function addExpert(input: {
  repoPath?: string;
  expert: Partial<Expert> & { id: string; name: string; provider: ModelProvider; modelId: string };
}): Promise<{ success: boolean; expert: Expert }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const experts = await loadExperts(repoRoot);

  const existing = experts.find(e => e.id === input.expert.id);

  const expert: Expert = {
    id: input.expert.id,
    name: input.expert.name,
    provider: input.expert.provider,
    modelId: input.expert.modelId,
    tier: input.expert.tier || "standard",
    capabilities: input.expert.capabilities || ["conversation"],
    strengthScores: input.expert.strengthScores || {
      code_generation: 0.5,
      code_review: 0.5,
      code_refactor: 0.5,
      debugging: 0.5,
      reasoning: 0.5,
      math: 0.5,
      creative: 0.5,
      summarization: 0.5,
      translation: 0.5,
      data_analysis: 0.5,
      quick_answer: 0.5,
      conversation: 0.5,
      planning: 0.5,
      documentation: 0.5,
    },
    contextWindow: input.expert.contextWindow || 100000,
    costPer1kInput: input.expert.costPer1kInput || 0.001,
    costPer1kOutput: input.expert.costPer1kOutput || 0.002,
    avgLatencyMs: input.expert.avgLatencyMs || 2000,
    rateLimit: input.expert.rateLimit || 100,
    available: input.expert.available ?? true,
    lastUsed: existing?.lastUsed || 0,
    totalCalls: existing?.totalCalls || 0,
    successRate: existing?.successRate || 1.0,
  };

  if (existing) {
    Object.assign(existing, expert);
  } else {
    experts.push(expert);
  }

  await saveExperts(repoRoot, experts);
  return { success: true, expert };
}

/**
 * Remove expert
 */
export async function removeExpert(input: {
  repoPath?: string;
  expertId: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const experts = await loadExperts(repoRoot);

  const index = experts.findIndex(e => e.id === input.expertId);
  if (index === -1) {
    return { success: false, message: "Expert not found" };
  }

  const removed = experts.splice(index, 1)[0];
  await saveExperts(repoRoot, experts);

  return { success: true, message: `Removed expert: ${removed.name}` };
}

/**
 * Get configuration
 */
export async function getConfig(input: {
  repoPath?: string;
}): Promise<MoEConfig> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadConfig(repoRoot);
}

/**
 * Update configuration
 */
export async function setConfig(input: {
  repoPath?: string;
  config: Partial<MoEConfig>;
}): Promise<{ success: boolean; config: MoEConfig }> {
  const repoRoot = await getRepoRoot(input.repoPath);
  const current = await loadConfig(repoRoot);
  const updated = { ...current, ...input.config };
  await saveConfig(repoRoot, updated);
  return { success: true, config: updated };
}

/**
 * Get statistics
 */
export async function getStats(input: {
  repoPath?: string;
}): Promise<MoEStats> {
  const repoRoot = await getRepoRoot(input.repoPath);
  return loadStats(repoRoot);
}

/**
 * Get routing history
 */
export async function getHistory(input: {
  repoPath?: string;
  limit?: number;
  expertId?: string;
}): Promise<RoutingResult[]> {
  const repoRoot = await getRepoRoot(input.repoPath);
  let history = await loadHistory(repoRoot);

  if (input.expertId) {
    history = history.filter(h => h.decision.selectedExpert.id === input.expertId);
  }

  return history.slice(-(input.limit || 50)).reverse();
}

/**
 * Classify task
 */
export async function classify(input: {
  repoPath?: string;
  content: string;
}): Promise<{
  category: TaskCategory;
  complexity: TaskRequest["complexity"];
  estimatedTokens: number;
}> {
  return {
    category: classifyTask(input.content),
    complexity: estimateComplexity(input.content),
    estimatedTokens: estimateTokens(input.content),
  };
}

/**
 * Reset expert stats
 */
export async function resetStats(input: {
  repoPath?: string;
  expertId?: string;
}): Promise<{ success: boolean; message: string }> {
  const repoRoot = await getRepoRoot(input.repoPath);

  if (input.expertId) {
    const experts = await loadExperts(repoRoot);
    const expert = experts.find(e => e.id === input.expertId);
    if (!expert) {
      return { success: false, message: "Expert not found" };
    }
    expert.totalCalls = 0;
    expert.successRate = 1.0;
    expert.lastUsed = 0;
    await saveExperts(repoRoot, experts);
    return { success: true, message: `Reset stats for ${expert.name}` };
  }

  // Reset all
  const stats: MoEStats = {
    totalRequests: 0,
    successfulRoutes: 0,
    fallbacksUsed: 0,
    avgLatencyMs: 0,
    totalCost: 0,
    byCategory: {} as MoEStats["byCategory"],
    byExpert: {} as MoEStats["byExpert"],
    lastUpdated: Date.now(),
  };
  await saveStats(repoRoot, stats);

  return { success: true, message: "All statistics reset" };
}

// ============ MAIN HANDLER ============

export type MoEAction =
  | "route"          // Route task to best expert
  | "feedback"       // Record routing feedback
  | "experts"        // List experts
  | "add_expert"     // Add/update expert
  | "remove_expert"  // Remove expert
  | "config"         // Get config
  | "set_config"     // Update config
  | "stats"          // Get statistics
  | "history"        // Get routing history
  | "classify"       // Classify task
  | "reset";         // Reset stats

export async function handleMoETool(input: {
  action: MoEAction;
  repoPath?: string;
  // For route
  content?: string;
  category?: TaskCategory;
  complexity?: TaskRequest["complexity"];
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: ModelProvider;
  preferredTier?: ModelTier;
  requiredContext?: number;
  priority?: TaskRequest["priority"];
  // For feedback
  requestId?: string;
  expertId?: string;
  success?: boolean;
  actualLatencyMs?: number;
  actualCost?: number;
  quality?: number;
  comment?: string;
  // For experts
  provider?: ModelProvider;
  tier?: ModelTier;
  // For add_expert
  expert?: Partial<Expert> & { id: string; name: string; provider: ModelProvider; modelId: string };
  // For history
  limit?: number;
  // For set_config
  config?: Partial<MoEConfig>;
}): Promise<unknown> {
  switch (input.action) {
    case "route":
      return route({
        repoPath: input.repoPath,
        content: input.content || "",
        category: input.category,
        complexity: input.complexity,
        maxLatencyMs: input.maxLatencyMs,
        maxCost: input.maxCost,
        preferredProvider: input.preferredProvider,
        preferredTier: input.preferredTier,
        requiredContext: input.requiredContext,
        priority: input.priority,
      });

    case "feedback":
      return feedback({
        repoPath: input.repoPath,
        requestId: input.requestId || "",
        expertId: input.expertId || "",
        success: input.success ?? true,
        actualLatencyMs: input.actualLatencyMs,
        actualCost: input.actualCost,
        quality: input.quality,
        comment: input.comment,
      });

    case "experts":
      return getExperts({
        repoPath: input.repoPath,
        provider: input.provider,
        tier: input.tier,
        category: input.category,
      });

    case "add_expert":
      if (!input.expert) {
        return { error: "Expert data required" };
      }
      return addExpert({
        repoPath: input.repoPath,
        expert: input.expert,
      });

    case "remove_expert":
      return removeExpert({
        repoPath: input.repoPath,
        expertId: input.expertId || "",
      });

    case "config":
      return getConfig({ repoPath: input.repoPath });

    case "set_config":
      return setConfig({
        repoPath: input.repoPath,
        config: input.config || {},
      });

    case "stats":
      return getStats({ repoPath: input.repoPath });

    case "history":
      return getHistory({
        repoPath: input.repoPath,
        limit: input.limit,
        expertId: input.expertId,
      });

    case "classify":
      return classify({
        repoPath: input.repoPath,
        content: input.content || "",
      });

    case "reset":
      return resetStats({
        repoPath: input.repoPath,
        expertId: input.expertId,
      });

    default:
      return { error: `Unknown action: ${input.action}` };
  }
}
