import { useSocket } from './context'
import type { ConnectionStatus as Status } from '../lib/socket'

const LABEL: Record<Status, string> = {
  connected: '', // never rendered, see null return below
  reconnecting: "You're reconnecting…",
  disconnected: "You're offline",
}

export function ConnectionStatus() {
  const { status } = useSocket()

  if (status === 'connected') {
    return null
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-(--color-primary)">
      <span className="h-1.5 w-1.5 rounded-full bg-(--color-primary)" />
      {LABEL[status]}
    </span>
  )
}