import { useEffect, useState } from 'react'
import { useSocket } from './context'

/*
  useOnlineStatus. Which of your friends are online right now.

  Asks the server for the list as soon as the socket is connected (and again
  after a reconnect), then keeps it up to date with presence.online and
  presence.offline. The server only tells us about our friends.

  Returns null until the server has answered, so a screen can show its own
  fallback in the meantime.
*/
export function useOnlineStatus(): ReadonlySet<string> | null {
  const { status, send, subscribe } = useSocket()
  const [online, setOnline] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'presence.state') {
        setOnline(new Set(event.payload.users.map((user) => user.userId)))
      } else if (event.type === 'presence.online') {
        setOnline((current) => new Set(current).add(event.payload.user.userId))
      } else if (event.type === 'presence.offline') {
        setOnline((current) => {
          const next = new Set(current)
          next.delete(event.payload.userId)
          return next
        })
      }
    })
  }, [subscribe])

  useEffect(() => {
    if (status === 'connected') send({ type: 'presence.list', payload: {} })
  }, [status, send])

  return online
}