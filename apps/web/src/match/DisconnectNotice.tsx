import { useEffect, useState } from 'react'

type DisconnectNoticeProps = {
  name: string
  deadline: string
}

const TICK_MS = 250

function timeLeft(deadline: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function DisconnectNotice({ name, deadline }: DisconnectNoticeProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <p className="text-center text-sm tabular-nums text-(--color-primary)">
      {name} lost connection
      <span aria-hidden="true"> · {timeLeft(deadline, now)}</span>
    </p>
  )
}

export default DisconnectNotice
