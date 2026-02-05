"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  Lock,
  Unlock,
  FileCode,
  Activity,
  DollarSign,
  Clock,
  User,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  GitBranch,
  Vote,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Zap
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useWebSocket, SwarmEvent } from "@/hooks/useWebSocket"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3334"
const REFRESH_INTERVAL = 30000

// ============ TYPES ============

interface FileLock {
  path: string
  agent: string
  exclusive: boolean
  ts: number
}

interface ActivityEvent {
  type: string
  ts: number
  agent?: string
  taskId?: string
  path?: string
  message?: string
  [key: string]: unknown
}

interface CostStats {
  configured: boolean
  limits: {
    daily: number
    weekly: number
    monthly: number
  }
  usage: {
    daily: number
    weekly: number
    monthly: number
  }
  byModel?: Record<string, number>
}

interface VotingProposal {
  id: string
  title: string
  type: string
  status: string
  proposedBy: string
  votes: number
}

// ============ HOOKS ============

function useAutoRefresh<T>(endpoint: string, interval = REFRESH_INTERVAL) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
      setError(null)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, interval)
    return () => clearInterval(timer)
  }, [fetchData, interval])

  return { data, loading, error, lastUpdate, refresh: fetchData }
}

// ============ MINI COMPONENTS ============

function LiveIndicator({ active = true }: { active?: boolean }) {
  if (!active) return null
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
    </span>
  )
}

