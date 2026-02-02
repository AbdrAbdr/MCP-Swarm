import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  
  if (diff < 60000) return 'только что'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`
  return `${Math.floor(diff / 86400000)} дн назад`
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-500'
    case 'idle': return 'bg-yellow-500'
    case 'dead': return 'bg-red-500'
    case 'done': return 'bg-green-500'
    case 'in_progress': return 'bg-blue-500'
    case 'pending': return 'bg-gray-500'
    default: return 'bg-gray-500'
  }
}
