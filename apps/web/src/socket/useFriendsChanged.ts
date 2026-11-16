import { useEffect, useRef, useState } from 'react'
import { useSocket } from './context'

/*
  useFriendsChanged. A number that goes up whenever your friend data may be
  stale: the server sent friends.changed, or the socket came back after a drop
  (anything sent meanwhile is lost). Put it in an effect's dependencies to
  load again.
*/
export function useFriendsChanged(): number {
  const { status, subscribe } = useSocket()
  const [changes, setChanges] = useState(0)
  const previousStatus = useRef(status)

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'friends.changed') setChanges((count) => count + 1)
    })
  }, [subscribe])

  useEffect(() => {
    if (status === 'connected' && previousStatus.current !== 'connected') {
      setChanges((count) => count + 1)
    }
    previousStatus.current = status
  }, [status])

  return changes
}