function RefreshButton({ onRefresh, loading }: { onRefresh: () => void; loading?: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(ts).toLocaleDateString()
}

// ============ FILE LOCKS WIDGET ============

export function FileLocksWidget() {
  const { data, loading, refresh, lastUpdate } = useAutoRefresh<Record<string, FileLock>>("/api/locks", 10000)
  const { connected, lastEvent } = useWebSocket()

  // Real-time updates
  useEffect(() => {
    if (lastEvent?.kind === "file_locked" || lastEvent?.kind === "file_unlocked") {
      refresh()
    }
  }, [lastEvent, refresh])

  const locks = data ? Object.entries(data).map(([lockPath, lock]) => ({ ...lock, path: lockPath })) : []
  const exclusiveLocks = locks.filter(l => l.exclusive)
  const sharedLocks = locks.filter(l => !l.exclusive)

  if (loading) {
    return <WidgetSkeleton title="File Locks" />
  }

  if (locks.length === 0) {
    return (
      <Card className="border-dashed opacity-60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            File Locks
            <div className="flex items-center gap-1 ml-auto">
              {connected && <LiveIndicator />}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No active file locks</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-500/30 hover:border-orange-500/50 transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 text-orange-500" />
          File Locks
          <div className="flex items-center gap-1 ml-auto">
            <Badge variant="outline">{locks.length}</Badge>
            {connected && <LiveIndicator />}
            <RefreshButton onRefresh={refresh} />
          </div>
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>Active file reservations</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-red-500">{exclusiveLocks.length}</div>
            <div className="text-xs text-muted-foreground">Exclusive</div>
          </div>
          <div>
            <div className="text-xl font-bold text-yellow-500">{sharedLocks.length}</div>
            <div className="text-xs text-muted-foreground">Shared</div>
          </div>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {locks.slice(0, 5).map((lock) => (
            <div key={lock.path} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded">
              {lock.exclusive ? (
                <Lock className="w-3 h-3 text-red-500 flex-shrink-0" />
              ) : (
                <Unlock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-mono">{lock.path.split("/").pop()}</div>
                <div className="text-muted-foreground">
                  {lock.agent} • {formatTime(lock.ts)}
                </div>
              </div>
            </div>
          ))}
          {locks.length > 5 && (
            <div className="text-xs text-muted-foreground text-center">
              +{locks.length - 5} more locks
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============ ACTIVITY TIMELINE WIDGET ============

export function ActivityTimelineWidget() {
  const { connected, events } = useWebSocket()

  // Filter relevant events
  const relevantEvents = events.filter(e => 
    ["task_claimed", "task_released", "file_locked", "file_unlocked", 
     "leader_changed", "chat", "urgent_preemption", "pulse_update"].includes(e.kind)
  ).slice(-10).reverse()

  const getEventIcon = (kind: string) => {
    switch (kind) {
      case "task_claimed": return <CheckCircle2 className="w-3 h-3 text-green-500" />
      case "task_released": return <XCircle className="w-3 h-3 text-gray-500" />
      case "file_locked": return <Lock className="w-3 h-3 text-orange-500" />
      case "file_unlocked": return <Unlock className="w-3 h-3 text-blue-500" />
      case "leader_changed": return <Zap className="w-3 h-3 text-purple-500" />
      case "chat": return <MessageSquare className="w-3 h-3 text-blue-500" />
      case "urgent_preemption": return <AlertTriangle className="w-3 h-3 text-red-500" />
      case "pulse_update": return <Activity className="w-3 h-3 text-green-500" />
      default: return <Activity className="w-3 h-3 text-gray-500" />
    }
  }

  const getEventDescription = (event: SwarmEvent) => {
    switch (event.kind) {
      case "task_claimed": return `${event.agent} claimed task ${event.taskId}`
      case "task_released": return `${event.agent} released task ${event.taskId}`
      case "file_locked": return `${event.agent} locked ${(event.path as string)?.split("/").pop()}`
      case "file_unlocked": return `${event.agent} unlocked ${(event.path as string)?.split("/").pop()}`
      case "leader_changed": return `${event.agent} became orchestrator`
      case "chat": return `${event.channel}: ${(event.message as string)?.substring(0, 30)}...`
      case "urgent_preemption": return `Urgent: ${event.reason}`
      case "pulse_update": return `${event.agent} heartbeat`
      default: return event.kind
    }
  }

  return (
    <Card className="border-blue-500/30 hover:border-blue-500/50 transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Activity Timeline
          <div className="flex items-center gap-1 ml-auto">
            {connected && <LiveIndicator />}
            <Badge variant={connected ? "success" : "destructive"}>
              {connected ? "LIVE" : "OFFLINE"}
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>Real-time swarm events</CardDescription>
      </CardHeader>
      <CardContent>
        {relevantEvents.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            {connected ? "Waiting for events..." : "Connect to Hub to see events"}
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {relevantEvents.map((event, i) => (
              <div key={`${event.ts}-${i}`} className="flex items-start gap-2 text-xs">
                <div className="mt-0.5">{getEventIcon(event.kind)}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{getEventDescription(event)}</div>
                  <div className="text-muted-foreground">{formatTime(event.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ COST TRACKING WIDGET ============

export function CostTrackingWidget() {
  const { data, loading, refresh } = useAutoRefresh<CostStats>("/api/budget")

  if (loading) {
    return <WidgetSkeleton title="Cost Tracking" />
  }

  if (!data?.configured) {
    return (
      <Card className="border-dashed opacity-60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            Cost Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Budget not configured</p>
        </CardContent>
      </Card>
    )
  }

  const dailyPercent = (data.usage.daily / data.limits.daily) * 100
  const weeklyPercent = (data.usage.weekly / data.limits.weekly) * 100
  const monthlyPercent = (data.usage.monthly / data.limits.monthly) * 100

  const getStatusColor = (percent: number) => {
    if (percent >= 90) return "text-red-500"
    if (percent >= 70) return "text-yellow-500"
    return "text-green-500"
  }

  return (
    <Card className="border-emerald-500/30 hover:border-emerald-500/50 transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-500" />
          Cost Tracking
          <div className="flex items-center gap-1 ml-auto">
            <RefreshButton onRefresh={refresh} />
          </div>
        </CardTitle>
        <CardDescription>API usage and budget</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Daily</span>
              <span className={getStatusColor(dailyPercent)}>
                ${data.usage.daily.toFixed(2)} / ${data.limits.daily}
              </span>
            </div>
            <Progress value={Math.min(dailyPercent, 100)} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Weekly</span>
              <span className={getStatusColor(weeklyPercent)}>
                ${data.usage.weekly.toFixed(2)} / ${data.limits.weekly}
              </span>
            </div>
            <Progress value={Math.min(weeklyPercent, 100)} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Monthly</span>
              <span className={getStatusColor(monthlyPercent)}>
                ${data.usage.monthly.toFixed(2)} / ${data.limits.monthly}
              </span>
            </div>
            <Progress value={Math.min(monthlyPercent, 100)} className="h-2" />
          </div>
        </div>

        {data.byModel && Object.keys(data.byModel).length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">By Model</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(data.byModel).slice(0, 4).map(([model, cost]) => (
                <div key={model} className="flex justify-between">
                  <span className="truncate">{model.split("/").pop()}</span>
                  <span className="text-muted-foreground">${cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ VOTING WIDGET ============

export function VotingWidget() {
  const { data, loading, refresh } = useAutoRefresh<{
    configured: boolean
    cluster?: {
      totalNodes: number
      activeNodes: number
      hasQuorum: boolean
    }
    proposals?: {
      total: number
      pending: number
      approved: number
      rejected: number
    }
    recentProposals?: VotingProposal[]
  }>("/api/consensus")

  if (loading) {
    return <WidgetSkeleton title="Voting & Proposals" />
  }

  if (!data?.configured) {
    return (
      <Card className="border-dashed opacity-60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Vote className="w-4 h-4 text-muted-foreground" />
            Voting & Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Consensus not initialized</p>
        </CardContent>
      </Card>
    )
  }

  const { cluster, proposals, recentProposals } = data

  return (
    <Card className="border-violet-500/30 hover:border-violet-500/50 transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Vote className="w-4 h-4 text-violet-500" />
          Voting & Proposals
          <div className="flex items-center gap-1 ml-auto">
            {cluster?.hasQuorum && <LiveIndicator />}
            <Badge variant={cluster?.hasQuorum ? "success" : "warning"}>
              {cluster?.activeNodes}/{cluster?.totalNodes} nodes
            </Badge>
            <RefreshButton onRefresh={refresh} />
          </div>
        </CardTitle>
        <CardDescription>Distributed consensus</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-yellow-500/10 rounded">
            <div className="text-lg font-bold text-yellow-500">{proposals?.pending || 0}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="p-2 bg-green-500/10 rounded">
            <div className="text-lg font-bold text-green-500">{proposals?.approved || 0}</div>
            <div className="text-xs text-muted-foreground">Approved</div>
          </div>
          <div className="p-2 bg-red-500/10 rounded">
            <div className="text-lg font-bold text-red-500">{proposals?.rejected || 0}</div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </div>
        </div>

        {recentProposals && recentProposals.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Recent Proposals</div>
            {recentProposals.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded">
                <Badge variant={
                  p.status === "approved" ? "success" :
                  p.status === "rejected" ? "destructive" :
                  "secondary"
                } className="text-[10px]">
                  {p.status}
                </Badge>
                <span className="truncate flex-1">{p.title}</span>
                <span className="text-muted-foreground">{p.votes} votes</span>
              </div>
            ))}
          </div>
        )}

        {!cluster?.hasQuorum && (
          <div className="flex items-center gap-2 text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded">
            <AlertTriangle className="w-4 h-4" />
            <span>Quorum not reached</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ CONNECTION STATUS WIDGET ============

export function ConnectionStatusWidget() {
  const { connected, connecting, error, reconnect } = useWebSocket()

  return (
    <Card className={cn(
      "transition-all",
      connected ? "border-green-500/30" : "border-red-500/30"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className={cn(
            "w-4 h-4",
            connected ? "text-green-500" : "text-red-500"
          )} />
          Hub Connection
          <div className="flex items-center gap-1 ml-auto">
            {connected && <LiveIndicator />}
            <Badge variant={connected ? "success" : connecting ? "warning" : "destructive"}>
              {connected ? "CONNECTED" : connecting ? "CONNECTING" : "DISCONNECTED"}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-red-500">{error}</span>
            <Button variant="outline" size="sm" onClick={reconnect}>
              Reconnect
            </Button>
          </div>
        )}
        {connected && (
          <p className="text-xs text-muted-foreground">
            Real-time updates active
          </p>
        )}
        {connecting && (
          <p className="text-xs text-muted-foreground">
            Establishing connection...
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ============ HELPER COMPONENTS ============

function WidgetSkeleton({ title }: { title: string }) {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-4 h-4 bg-muted rounded" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-12 bg-muted rounded" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </CardContent>
    </Card>
  )
}
