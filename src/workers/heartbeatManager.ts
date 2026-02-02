/**
 * Heartbeat Manager
 * 
 * Управляет запуском и остановкой heartbeat worker.
 * Обеспечивает фоновую отправку heartbeat даже когда
 * основной агент занят обработкой.
 */

import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface HeartbeatManagerOptions {
  repoPath: string;
  agentId: string;
  isOrchestrator: boolean;
  intervalMs?: number;
  onHeartbeat?: (success: boolean, timestamp: number) => void;
  onError?: (error: Error) => void;
}

let worker: Worker | null = null;

/**
 * Запускает heartbeat worker
 */
export function startHeartbeatWorker(options: HeartbeatManagerOptions): void {
  if (worker) {
    console.warn("[HeartbeatManager] Worker already running");
    return;
  }
  
  const workerPath = path.join(__dirname, "heartbeatWorker.js");
  
  worker = new Worker(workerPath, {
    workerData: {
      repoPath: options.repoPath,
      agentId: options.agentId,
      isOrchestrator: options.isOrchestrator,
      intervalMs: options.intervalMs || 10000, // 10 секунд по умолчанию
    },
  });
  
  worker.on("message", (message) => {
    if (message.type === "heartbeat" && options.onHeartbeat) {
      options.onHeartbeat(message.success, message.timestamp);
    }
  });
  
  worker.on("error", (error) => {
    console.error("[HeartbeatManager] Worker error:", error);
    if (options.onError) {
      options.onError(error);
    }
  });
  
  worker.on("exit", (code) => {
    console.log(`[HeartbeatManager] Worker exited with code ${code}`);
    worker = null;
  });
  
  console.log("[HeartbeatManager] Worker started");
}

/**
 * Останавливает heartbeat worker
 */
export function stopHeartbeatWorker(): void {
  if (!worker) {
    console.warn("[HeartbeatManager] No worker running");
    return;
  }
  
  worker.postMessage({ type: "stop" });
  worker = null;
  
  console.log("[HeartbeatManager] Worker stopped");
}

/**
 * Проверяет, запущен ли worker
 */
export function isHeartbeatWorkerRunning(): boolean {
  return worker !== null;
}
