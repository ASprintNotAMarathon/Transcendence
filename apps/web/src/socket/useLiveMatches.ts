import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveMatch, ServerEvent } from '@transcendence/shared'
import { matchApi } from '../lib/api'
import { joinLobby, leaveLobby } from '../lib/protocol'
import { useSocket } from './context'

/*
  useLiveMatches. Every running match, kept up to date.

  Loads GET /match/live, then follows lobby.started, lobby.moved and
  lobby.ended. Events that arrive while a load is in flight are held and
  applied on top of its result, so none fall in the gap. After a reconnect it
  loads again, since anything sent while the socket was down is gone.
*/

type LobbyEvent = Extract<
  ServerEvent,
  { type: 'lobby.started' | 'lobby.moved' | 'lobby.ended' }
>

export type LiveMatches =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; live: LiveMatch[] }

function isLobbyEvent(event: ServerEvent): event is LobbyEvent {
  return (
    event.type === 'lobby.started' ||
    event.type === 'lobby.moved' ||
    event.type === 'lobby.ended'
  )
}

function apply(live: LiveMatch[], event: LobbyEvent): LiveMatch[] {
  switch (event.type) {
    case 'lobby.started':
      if (live.some((match) => match.matchId === event.payload.matchId)) return live
      return [event.payload, ...live]
    case 'lobby.moved': {
      const { matchId, moveNumber, turn } = event.payload
      return live.map((match) =>
        match.matchId === matchId && moveNumber > match.moveNumber
          ? { ...match, moveNumber, turn }
          : match,
      )
    }
    case 'lobby.ended':
      return live.filter((match) => match.matchId !== event.payload.matchId)
  }
}

export function useLiveMatches(): { lobby: LiveMatches; retry: () => void } {
  const { status, join, leave, subscribe } = useSocket()
  const [lobby, setLobby] = useState<LiveMatches>({ status: 'loading' })
  const [load, setLoad] = useState(0)
  const held = useRef<LobbyEvent[] | null>(null)
  const previousStatus = useRef(status)

  useEffect(() => {
    join('lobby', joinLobby())

    const unsubscribe = subscribe((event) => {
      if (!isLobbyEvent(event)) return
      if (held.current !== null) {
        held.current.push(event)
        return
      }
      setLobby((current) =>
        current.status === 'loaded' ? { ...current, live: apply(current.live, event) } : current,
      )
    })

    return () => {
      unsubscribe()
      leave('lobby', leaveLobby())
    }
  }, [join, leave, subscribe])

  useEffect(() => {
    let cancelled = false
    held.current = []

    matchApi
      .live()
      .then((live) => {
        if (cancelled) return
        const missed = held.current ?? []
        held.current = null
        setLobby({ status: 'loaded', live: missed.reduce(apply, live) })
      })
      .catch(() => {
        if (cancelled) return
        held.current = null
        setLobby({ status: 'failed' })
      })

    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    if (status === 'connected' && previousStatus.current !== 'connected') {
      setLoad((count) => count + 1)
    }
    previousStatus.current = status
  }, [status])

  const retry = useCallback(() => {
    setLobby({ status: 'loading' })
    setLoad((count) => count + 1)
  }, [])

  return { lobby, retry }
}
