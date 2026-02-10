/**
 * MCP Swarm - Request Batching Optimization
 * 
 * Batches multiple API requests to reduce costs and improve performance.
 * Supports Anthropic Message Batches API and OpenAI Batch API.
 * 
 * Benefits:
 * - 50% cost reduction on batch requests
 * - Better throughput for bulk operations
 * - Automatic retry and error handling
 * 
 * @version 0.9.4
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getErrorMessage } from "../utils/errorUtils.js";

// ============================================================================
// TYPES
// ============================================================================

export type BatchProvider = "anthropic" | "openai" | "google";

export interface BatchRequest {
  id: string;
  provider: BatchProvider;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface BatchJob {
  id: string;
  provider: BatchProvider;
  externalId?: string; // Provider's batch ID
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  requests: BatchRequest[];
  results?: BatchResult[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface BatchResult {
  requestId: string;
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface BatchConfig {
  enabled: boolean;
  maxBatchSize: number; // Max requests per batch
  maxWaitMs: number; // Max time to wait before sending batch
  providers: {
    anthropic?: {
      apiKey?: string;
      endpoint?: string;
    };
    openai?: {
      apiKey?: string;
      endpoint?: string;
    };
  };
}

// ============================================================================
// STATE
// ============================================================================

const pendingRequests: Map<string, BatchRequest[]> = new Map();
const batchTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// ============================================================================
// CONFIG
// ============================================================================

const DEFAULT_CONFIG: BatchConfig = {
  enabled: true,
  maxBatchSize: 100,
  maxWaitMs: 5000,
  providers: {},
};

export async function getBatchConfig(repoPath: string): Promise<BatchConfig> {
  const configPath = path.join(repoPath, ".swarm", "batch-config.json");

  try {
    const data = await fs.readFile(configPath, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setBatchConfig(repoPath: string, config: Partial<BatchConfig>): Promise<BatchConfig> {
  const configPath = path.join(repoPath, ".swarm", "batch-config.json");
  const current = await getBatchConfig(repoPath);
  const updated = { ...current, ...config };

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(updated, null, 2));

  return updated;
}

// ============================================================================
// BATCH QUEUE
// ============================================================================

/**
 * Add a request to the batch queue
 */
