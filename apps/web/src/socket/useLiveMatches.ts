import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveMatch, ServerEvent } from '@transcendence/shared'
import { matchApi } from '../lib/api'
import { joinLobby, leaveLobby } from '../lib/protocol'
import { useSocket } from './context'

/*
  useLiveMatches. Every running match, kept up to date.

  Joins the lobby room and loads GET /match/live only once the server confirms
  the join, so nothing can change between the load and the first event. Events
  that arrive while a load is in flight are held and applied on top of its
  result. A reconnect joins again, and so loads again.
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
  const { join, leave, subscribe } = useSocket()
  const [lobby, setLobby] = useState<LiveMatches>({ status: 'loading' })
  const [load, setLoad] = useState(0)
  const held = useRef<LobbyEvent[] | null>([])

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'lobby.joined') {
        held.current = []
        setLoad((count) => count + 1)
        return
      }
      if (!isLobbyEvent(event)) return
      if (held.current !== null) {
        held.current.push(event)
        return
      }
      setLobby((current) =>
        current.status === 'loaded' ? { ...current, live: apply(current.live, event) } : current,
      )
    })
    join('lobby', joinLobby())

    return () => {
      unsubscribe()
      leave('lobby', leaveLobby())
    }
  }, [join, leave, subscribe])

  useEffect(() => {
    if (load === 0) return
    let cancelled = false

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

  const retry = useCallback(() => {
    held.current = []
    setLobby({ status: 'loading' })
    setLoad((count) => count + 1)
  }, [])

  return { lobby, retry }
}
