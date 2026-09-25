/*
 * TEMP: short names for the rows `make seed` writes, so the demo URLs can be
 * typed instead of pasted.
 *
 *   /match/demo?as=ada
 *   /match/demo?as=linus
 *
 * Both halves are only aliases. A real id in either place still works and is
 * not translated, so nothing here is load-bearing: deleting this file leaves
 * the long URLs working exactly as before.
 *
 * Goes with WS_DEV_AUTH and `make seed` once #21 lands and something in the app
 * can create a match.
 */

/** The ids in apps/api/prisma/seed.sql. Changing one means changing both. */
const SEEDED_PLAYERS: Record<string, string | undefined> = {
  ada: '11111111-1111-4111-8111-111111111111',
  linus: '22222222-2222-4222-8222-222222222222',
}

const DEMO_MATCH_ID = '33333333-3333-4333-8333-333333333333'

/** 'demo' is the seeded match. Every other id is passed through untouched. */
export function resolveMatchId(matchId: string | undefined): string | undefined {
  return matchId === 'demo' ? DEMO_MATCH_ID : matchId
}

// Read once, when the app loads, rather than on every render: the stones switch
// rewrites the query string, and a tab that changed identity halfway through a
// match would be worse than one that keeps the id it started with.
const asked = new URLSearchParams(window.location.search).get('as') ?? ''

/*
 * Who this tab plays as.
 *
 * The socket sends this to the api, which believes it while WS_DEV_AUTH is on,
 * and MatchPage compares it against the two players to decide whether the board
 * may be clicked. Both read this one value, or a tab would be playing as one
 * person and drawing as another.
 *
 * Without ?as= it stays 'u1', which is nobody in the database: such a tab can
 * watch a match, and no move from it would be accepted.
 */
export const devUserId = SEEDED_PLAYERS[asked] ?? (asked === '' ? 'u1' : asked)
