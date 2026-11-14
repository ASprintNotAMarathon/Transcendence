import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSocket } from './context'

const REJECTIONS: Record<string, string> = {
  'queue.already_queued': 'You are already looking for a match, maybe in another tab.',
  'queue.in_match': 'You are already in a match. Finish it first.',
  'queue.unknown_game': 'This game is not available yet.',
}

const FALLBACK = 'Something went wrong. Please try again.'

/*
  useMatchmaking. Find an opponent through the queue.

  While you are searching and the socket is connected, you are in the queue.
  Stop searching, leave the page or lose the connection and you leave it.
  After a reconnect the search starts again by itself.

  The server sends queue.matched to every open tab. The tab that is searching
  goes to the match. Any other tab keeps the match id, so it can offer Resume.
  On queue.rejected we show why and do not send queue.leave, because a search
  in another tab may still be running.
*/
export function useMatchmaking() {
  const { status, send, subscribe } = useSocket()
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resumeMatchId, setResumeMatchId] = useState<string | null>(null)
  const endedByServer = useRef(false)

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'queue.matched') {
        if (!searching) {
          setResumeMatchId(event.payload.matchId)
          return
        }
        endedByServer.current = true
        setSearching(false)
        navigate(`/match/${event.payload.matchId}`)
      } else if (event.type === 'queue.rejected') {
        if (searching) endedByServer.current = true
        setSearching(false)
        setError(REJECTIONS[event.payload.code] ?? FALLBACK)
      }
    })
  }, [subscribe, navigate, searching])

  useEffect(() => {
    if (!searching || status !== 'connected') return

    send({ type: 'queue.join', payload: { game: 'gomoku' } })

    return () => {
      if (!endedByServer.current) send({ type: 'queue.leave', payload: {} })
      endedByServer.current = false
    }
  }, [searching, status, send])

  const find = useCallback(() => {
    setError(null)
    setSearching(true)
  }, [])

  const cancel = useCallback(() => setSearching(false), [])

  return { searching, error, resumeMatchId, connected: status === 'connected', find, cancel }
}