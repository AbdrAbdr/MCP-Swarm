import useSWR from "swr"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3334"

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("API error")
  return res.json()
}

export interface SwarmStats {
  totalAgents: number
  activeAgents: number
  deadAgents: number
  totalTasks: number
  pendingTasks: number
  completedTasks: number
  totalMessages: number
  unreadMessages: number
  orchestratorName: string | null
  orchestratorAlive: boolean
  lastHeartbeat: number
  memoryUsage: number
  uptime: number
}

export interface Agent {
  id: string
  name: string
  platform: string
  status: "active" | "idle" | "dead"
  role: "orchestrator" | "executor"
  currentTask: string | null
  lastSeen: number
  registeredAt: number
}

export interface Task {
  id: string
  title: string
  status: "pending" | "in_progress" | "done" | "cancelled"
  assignee: string | null
  priority: "low" | "medium" | "high" | "critical"
  createdAt: number
}

export interface Message {
  id: string
  from: string
  to: string
  subject: string
  importance: "low" | "normal" | "high" | "urgent"
  ts: number
  acknowledged: boolean
}

export function useSwarmStats(repoPath?: string) {
  const url = repoPath 
    ? `${API_BASE}/api/stats?repoPath=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/api/stats`
  
  return useSWR<SwarmStats>(url, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  })
}

export function useAgents(repoPath?: string) {
  const url = repoPath 
    ? `${API_BASE}/api/agents?repoPath=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/api/agents`
  
  return useSWR<Agent[]>(url, fetcher, {
    refreshInterval: 5000,
  })
}

export function useTasks(repoPath?: string) {
  const url = repoPath 
    ? `${API_BASE}/api/tasks?repoPath=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/api/tasks`
  
  return useSWR<Task[]>(url, fetcher, {
    refreshInterval: 10000,
  })
}

export function useMessages(repoPath?: string) {
  const url = repoPath 
    ? `${API_BASE}/api/messages?repoPath=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/api/messages`
  
  return useSWR<Message[]>(url, fetcher, {
    refreshInterval: 5000,
  })
}

export function useHealth() {
  return useSWR<{ status: string; timestamp: number }>(
    `${API_BASE}/api/health`,
    fetcher,
    { refreshInterval: 30000 }
  )
}
