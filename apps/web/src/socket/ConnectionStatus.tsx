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
    <span className="badge badge-warning gap-1 text-xs">
      {LABEL[status]}
    </span>
  )
}