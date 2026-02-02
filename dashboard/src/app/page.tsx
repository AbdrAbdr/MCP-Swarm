"use client"

import { useState, useEffect } from "react"
import { 
  Activity, 
  Users, 
  CheckSquare, 
  MessageSquare, 
  Cpu, 
  Zap,
  Crown,
  Clock,
  AlertTriangle,
  RefreshCw,
  Settings,
  FileCode,
  GitBranch
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatRelativeTime, getStatusColor, cn } from "@/lib/utils"

// Типы данных
interface Agent {
  id: string
  name: string
  platform: string
  status: "active" | "idle" | "dead"
  role: "orchestrator" | "executor"
  currentTask: string | null
  lastSeen: number
  registeredAt: number
}

interface Task {
  id: string
  title: string
  status: "pending" | "in_progress" | "done" | "cancelled"
  assignee: string | null
  priority: "low" | "medium" | "high" | "critical"
  createdAt: number
}

interface Message {
  id: string
  from: string
  to: string
  subject: string
  importance: "low" | "normal" | "high" | "urgent"
  ts: number
  acknowledged: boolean
}

interface SwarmStats {
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

// Демо данные для разработки
const DEMO_STATS: SwarmStats = {
  totalAgents: 5,
  activeAgents: 4,
  deadAgents: 1,
  totalTasks: 24,
  pendingTasks: 8,
  completedTasks: 14,
  totalMessages: 156,
  unreadMessages: 3,
  orchestratorName: "RadiantWolf",
  orchestratorAlive: true,
  lastHeartbeat: Date.now() - 5000,
  memoryUsage: 67,
  uptime: 3600000 * 5 + 1800000
}

const DEMO_AGENTS: Agent[] = [
  { id: "1", name: "RadiantWolf", platform: "Claude Desktop", status: "active", role: "orchestrator", currentTask: "Координация задач", lastSeen: Date.now() - 5000, registeredAt: Date.now() - 18000000 },
  { id: "2", name: "SilentFox", platform: "Cursor", status: "active", role: "executor", currentTask: "Рефакторинг API", lastSeen: Date.now() - 15000, registeredAt: Date.now() - 14400000 },
  { id: "3", name: "SwiftEagle", platform: "Windsurf", status: "active", role: "executor", currentTask: "Написание тестов", lastSeen: Date.now() - 8000, registeredAt: Date.now() - 10800000 },
  { id: "4", name: "BrightOwl", platform: "OpenCode", status: "idle", role: "executor", currentTask: null, lastSeen: Date.now() - 45000, registeredAt: Date.now() - 7200000 },
  { id: "5", name: "QuietRaven", platform: "VS Code", status: "dead", role: "executor", currentTask: null, lastSeen: Date.now() - 120000, registeredAt: Date.now() - 3600000 },
]

const DEMO_TASKS: Task[] = [
  { id: "t1", title: "Добавить аутентификацию", status: "in_progress", assignee: "SilentFox", priority: "high", createdAt: Date.now() - 7200000 },
  { id: "t2", title: "Написать unit-тесты", status: "in_progress", assignee: "SwiftEagle", priority: "medium", createdAt: Date.now() - 3600000 },
  { id: "t3", title: "Оптимизировать запросы", status: "pending", assignee: null, priority: "medium", createdAt: Date.now() - 1800000 },
  { id: "t4", title: "Исправить баг #123", status: "pending", assignee: null, priority: "critical", createdAt: Date.now() - 900000 },
  { id: "t5", title: "Документация API", status: "done", assignee: "BrightOwl", priority: "low", createdAt: Date.now() - 86400000 },
]

const DEMO_MESSAGES: Message[] = [
  { id: "m1", from: "RadiantWolf", to: "*", subject: "Новый план работ", importance: "high", ts: Date.now() - 300000, acknowledged: false },
  { id: "m2", from: "SilentFox", to: "RadiantWolf", subject: "API готов к ревью", importance: "normal", ts: Date.now() - 600000, acknowledged: true },
  { id: "m3", from: "SwiftEagle", to: "*", subject: "Тесты проходят", importance: "normal", ts: Date.now() - 900000, acknowledged: true },
]

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = "primary"
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; positive: boolean }
  color?: "primary" | "success" | "warning" | "danger"
}) {
  const colorClasses = {
    primary: "text-primary glow-primary",
    success: "text-green-500 glow-success",
    warning: "text-yellow-500 glow-warning",
    danger: "text-red-500 glow-danger"
  }
  
  return (
    <Card className="hover:border-primary/50 transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-5 w-5", colorClasses[color])} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            "text-xs mt-1 flex items-center gap-1",
            trend.positive ? "text-green-500" : "text-red-500"
          )}>
            <span>{trend.positive ? "↑" : "↓"}</span>
            <span>{Math.abs(trend.value)}% за час</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border bg-card/50 hover:bg-card transition-all",
      agent.role === "orchestrator" && "border-primary/50 glow-primary"
    )}>
      <div className="relative">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
          agent.status === "active" ? "bg-green-500/20 text-green-500" :
          agent.status === "idle" ? "bg-yellow-500/20 text-yellow-500" :
          "bg-red-500/20 text-red-500"
        )}>
          {agent.name.slice(0, 2)}
        </div>
        <div className={cn(
          "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background",
          getStatusColor(agent.status)
        )} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{agent.name}</span>
          {agent.role === "orchestrator" && (
            <Crown className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {agent.platform}
        </div>
        {agent.currentTask && (
          <div className="text-xs text-muted-foreground truncate mt-1">
            → {agent.currentTask}
          </div>
        )}
      </div>
      
      <div className="text-right">
        <Badge variant={
          agent.status === "active" ? "success" :
          agent.status === "idle" ? "warning" :
          "destructive"
        }>
          {agent.status === "active" ? "Активен" :
           agent.status === "idle" ? "Ожидает" :
           "Мёртв"}
        </Badge>
        <div className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(agent.lastSeen)}
        </div>
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const priorityColors = {
    low: "bg-gray-500",
    medium: "bg-blue-500",
    high: "bg-yellow-500",
    critical: "bg-red-500 animate-pulse"
  }
  
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div className={cn("w-2 h-2 rounded-full", priorityColors[task.priority])} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{task.title}</div>
        <div className="text-xs text-muted-foreground">
          {task.assignee || "Не назначено"}
        </div>
      </div>
      <Badge variant={
        task.status === "done" ? "success" :
        task.status === "in_progress" ? "default" :
        task.status === "cancelled" ? "destructive" :
        "secondary"
      }>
        {task.status === "done" ? "Готово" :
         task.status === "in_progress" ? "В работе" :
         task.status === "cancelled" ? "Отменено" :
         "Ожидает"}
      </Badge>
    </div>
  )
}

