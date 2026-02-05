"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export type SwarmEventType = 
  | "leader_changed"
  | "task_claimed"
  | "task_released"
  | "file_locked"
  | "file_unlocked"
  | "task_announced"
  | "task_bid"
  | "auction_resolved"
  | "policy_update"
  | "chat"
  | "agent_frozen"
  | "agent_unfrozen"
  | "pulse_update"
  | "urgent_preemption"
  | "urgent_resolved"
  | "knowledge_added"
  | "swarm_stopped"
  | "swarm_resumed"

export interface SwarmEvent {
  kind: SwarmEventType
  ts: number
  [key: string]: unknown
}

interface UseWebSocketOptions {
  url?: string
  project?: string
  agent?: string
  onEvent?: (event: SwarmEvent) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface UseWebSocketReturn {
  connected: boolean
  connecting: boolean
  error: string | null
  lastEvent: SwarmEvent | null
  events: SwarmEvent[]
  send: (message: object) => void
  reconnect: () => void
}

const DEFAULT_HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "wss://mcp-swarm-hub.unilife-ch.workers.dev"
const MAX_EVENTS = 100

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = DEFAULT_HUB_URL,
    project = "default",
    agent = "dashboard",
    onEvent,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options

  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<SwarmEvent | null>(null)
  const [events, setEvents] = useState<SwarmEvent[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (connecting) return

    cleanup()
    setConnecting(true)
    setError(null)

    try {
      const wsUrl = `${url}/ws?project=${encodeURIComponent(project)}&agent=${encodeURIComponent(agent)}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setConnecting(false)
        setError(null)
        reconnectAttemptsRef.current = 0

        // Send ping every 25 seconds to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ kind: "ping" }))
          }
        }, 25000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SwarmEvent
          
          // Ignore pong messages
          if (data.kind === "pong" as unknown) return
          
          setLastEvent(data)
          setEvents(prev => {
            const next = [...prev, data]
            return next.slice(-MAX_EVENTS)
          })
          
          onEvent?.(data)
        } catch {
          // Ignore parse errors
        }
      }

      ws.onerror = () => {
        setError("WebSocket connection error")
        setConnecting(false)
      }

      ws.onclose = () => {
        setConnected(false)
        setConnecting(false)
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Auto-reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval * reconnectAttemptsRef.current)
        } else {
          setError("Max reconnection attempts reached")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
      setConnecting(false)
    }
  }, [url, project, agent, onEvent, reconnectInterval, maxReconnectAttempts, cleanup, connecting])

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    cleanup()
    connect()
  }, [cleanup, connect])

  // Connect on mount
  useEffect(() => {
    connect()
    return cleanup
  }, [connect, cleanup])

  return {
    connected,
    connecting,
    error,
    lastEvent,
    events,
    send,
    reconnect
  }
}

// Hook for subscribing to specific event types
export function useSwarmEvents(
  eventTypes: SwarmEventType[],
  callback: (event: SwarmEvent) => void,
  options: UseWebSocketOptions = {}
) {
  const handleEvent = useCallback((event: SwarmEvent) => {
    if (eventTypes.includes(event.kind)) {
      callback(event)
    }
  }, [eventTypes, callback])

  return useWebSocket({
    ...options,
    onEvent: handleEvent
  })
}
