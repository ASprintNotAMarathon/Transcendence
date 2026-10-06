// TEMP: short names for the rows `make seed` writes, so the demo URLs can be typed instead of pasted.

const SEEDED_PLAYERS: Record<string, string | undefined> = {
  ada: '11111111-1111-4111-8111-111111111111',
  linus: '22222222-2222-4222-8222-222222222222',
}

const DEMO_MATCH_ID = '33333333-3333-4333-8333-333333333333'

export function resolveMatchId(matchId: string | undefined): string | undefined {
  return matchId === 'demo' ? DEMO_MATCH_ID : matchId
}

const LAST_DEMO_PLAYER_KEY = 'lastDemoPlayer'

export function nextDemoPlayer(): string {
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_DEMO_PLAYER_KEY)
  } catch {
    // ignore
  }
  const next = last === 'ada' ? 'linus' : 'ada'
  try {
    localStorage.setItem(LAST_DEMO_PLAYER_KEY, next)
  } catch {
    // ignore
  }
  return next
}

const asked = new URLSearchParams(window.location.search).get('as') ?? ''

export const devUserId = SEEDED_PLAYERS[asked] ?? (asked === '' ? 'u1' : asked)