function MessageRow({ message }: { message: Message }) {
  return (
    <div className={cn(
      "flex items-center gap-3 py-3 border-b border-border/50 last:border-0",
      !message.acknowledged && "bg-primary/5"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        message.importance === "urgent" ? "bg-red-500 animate-pulse" :
        message.importance === "high" ? "bg-yellow-500" :
        "bg-gray-500"
      )} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{message.subject}</div>
        <div className="text-xs text-muted-foreground">
          {message.from} → {message.to === "*" ? "Все" : message.to}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {formatRelativeTime(message.ts)}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<SwarmStats>(DEMO_STATS)
  const [agents, setAgents] = useState<Agent[]>(DEMO_AGENTS)
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS)
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  
  // Auto-refresh каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now())
      // TODO: Fetch real data from API
    }, 5000)
    return () => clearInterval(interval)
  }, [])
  
  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}ч ${minutes}м`
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            MCP Swarm Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Центр управления AI-агентами
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Обновлено: {formatRelativeTime(lastUpdate)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setLastUpdate(Date.now())}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Orchestrator Status Banner */}
      {stats.orchestratorName && (
        <Card className={cn(
          "border-primary/50",
          stats.orchestratorAlive ? "glow-primary" : "border-red-500 glow-danger"
        )}>
          <CardContent className="flex items-center gap-4 py-4">
            <Crown className={cn(
              "w-8 h-8",
              stats.orchestratorAlive ? "text-primary" : "text-red-500"
            )} />
            <div className="flex-1">
              <div className="font-semibold text-lg">
                Оркестратор: {stats.orchestratorName}
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.orchestratorAlive ? (
                  <>Активен • Heartbeat: {formatRelativeTime(stats.lastHeartbeat)}</>
                ) : (
                  <span className="text-red-500">⚠️ Оркестратор не отвечает!</span>
                )}
              </div>
            </div>
            <Badge variant={stats.orchestratorAlive ? "success" : "destructive"}>
              {stats.orchestratorAlive ? "ONLINE" : "OFFLINE"}
            </Badge>
          </CardContent>
        </Card>
      )}
      
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Агенты"
          value={`${stats.activeAgents}/${stats.totalAgents}`}
          subtitle={`${stats.deadAgents} мёртвых`}
          icon={Users}
          color={stats.deadAgents > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Задачи"
          value={stats.pendingTasks}
          subtitle={`${stats.completedTasks} выполнено`}
          icon={CheckSquare}
          color="primary"
        />
        <StatCard
          title="Сообщения"
          value={stats.unreadMessages}
          subtitle={`${stats.totalMessages} всего`}
          icon={MessageSquare}
          color={stats.unreadMessages > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Uptime"
          value={formatUptime(stats.uptime)}
          subtitle="Время работы"
          icon={Clock}
          color="success"
        />
      </div>
      
      {/* System Resources */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Ресурсы системы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Память</span>
              <span>{stats.memoryUsage}%</span>
            </div>
            <Progress value={stats.memoryUsage} />
          </div>
        </CardContent>
      </Card>
      
      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Агенты
            </CardTitle>
            <CardDescription>
              Активные AI-помощники в системе
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </CardContent>
        </Card>
        
        {/* Tasks & Messages */}
        <div className="space-y-6">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                Задачи
              </CardTitle>
              <CardDescription>
                Активные и ожидающие задачи
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} />
              ))}
            </CardContent>
          </Card>
          
          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Сообщения
              </CardTitle>
              <CardDescription>
                Последние сообщения между агентами
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.map(message => (
                <MessageRow key={message.id} message={message} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground pt-4 border-t">
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <GitBranch className="w-4 h-4" />
            MCP Swarm v0.9.1
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <FileCode className="w-4 h-4" />
            41 Smart Tools
          </span>
          <span>•</span>
          <a href="https://github.com/AbdrAbdr/Swarm_MCP" className="hover:text-primary transition-colors">
            GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