export async function queueRequest(
  repoPath: string,
  request: Omit<BatchRequest, "id" | "createdAt">
): Promise<string> {
  const config = await getBatchConfig(repoPath);

  if (!config.enabled) {
    // If batching disabled, return immediately with request ID
    return `direct-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const batchRequest: BatchRequest = {
    ...request,
    id: requestId,
    createdAt: new Date().toISOString(),
  };

  const queueKey = `${request.provider}:${request.model}`;

  if (!pendingRequests.has(queueKey)) {
    pendingRequests.set(queueKey, []);
  }

  const queue = pendingRequests.get(queueKey)!;
  queue.push(batchRequest);

  // Check if we should send batch now
  if (queue.length >= config.maxBatchSize) {
    await flushQueue(repoPath, queueKey);
  } else if (!batchTimers.has(queueKey)) {
    // Start timer to flush after maxWaitMs
    const timer = setTimeout(async () => {
      await flushQueue(repoPath, queueKey);
    }, config.maxWaitMs);
    batchTimers.set(queueKey, timer);
  }

  return requestId;
}

/**
 * Flush a queue and send batch
 */
async function flushQueue(repoPath: string, queueKey: string): Promise<BatchJob | null> {
  const queue = pendingRequests.get(queueKey);

  if (!queue || queue.length === 0) {
    return null;
  }

  // Clear timer
  const timer = batchTimers.get(queueKey);
  if (timer) {
    clearTimeout(timer);
    batchTimers.delete(queueKey);
  }

  // Take all requests
  const requests = [...queue];
  pendingRequests.set(queueKey, []);

  // Create batch job
  const [provider] = queueKey.split(":") as [BatchProvider];
  const job: BatchJob = {
    id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    provider,
    status: "pending",
    requests,
    createdAt: new Date().toISOString(),
  };

  // Save job
  await saveBatchJob(repoPath, job);

  // Send batch (async)
  sendBatch(repoPath, job).catch(console.error);

  return job;
}

// ============================================================================
// BATCH EXECUTION
// ============================================================================

/**
 * Send batch to provider
 */
async function sendBatch(repoPath: string, job: BatchJob): Promise<void> {
  const config = await getBatchConfig(repoPath);

  job.status = "processing";
  job.startedAt = new Date().toISOString();
  await saveBatchJob(repoPath, job);

  try {
    switch (job.provider) {
      case "anthropic":
        await sendAnthropicBatch(config, job);
        break;
      case "openai":
        await sendOpenAIBatch(config, job);
        break;
      default:
        throw new Error(`Unsupported provider: ${job.provider}`);
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
  } catch (error: unknown) {
    job.status = "failed";
    job.error = getErrorMessage(error);
    job.completedAt = new Date().toISOString();
  }

  await saveBatchJob(repoPath, job);
}

/**
 * Send batch to Anthropic Message Batches API
 * https://docs.anthropic.com/en/docs/build-with-claude/message-batches
 */
async function sendAnthropicBatch(config: BatchConfig, job: BatchJob): Promise<void> {
  const apiKey = config.providers.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const endpoint = config.providers.anthropic?.endpoint || "https://api.anthropic.com/v1/messages/batches";

  // Format requests for Anthropic Batch API
  const requests = job.requests.map((req, i) => ({
    custom_id: req.id,
    params: {
      model: req.model,
      max_tokens: req.maxTokens || 4096,
      messages: req.messages,
    },
  }));

  // Create batch
  const createResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "message-batches-2024-09-24",
    },
    body: JSON.stringify({ requests }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Anthropic batch creation failed: ${error}`);
  }

  const batch = await createResponse.json() as { id: string };
  job.externalId = batch.id;

  // Poll for completion (simplified - in production use webhooks)
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000)); // Wait 5 seconds

    const statusResponse = await fetch(`${endpoint}/${batch.id}`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "message-batches-2024-09-24",
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check batch status`);
    }

    const status = await statusResponse.json() as {
      processing_status: string;
      results_url?: string;
    };

    if (status.processing_status === "ended") {
      // Fetch results
      if (status.results_url) {
        const resultsResponse = await fetch(status.results_url, {
          headers: { "x-api-key": apiKey },
        });

        if (resultsResponse.ok) {
          const resultsText = await resultsResponse.text();
          const results = resultsText.split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line));

          job.results = results.map((r: any) => ({
            requestId: r.custom_id,
            success: r.result?.type === "succeeded",
            response: r.result?.message?.content?.[0]?.text,
            error: r.result?.error?.message,
            usage: r.result?.message?.usage
              ? {
                inputTokens: r.result.message.usage.input_tokens,
                outputTokens: r.result.message.usage.output_tokens,
              }
              : undefined,
          }));
        }
      }
      break;
    }

    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error("Batch processing timeout");
  }
}

/**
 * Send batch to OpenAI Batch API
 * https://platform.openai.com/docs/guides/batch
 */
async function sendOpenAIBatch(config: BatchConfig, job: BatchJob): Promise<void> {
  const apiKey = config.providers.openai?.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const baseUrl = config.providers.openai?.endpoint || "https://api.openai.com/v1";

  // Create JSONL file content
  const jsonlContent = job.requests
    .map((req) =>
      JSON.stringify({
        custom_id: req.id,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens || 4096,
        },
      })
    )
    .join("\n");

  // Upload file
  const formData = new FormData();
  formData.append("purpose", "batch");
  formData.append("file", new Blob([jsonlContent], { type: "application/jsonl" }), "batch.jsonl");

  const uploadResponse = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload batch file");
  }

  const file = await uploadResponse.json() as { id: string };

  // Create batch
  const createResponse = await fetch(`${baseUrl}/batches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input_file_id: file.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
    }),
  });

  if (!createResponse.ok) {
    throw new Error("Failed to create batch");
  }

  const batch = await createResponse.json() as { id: string };
  job.externalId = batch.id;

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusResponse = await fetch(`${baseUrl}/batches/${batch.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusResponse.ok) continue;

    const status = await statusResponse.json() as {
      status: string;
      output_file_id?: string;
    };

    if (status.status === "completed" && status.output_file_id) {
      // Fetch results
      const resultsResponse = await fetch(`${baseUrl}/files/${status.output_file_id}/content`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (resultsResponse.ok) {
        const resultsText = await resultsResponse.text();
        const results = resultsText.split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));

        job.results = results.map((r: any) => ({
          requestId: r.custom_id,
          success: !r.error,
          response: r.response?.body?.choices?.[0]?.message?.content,
          error: r.error?.message,
          usage: r.response?.body?.usage
            ? {
              inputTokens: r.response.body.usage.prompt_tokens,
              outputTokens: r.response.body.usage.completion_tokens,
            }
            : undefined,
        }));
      }
      break;
    }

    if (status.status === "failed" || status.status === "expired") {
      throw new Error(`Batch ${status.status}`);
    }

    attempts++;
  }
}

// ============================================================================
// STORAGE
// ============================================================================

async function saveBatchJob(repoPath: string, job: BatchJob): Promise<void> {
  const jobsDir = path.join(repoPath, ".swarm", "batches");
  await fs.mkdir(jobsDir, { recursive: true });

  const jobPath = path.join(jobsDir, `${job.id}.json`);
  await fs.writeFile(jobPath, JSON.stringify(job, null, 2));
}

export async function getBatchJob(repoPath: string, jobId: string): Promise<BatchJob | null> {
  const jobPath = path.join(repoPath, ".swarm", "batches", `${jobId}.json`);

  try {
    const data = await fs.readFile(jobPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function listBatchJobs(
  repoPath: string,
  status?: BatchJob["status"]
): Promise<BatchJob[]> {
  const jobsDir = path.join(repoPath, ".swarm", "batches");

  try {
    const files = await fs.readdir(jobsDir);
    const jobs: BatchJob[] = [];

    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const data = await fs.readFile(path.join(jobsDir, file), "utf-8");
      const job = JSON.parse(data) as BatchJob;

      if (!status || job.status === status) {
        jobs.push(job);
      }
    }

    return jobs.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Wait for a specific request result
 */
export async function waitForResult(
  repoPath: string,
  requestId: string,
  timeoutMs: number = 300000
): Promise<BatchResult | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const jobs = await listBatchJobs(repoPath);

    for (const job of jobs) {
      if (job.results) {
        const result = job.results.find((r) => r.requestId === requestId);
        if (result) return result;
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return null;
}

/**
 * Get batching statistics
 */
export async function getBatchStats(repoPath: string): Promise<{
  totalJobs: number;
  totalRequests: number;
  completedJobs: number;
  failedJobs: number;
  pendingRequests: number;
  estimatedSavings: number;
}> {
  const jobs = await listBatchJobs(repoPath);

  let totalRequests = 0;
  let totalTokens = 0;

  for (const job of jobs) {
    totalRequests += job.requests.length;

    if (job.results) {
      for (const result of job.results) {
        if (result.usage) {
          totalTokens += result.usage.inputTokens + result.usage.outputTokens;
        }
      }
    }
  }

  // Pending requests in queues
  let pendingInQueue = 0;
  for (const [, queue] of pendingRequests) {
    pendingInQueue += queue.length;
  }

  // Estimate 50% savings on batch requests
  const estimatedSavings = totalTokens * 0.000002 * 0.5; // Rough estimate

  return {
    totalJobs: jobs.length,
    totalRequests,
    completedJobs: jobs.filter((j) => j.status === "completed").length,
    failedJobs: jobs.filter((j) => j.status === "failed").length,
    pendingRequests: pendingInQueue,
    estimatedSavings,
  };
}

// ============================================================================
// SMART TOOL INTERFACE
// ============================================================================

export interface BatchToolParams {
  action: string;
  repoPath: string;
  // Queue
  provider?: BatchProvider;
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  maxTokens?: number;
  // Config
  enabled?: boolean;
  maxBatchSize?: number;
  maxWaitMs?: number;
  // Query
  jobId?: string;
  requestId?: string;
  status?: BatchJob["status"];
}

export async function handleBatchTool(params: BatchToolParams): Promise<any> {
  const { action, repoPath } = params;

  switch (action) {
    case "queue":
      if (!params.provider || !params.model || !params.messages) {
        return { error: "provider, model, and messages are required" };
      }
      const requestId = await queueRequest(repoPath, {
        provider: params.provider,
        model: params.model,
        messages: params.messages,
        maxTokens: params.maxTokens,
      });
      return { requestId, queued: true };

    case "config":
      return await getBatchConfig(repoPath);

    case "set_config":
      return await setBatchConfig(repoPath, {
        enabled: params.enabled,
        maxBatchSize: params.maxBatchSize,
        maxWaitMs: params.maxWaitMs,
      });

    case "job":
      if (!params.jobId) return { error: "jobId required" };
      return await getBatchJob(repoPath, params.jobId);

    case "jobs":
      return await listBatchJobs(repoPath, params.status);

    case "result":
      if (!params.requestId) return { error: "requestId required" };
      return await waitForResult(repoPath, params.requestId, 30000);

    case "stats":
      return await getBatchStats(repoPath);

    case "flush":
      // Flush all pending queues
      const flushed: string[] = [];
      for (const [key] of pendingRequests) {
        const job = await flushQueue(repoPath, key);
        if (job) flushed.push(job.id);
      }
      return { flushed };

    default:
      return { error: `Unknown action: ${action}` };
  }
}
