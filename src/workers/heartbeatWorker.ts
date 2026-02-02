/**
 * Heartbeat Worker для MCP Swarm
 * 
 * Работает в отдельном потоке и регулярно отправляет heartbeat,
 * даже когда основной агент "думает" (processing).
 * 
 * Использует Node.js worker_threads для изоляции.
 */

import { parentPort, workerData } from "node:worker_threads";
import fs from "node:fs/promises";
import path from "node:path";

interface WorkerData {
  repoPath: string;
  agentId: string;
  isOrchestrator: boolean;
  intervalMs: number;
}

const ORCHESTRATOR_FILE = ".swarm/ORCHESTRATOR.json";

async function updateHeartbeat(data: WorkerData): Promise<boolean> {
  const orchestratorPath = path.join(data.repoPath, ORCHESTRATOR_FILE);
  
  try {
    const raw = await fs.readFile(orchestratorPath, "utf8");
    const state = JSON.parse(raw);
    
    if (data.isOrchestrator) {
      // Обновляем heartbeat оркестратора
      if (state.orchestratorId === data.agentId) {
        state.lastHeartbeat = Date.now();
        await fs.writeFile(orchestratorPath, JSON.stringify(state, null, 2), "utf8");
        return true;
      }
    } else {
      // Обновляем heartbeat исполнителя
      const executor = state.executors?.find((e: { agentId: string }) => e.agentId === data.agentId);
      if (executor) {
        executor.lastSeen = Date.now();
        executor.status = "active";
        await fs.writeFile(orchestratorPath, JSON.stringify(state, null, 2), "utf8");
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("[HeartbeatWorker] Error:", error);
    return false;
  }
}

// Основной цикл
async function run() {
  const data = workerData as WorkerData;
  
  console.log(`[HeartbeatWorker] Started for ${data.isOrchestrator ? "orchestrator" : "executor"} ${data.agentId}`);
  console.log(`[HeartbeatWorker] Interval: ${data.intervalMs}ms`);
  
  const tick = async () => {
    const success = await updateHeartbeat(data);
    
    if (parentPort) {
      parentPort.postMessage({
        type: "heartbeat",
        success,
        timestamp: Date.now(),
      });
    }
  };
  
  // Первый heartbeat сразу
  await tick();
  
  // Регулярный heartbeat
  setInterval(tick, data.intervalMs);
}

// Обработка сообщений от родителя
if (parentPort) {
  parentPort.on("message", (message) => {
    if (message.type === "stop") {
      console.log("[HeartbeatWorker] Stopping...");
      process.exit(0);
    }
  });
}

run().catch(console.error);
