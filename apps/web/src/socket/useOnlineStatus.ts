import { useEffect, useMemo, useState } from 'react'
import type { PresenceUser } from '@transcendence/shared'
import { useSocket } from './context'

/*
  Who is online right now.

  useOnlinePlayers gives the whole list, for the lobby. useOnlineStatus gives
  only the ids, for screens that just need a dot next to a name.

  Both ask the server as soon as the socket is connected (and again after a
  reconnect), then keep up with presence.online and presence.offline. They
  return null until the server has answered, so a screen can show a loading
  state.
*/
export function useOnlinePlayers(): PresenceUser[] | null {
	const { status, send, subscribe } = useSocket()
	const [players, setPlayers] = useState<ReadonlyMap<string, PresenceUser> | null>(null)

	useEffect(() => {
		return subscribe((event) => {
			if (event.type === 'presence.state') {
				setPlayers(new Map(event.payload.users.map((user) => [user.userId, user])))
			} else if (event.type === 'presence.online') {
				const { user } = event.payload
				setPlayers((current) => (current === null ? current : new Map(current).set(user.userId, user)))
			} else if (event.type === 'presence.offline') {
				const { userId } = event.payload
				setPlayers((current) => {
					if (current === null) return current
					const next = new Map(current)
					next.delete(userId)
					return next
				})
			}
		})
	}, [subscribe])

	useEffect(() => {
		if (status === 'connected') send({ type: 'presence.list', payload: {} })
	}, [status, send])

	return useMemo(() => {
		if (players === null) return null
		return Array.from(players.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
	}, [players])
}

export function useOnlineStatus(): ReadonlySet<string> | null {
	const players = useOnlinePlayers()

	return useMemo(() => {
		if (players === null) return null
		return new Set(players.map((player) => player.userId))
	}, [players])
}