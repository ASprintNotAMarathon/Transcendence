# Code notes

The comments that used to live in these files, moved here so the code reads on its own.
Each note gives the line it belongs to and the declaration it describes.
Line numbers match the files as of the commit that moved them, and will drift as the code changes;
the declaration is the part that stays true.
TEMP and TODO markers stay in the code, so temporary work is still visible where it lives.

## `Makefile`

### Line 34 · `@vols=$$($(COMPOSE) ps -aq | xargs -r docker inspect \`

Anonymous volumes are the node_modules holes, one set per container generation, cca 370MB each.
They get orphaned by `down` and are never reused.

### Line 67 · `$(DEPS): package.json package-lock.json`

A file target, like .env: make reinstalls only when one of the manifests is newer than node_modules/.package-lock.json.
So `make test` on an up-to-date clone skips the install, but still works on a fresh one.
npm writes that file only when an install finishes, so a failed `npm ci` leaves it missing and the next make tries again.
node_modules/ itself can't be the target: npm ci updates its timestamp even when it fails halfway, and make would then skip every retry.

## `apps/api/prisma/schema.prisma`

### Line 55 · `enum EndReason {`

Why a finished match ended: `board` when the engine decided it (five in a row, a full board),
`resigned` when a player gave up. `abandoned` is for #4, where a player who stays disconnected loses;
it exists already so that issue needs no migration.

### Line 80 · `endReason EndReason?`

Inside `model Match`

Set together with status = finished and winnerId, and null while the match is running.
A resignation isn't a move, so unlike the board it can't be rebuilt from the Move rows and has to be stored.

## `apps/api/src/app.service.ts`

### Line 10 · `availableGames(): string[]`

Inside `@Injectable() export class AppService`

The games that can actually be played, which is narrower than the games the schema knows about:
GameName lists reversi, but no engine implements it yet.
Derived from the registry in @transcendence/shared,
so adding an engine is the only thing needed to make it appear here.

## `apps/api/src/match/match.controller.ts`

### Line 1 · file header

The HTTP side of matches: what the lobby and the Match button ask before any socket is involved.
Playing, watching and resigning stay on the socket; this only answers "what is being played?"
and "where is my game?". Like MatchHandlers it holds no logic: everything is in MatchService.

### Line 7 · `@Controller('matches')`

With the global 'api' prefix from main.ts, the routes below are /api/matches/live and /api/matches/current.

### Line 8 · `@UseGuards(JwtAuthGuard)`

On the class, so it covers every route in it, including any added later.
No cookie, or a bad one, answers 401 before the method runs.
The lobby is only for logged-in players, and current needs to know who is asking anyway.

### Line 13 · `live(): Promise<LiveMatch[]>`

Inside `export class MatchController`

Every live match, the caller's own included. The lobby is the one that moves yours to the top,
so this list means the same thing whoever asks.

### Line 18 · `async current(`

Inside `export class MatchController`

The caller's newest live match, or 204 when they have none.
204 rather than 200 with null: "nothing here" is a normal answer, not a failure,
and request() in the web app already turns a 204 into undefined.

### Line 20 · `@Res({ passthrough: true }) res: Response,`

Inside `async current(…)`

Only to change the status code. passthrough keeps Nest in charge of sending the response,
so the returned value is still what goes out; without it, the method would have to send everything itself.

### Line 24 · `res.status(HttpStatus.NO_CONTENT);`

Inside `async current(…)`

Sets the code and returns nothing. A 204 carries no body, so there is nothing else to send.

## `apps/api/src/match/match.error.ts`

### Line 3 · `export class MatchError extends Error`

A failure the player caused, as opposed to one the server did.

A MatchError carries a code from the shared protocol,
and the gateway turns it into a `match.rejected` sent to that player alone.

Anything else thrown out of MatchService is a server fault:
a corrupt history from replay(), a match created for a game with no engine.
Those belong in a log and a 500, because there is nothing the client could usefully do with them.

Deliberately not a Nest HttpException. This service is reached over a socket,
where failures are described by MatchErrorCode rather than status codes, and
borrowing HTTP semantics here would only have to be unpicked in the gateway.

## `apps/api/src/match/match.handlers.ts`

### Line 10 · `@Injectable() export class MatchHandlers implements OnModuleInit`

Where match messages leave the socket layer and reach MatchService.

Every decision about a match is made in the service;
this class only knows who is asking,
which room a match lives in,
and who should hear the answer.

The user id is always `client.data.userId`, set by the handshake.
The payload is never read for it, even if a client puts one there.

### Line 24 · `join: WsHandler<'match.join'> = async (client, event) =>`

Inside `@Injectable() export class MatchHandlers implements OnModuleInit`

Subscribe to a match and receive its full snapshot.

The room is joined before the snapshot is read, never after. The other
way round, a move landing between the read and the join would reach
neither: too late for the snapshot, too early for the room. This order
can at worst deliver a match.moved the snapshot already contains, which
the client drops by its moveNumber.

### Line 37 · `await client.leave(room);`

Inside `join: WsHandler<'match.join'> = async (client, event) =>`

A refused join must not leave the socket in the room, or a
mistyped id would keep a subscription to a match nobody sees.

### Line 42 · `move: WsHandler<'match.move'> = async (client, event) =>`

Inside `@Injectable() export class MatchHandlers implements OnModuleInit`

Play a move. The sender hears a refusal; the room hears a success.

The service has already stored the move by the time it returns, so a
broadcast can never announce a move the database does not have.
No cid on the broadcast: it answers nobody in particular, and the sender
recognises its own move by `by` and `moveNumber` like everyone else.

### Line 62 · `leave: WsHandler<'match.leave'> = async (client, event) =>`

Inside `@Injectable() export class MatchHandlers implements OnModuleInit`

Stop receiving updates. Not a resignation, and nothing to reply.

### Line 66 · `private rejectOrRethrow( client: WsSocket, cid: string | undefined, matchId: string, error: unknown, ): void`

Inside `@Injectable() export class MatchHandlers implements OnModuleInit`

A MatchError is the player's doing: tell that one socket and nobody else.
Anything else is a server fault with no protocol code to send, so it is
rethrown for the dispatcher to log.

## `apps/api/src/match/match.service.ts`

### Line 23 · `function isMoveNumberTaken(error: unknown): boolean`

Move has exactly one composite unique constraint, on (matchId, moveNumber),
so a P2002 from inserting a move can only mean that number was already taken.
The code alone is enough.

### Line 30 · `function replayOrNull(game: string, moves: readonly MoveRow[])`

The lobby's version of opening a match: replay it, and if that fails, say so with null
instead of throwing. rebuild() lets the error through because one broken match should be loud;
a list should not go down with it, so here the broken match just drops out.

getEngine sits inside the try on purpose. A match for a game this server cannot run
can't be watched either, so it drops out the same way rather than turning the whole lobby into a 500.

### Line 38 · `@Injectable() export class MatchService`

The match runtime. The server owns the board; this is where it keeps it.

Except it does not keep it.
There is no board column and no cache: a Match row plus its Move rows is the whole truth,
and every read rebuilds the position by folding the engine's apply() over those rows.
That is what makes a rejoin free, and it is why a bug
can never leave a stored board and a stored history disagreeing.

The user id arrives as a plain argument rather than off a socket, so all of
this can be written and tested before the gateway in #21 exists.

### Line 42 · `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

Inside `@Injectable() export class MatchService`

Everything a client needs to draw a match,
whether they have been watching since the first move or just opened the page.

`userId` is accepted and deliberately not checked.
MatchJoinPayload is documented as joining "as a player or as a spectator", so there is no seat gate here;
that arrives in step 4, where seatOf() returning null becomes a match.not_a_player rejection.
The parameter stays because the gateway will pass it and any future visibility rule belongs right here.

### Line 59 · `state: engine.serialize(position.state)`

Inside `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

serialize, not the raw state.
The payload documents this field as what deserialize() accepts.
For gomoku the two happen to look alike,
which is exactly why skipping it would go unnoticed
until an engine whose state is not already JSON.

### Line 60 · `outcome: match.status === 'finished' ? outcomeOf(match.winnerId, match) : position.outcome`

Inside `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

On a finished match the stored winner outranks the board:
a resignation ends a game with nobody holding five in a row,
so the two legitimately disagree.
On an active match nobody has won yet and the replayed position is the only authority.

An active match whose replay does show a win is an inconsistency step 4 prevents,
by closing the match in the same write that stores the winning move.
Report it, never repair it: a read path that writes is a surprise nobody wants to debug.

### Line 64 · `endReason: match.status === 'finished' ? (match.endReason ?? 'played') : null`

Inside `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

Matches that finished before the endReason column existed have it null.
Back then a game could only end on the board, so that is what null on a finished match means.

### Line 72 · `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

Inside `@Injectable() export class MatchService`

Accept a move, or refuse it and change nothing.

Every check runs before the first write,
so a refusal costs the sender an error and costs everyone else nothing:
there is no half-applied state to broadcast or roll back.
The checks are ordered so the most specific answer wins,
which is why "the game is over" is reported ahead of "it is not your turn"
even though both are true of a finished match.

`userId` comes from the caller, never from the payload.
The payload is the client speaking,
and a client that could name its own player id could play as its opponent.

### Line 86 · `if (match.status === 'finished' || position.outcome !== null) {`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

Two witnesses, and either one is enough to refuse.
The status column is the record; the replayed board is what actually happened.
They agree unless a crash landed a winning move without closing the match.

### Line 100 · `let move: unknown`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

parseMove only decides whether this is a move at all.
It knows nothing about the position,
so "shaped like a move" and "playable here" are two separate answers,
and the protocol has a separate code for each.

### Line 132 · `if (outcome !== null) {`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

Same transaction as the move that ended the game,
so a finished match can never exist without its result,
and a result can never exist without the move that caused it.

### Line 133 · `const { count } = await tx.match.updateMany({`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

Only closes a match that is still active. If a resignation landed between the checks above and this write,
count is 0, and throwing inside the transaction undoes the move as well,
so the stored result stays the resignation instead of being overwritten.

### Line 150 · `if (isMoveNumberTaken(error)) {`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

The unique constraint on (matchId, moveNumber) is the concurrency control.
Two players submitting at once both pass the checks above against the same position,
and the database decides: one insert lands, the other loses.
Losing means the position moved on while this request was in flight,
which is exactly "not your turn" by the time it mattered.

### Line 169 · `async resign(userId: string, matchId: string): Promise<MatchEndedPayload>`

Inside `@Injectable() export class MatchService`

The same checks as a move, in the same order: is this a player, and is the game still running.
The opponent wins, and the result goes out as match.ended rather than match.moved, since no move was played.

### Line 192 · `const { count } = await this.prisma.match.updateMany({`

Inside `async resign(userId: string, matchId: string): Promise<MatchEndedPayload>`

The checks above read the match a moment before this write.
In between, the other player can resign or play a winning move.
Writing only where the status is still active lets the database decide which one counts;
count 0 means this resignation lost and the game had already ended.

### Line 210 · `live(): Promise<LiveMatch[]>`

Inside `@Injectable() export class MatchService`

Every game being played right now, for the lobby. Newest first.
Not async: it only hands back liveMatches' promise, so there is nothing to await here.

### Line 214 · `async current(userId: string): Promise<LiveMatch | null>`

Inside `@Injectable() export class MatchService`

The newest live match this user plays in, or null. What the Match button opens.
A player should only ever have one, but nothing in the schema stops two
(the seed gives charlie two active matches), so this picks rather than assumes.

### Line 216 · `OR: [{ player0Id: userId }, { player1Id: userId }],`

Inside `async current(userId: string): Promise<LiveMatch | null>`

"Is player 0 or player 1". The two seats are separate columns, each with its own index,
so this is two index lookups rather than a scan.

### Line 221 · `private async liveMatches(`

Inside `@Injectable() export class MatchService`

The one query live() and current() share, so the rule for what counts as live
is written once. A live match is active, replays cleanly, and has no winner on the board yet.
status alone is not enough: a broken history or an unclosed win still says active.

### Line 225 · `where: { ...where, status: 'active' },`

Inside `private async liveMatches(…)`

The caller's filter, with status always added on top.
Spread first, so no caller can ask for finished matches by accident.

### Line 226 · `orderBy: { createdAt: 'desc' },`

Inside `private async liveMatches(…)`

createdAt, not updatedAt: a move adds a Move row and never touches the Match row,
so updatedAt stays put for the whole game and says nothing about activity.

### Line 243 · `if (position === null || position.outcome !== null) {`

Inside `private async liveMatches(…)`

null: the history doesn't replay. An outcome: someone already has five in a row
and the match was never closed. Neither is a game anyone can still play or watch.

### Line 262 · `startedAt: match.createdAt.toISOString(),`

Inside `private async liveMatches(…)`

Prisma gives a Date; LiveMatch says string, which is what JSON would turn it into anyway.
Converting here keeps the type honest about what reaches the browser.

### Line 268 · `private async rebuild(matchId: string)`

Inside `@Injectable() export class MatchService`

Load a match and replay it into a position, or throw match.not_found.

Shared by join and move, so there is one query and one orderBy to get right
instead of two that could drift apart.

### Line 269 · `if (!isUUID(matchId)) {`

Inside `private async rebuild(matchId: string)`

An id that isn't a uuid, like /match/abc, never reaches the database.
Postgres refuses it for a uuid column, and Prisma batches findUnique calls made in the same tick into one query,
so that one bad id would fail every lookup in the batch, including other people's valid matches.
Catching the error afterwards can't tell those apart, so the check comes first.

### Line 289 · `orderBy: { moveNumber: 'asc' },`

Inside `private async rebuild(matchId: string)`

Load-bearing. Prisma promises no order without it,
and replay() throws on an out-of-sequence row rather than sorting,
so that a clause forgotten here surfaces as a loud failure
instead of a plausible board built from a shuffled history.

### Line 302 · `const engine`

Inside `private async rebuild(matchId: string)`

A miss here is a server fault, not a rejection:
the game column is an enum this server wrote itself,
so an unknown or unimplemented value means a match was created that nothing can run.
getEngine throws.

## `apps/web/src/index.css`

### Line 1 · file header

CSS decision (issue #18):
- Tailwind chosen for its wide adoption and utility first workflow.
- DaisyUI added as component library on top of it.
Brand colors live in the daisyUI theme below (single source of truth);
custom classes reference those theme variables instead of repeating hex
values, so changing a color only requires editing it in one place.

### Line 14 · `--color-stone-terracotta: #C2663F;`

Board and stones.

### Line 52 · `body::before {`

Soft red light at the top, present on every page.

### Line 68 · `@keyframes stone-pop {`

Five-in-a-row inspired animations (LandingPage's Gomoku board):
stones pop in one by one, winning line and winning stones
glow together once the last stone lands. See the timing note on
.stone-win-glow below for how these four pieces stay in sync.

### Line 119 · `.board-win-line {`

The match board's winning line: the landing page's fade, without its 1.3s wait.
That delay lines up with the illustration's stones popping in one by one;
on a real board the last stone is already down, so the line shows straight away.

### Line 123 · `.board-win-glow {`

The landing page's glow on the winning stones, played once with the line.
Backwards rather than forwards, so when it finishes the glow is gone,
and the line is what stays.

### Line 141 · `.stone-win-glow {`

Win line + winning stones glow together at 1.3s, synced with the
last stone's pop-in animation finishing (10 stones x 0.12s delay).

### Line 147 · `@keyframes title-glow {`

Accent glow used on the "GO" in the logo/title

### Line 193 · `@keyframes stone-loading-pulse {`

"Five-in-a-row" inspired spinner (this is the icon for Loading... )

## `apps/web/src/lib/api.ts`

### Line 13 · `import type { LiveMatch } from '@transcendence/shared'`

The same type the api builds in MatchService, so a field renamed on one side
fails the build on the other instead of showing up as undefined in the lobby.

### Line 118 · `export const matchApi = {`

The lobby's two questions to the api, next to authApi so this stays the only file that calls fetch.
Both go through request(), so they send the cookie and throw an ApiError the same way login does.

### Line 123 · `async current() {`

Inside `export const matchApi = {`

The api answers 204 with no body when you have no live match, and request() turns a 204 into undefined.
`?? null` makes that null, so callers check one thing, the same null MatchService.current returns.

## `apps/web/src/match/GomokuBoard.tsx`

### Line 1 · file header

GomokuBoard draws a 15×15 board from a GomokuState and nothing else.

It holds no state and knows nothing about the socket:
whoever renders it owns the position, which is always what the server last sent.
A click is reported through onPlay and changes nothing here;
the stone appears when the server sends it back.
Stones sit on line intersections,
so BOARD_SIZE lines give BOARD_SIZE × BOARD_SIZE playable points.

Stone colours come from stones.ts. The grid has no surface of its own:
it sits straight on the same soft glow as the landing page illustration.

### Line 11 · `const STAR_POINTS`

The traditional marker points on a 15×15 board: the centre and four around it.

### Line 17 · `const gridLine`

Defined once here, not inside the component, so the 30 grid lines share one
object instead of building a new one on every render.
Styles rather than attributes: var() only resolves in a declaration,
see the note in stones.ts. winLine below is the same, for the red winning line.

### Line 23 · `onPlay?: (move: GomokuMove) => void`

Called with the point that was clicked, legal or not:
the server is the one that says no, and says why.
Left out and the board is the picture it has always been.

### Line 24 · `preview?: boolean`

Whether hovering shows the stone a click would place.
Off when the click is not yours to make, between turns or while watching:
the point still answers, so the server can say why,
but it never shows a stone that is not going to appear.

### Line 25 · `flash?: boolean`

Whether the last stone played gets its ring.
It marks the move that just happened, so it is only worth showing while the game goes on.
Once the match is over, the result says what happened,
and a ring on every reload of a finished match would point at nothing new.
The board cannot tell on its own: a resigned match looks like any other position.

### Line 35 · `const wins = useMemo(() => winningLines(state), [state])`

Inside `function GomokuBoard({ state, onPlay, preview = true, flash = true }: GomokuBoardProps)`

The winning lines, one array each, from winningLines in the shared engine.
Kept apart so each one gets its own line drawn through it;
won flattens them into one set, for the stones.

### Line 41 · `const legal = useMemo(…)`

Inside `function GomokuBoard({ state, onPlay, preview = true, flash = true }: GomokuBoardProps)`

Which points are legal is the engine's answer, not this file's:
every empty one, and none at all once somebody has won.
Only those respond to the pointer. The rest still take a click,
so a stone or a finished game gets the server's reason instead of silence.

### Line 64 · `<circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 1.4} fill={`url(#${glowId})`} pointerEvents="none" />`

Inside `function GomokuBoard({ state, onPlay, preview = true, flash = true }: GomokuBoardProps)`

The glow spills past the board, so it must not catch clicks meant for what sits around it.

### Line 77 · `{wins.map((line) => {`

Inside `function GomokuBoard({ state, onPlay, preview = true, flash = true }: GomokuBoardProps)`

One red line per winning run, centre of its first stone to centre of its last,
as on the landing page. Drawn before the stones, so it shows in the gaps
between them and the stones sit on top of it.

### Line 103 · `className={won.size === 0 ? undefined : won.has(row * BOARD_SIZE + col) ? 'board-win-glow' : 'stone-lost'}`

Inside `function GomokuBoard({ state, onPlay, preview = true, flash = true }: GomokuBoardProps)`

Once someone has won, the stones on the winning lines glow once
and every other stone fades back, so the line and its stones are what you see.
The class arrives with the win, so the glow plays on the winning move
and again only when the board is opened fresh.

### Line 123 · `{onPlay !== undefined && board.flatMap((cells, row) =>`

Inside `function GomokuBoard({ state, onPlay, preview = true, flash = true }: GomokuBoardProps)`

Last, so the targets sit above the grid and the stones and catch the click themselves.
One on every point. On a legal one it is the stone that would be played,
kept invisible until the pointer is on it: the preview and the hit area
are the same circle, so what lights up is exactly what a click would place.

## `apps/web/src/match/LiveMatchRow.tsx`

### Line 1 · file header

One game in the lobby: the two players with their stones, how far the game is, and a way in.
It only draws what it is given; LiveMatches does the loading.

### Line 13 · `function movesLabel(moveNumber: number): string`

moveNumber counts the moves already played, so "3 moves" rather than "Move 3",
which would read as the move about to be played.

### Line 19 · `function turnLabel(match: LiveMatch, seat: PlayerIndex | null): string`

"Your turn" when the player to move is you, which is the reason to press Resume.
Everyone else reads whose turn it is by name, like the panel on the match page.

### Line 37 · `const seat = index === -1 ? null : (index as PlayerIndex)`

Inside `function LiveMatchRow({ match, userId, highlighted = false }: LiveMatchRowProps)`

Your seat in this game, or null when you are not in it. Same pattern as MatchPage.

### Line 56 · `{seat === null ? 'Watch' : 'Resume'}`

Inside `function LiveMatchRow({ match, userId, highlighted = false }: LiveMatchRowProps)`

Both go to the same /match/:id. The match page already knows the difference:
a player gets the board and the Resign button, anyone else watches.
Decided per row rather than by section, so a second live game of yours still says Resume.

## `apps/web/src/match/LiveMatches.tsx`

### Line 1 · file header

The lobby's contents: your game first, then everyone else's.
Kept out of HomePage so it can move to another page, or sit next to other sections,
without being rewritten.

Loads once, when it opens. A game that starts or ends afterwards shows on the next visit;
live updates would need the socket.

### Line 9 · `type Lobby =`

The three states the lobby can be in, as one value rather than three separate flags.
current and live only exist on 'loaded', so nothing can read them while loading
or after a failure, and the type says so.

### Line 22 · `let cancelled = false`

Inside `function LiveMatches()`

Leaving the page before the answer arrives must not set state on a component that is gone.
StrictMode in development mounts every effect twice, so this also stops the first,
abandoned load from overwriting the second.

### Line 24 · `Promise.all([matchApi.current(), matchApi.live()])`

Inside `function LiveMatches()`

Both requests at once rather than one after the other. If either fails, the whole lobby
shows the error: half a lobby would hide your own game, or everyone else's, without saying so.

### Line 35 · `}, [attempt])`

Inside `function LiveMatches()`

The effect runs again whenever attempt changes, which is how Try again reloads.

### Line 37 · `const retry = () => {`

Inside `function LiveMatches()`

Shows the loading state again, then bumps attempt to start a new load.
The loading state is set here, in the click, rather than inside the effect:
setting state directly in an effect costs an extra render, and the hooks lint rule flags it.

### Line 51 · `const others = live.filter((match) => match.matchId !== current?.matchId)`

Inside `function LiveMatches()`

live includes your own game, since the api answers the same list to everyone.
It is already shown at the top, so it is taken out of the list below.

## `apps/web/src/match/MatchPlayers.tsx`

### Line 1 · file header

MatchPlayers sits beside the board: both players, their stone,
and whose turn it is (or how the match ended, once it is over).

Like GomokuBoard it only draws what it is given.
`turn` means nothing once `outcome` is set, so it is only read while the match runs.

### Line 12 · `function status({ players, seat, turn, outcome }: MatchPlayersProps): string`

The headline. Written from where you sit:
a player reads "You won" or "You lost", a spectator reads who won.

### Line 19 · `function reason({ players, seat, outcome, endReason }: MatchPlayersProps): string | null`

The line under the headline, for a match that ended off the board.
A win on the board needs no explanation: the five stones are right there.

### Line 22 · `const loser = outcome.player === 0 ? 1 : 0`

Inside `function reason({ players, seat, outcome, endReason }: MatchPlayersProps): string | null`

A resignation or an abandon is a win for the other player,
so whoever did it is the one who did not win.

### Line 32 · `const highlighted = outcome === null ? turn : outcome.kind === 'win' ? outcome.player : null`

Inside `function MatchPlayers(props: MatchPlayersProps)`

Highlighted: the player to move, or the winner. Nobody, on a draw.

## `apps/web/src/match/ResignButton.tsx`

### Line 1 · file header

Resign, in two clicks: the first asks, the second sends.
The question replaces the button rather than opening a browser dialog,
so it sits in the page and can be answered or cancelled from there.

Like the board it only offers. Nothing changes on screen until match.ended
comes back and MatchPage takes the button away.

### Line 11 · `const [sent, setSent] = useState(false)`

Inside `function ResignButton({ onResign }: ResignButtonProps)`

Once the resignation is on its way, both buttons go quiet:
a second click would only earn "This match is already over".
Never reset, because the component does not outlive the match ending.

## `apps/web/src/match/stones.ts`

### Line 1 · file header

Stone colours, shared by the board and the player panel beside it.

Player 0 moves first and plays terracotta, player 1 plays sage.

### Line 3 · `export function stoneFill(cell: Exclude<Cell, null>): string`

This returns CSS, not a colour value, so whatever it is handed to must be a
style declaration: `style={{ fill: … }}`, never `fill="…"`.
var() is not valid in an SVG presentation attribute — it does not fail
loudly, it just paints black.

## `apps/web/src/pages/HomePage.tsx`

### Line 1 · file header

/home is the lobby: where login lands, and where the logo leads.
All the content is in LiveMatches; this page only gives it a title and a width.

## `apps/web/src/pages/MatchPage.tsx`

### Line 1 · file header

```text
MatchPage is the screen behind /match/:matchId.

It asks the server for the match and draws what comes back.

The board is never invented here: match.state carries it,
gomoku.deserialize validates it,
gomoku.apply is what moves it forward,
and this page renders whatever those return.

  join ──────────────► match.state   the whole board, once
                       match.moved   one move at a time, from then on
                       match.ended   a match that ended off the board
  click ─────────────► match.move    an offer, drawn only once it comes back
  resign ────────────► match.resign  answered with match.ended, like a move with match.moved
                       match.rejected  a join or a move the server refused

A gap in moveNumber means this tab missed a move. The cure is to rejoin,
which answers with a fresh board, so the view is marked stale
and the page sends match.join again.
```

### Line 25 · `interface MatchView`

What this page is showing right now.

Not the payload the server sent: a payload is one message,
while this is the running picture that later messages update.
match.state replaces the whole view,
while match.moved carries one move rather than a board
and needs this to apply that move onto.

### Line 30 · `readonly endReason: MatchEndReason | null`

Inside `interface MatchView`

How the match ended, so the player panel can say "dana resigned"
and not just who won. null while the match is still running.

### Line 32 · `readonly board: GomokuState | null`

Inside `interface MatchView`

null when the server sent a board this client cannot read. See readBoard.

### Line 33 · `readonly stale: boolean`

Inside `interface MatchView`

This board has fallen behind the server's:
a move was missed, or one would not play on it.
Moves are ignored until a fresh match.state replaces the whole view.

### Line 36 · `const NOTICE_MS`

The server sends a code and never prose, so the wording lives here.
A Record rather than a switch so a code added to the protocol
fails the build until it has a sentence.
A refused join shows one as the whole page; a refused move, under the board.
How long a refused move stays under the board.

### Line 47 · `function readBoard(game: string, state: unknown): GomokuState | null`

A deserialize failure means the server sent a board this client cannot read.
That is a bug to report, not something to draw around,
so it gets an error screen rather than an empty board.

### Line 56 · `function viewFromState(payload: MatchStatePayload): MatchView`

A snapshot arrives whole, so it is read once, here,
rather than on every render.
The page never touches payload.state itself.

### Line 69 · `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

The same match, one move later.

### Line 72 · `if (payload.moveNumber <= view.moveNumber) return view`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

Broadcasts are numbered, each one higher than the last.
Joining the room before reading the snapshot can deliver a move the snapshot
already holds (see match.handlers.ts), so a number we have passed is dropped
rather than played twice.

### Line 74 · `if (payload.moveNumber !== view.moveNumber + 1) return { ...view, stale: true }`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

A number further ahead means a move in between never arrived.
Playing this one on top would draw a board nobody has.

### Line 80 · `return { ...view, stale: true }`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

The server accepted this move against its own board,
so a throw here means the two boards have drifted apart.
Drawing it anyway would only widen the difference.

### Line 83 · `return {`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

turn and outcome come from the payload, not from what apply worked out.
The server decides both, and a client that computes its own
would be the first thing to disagree.

### Line 88 · `endReason: payload.outcome === null ? null : 'played',`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

A move only ever ends a match on the board.
Resigning and abandoning arrive as match.ended instead.

### Line 93 · `function applyEnded(view: MatchView, payload: MatchEndedPayload): MatchView`

The same match, over. The board stays as it was:
nothing was played, somebody stopped playing.

### Line 94 · `if (view.outcome !== null) return view`

Inside `function applyEnded(view: MatchView, payload: MatchEndedPayload): MatchView`

The server writes an ending only while the match is still active,
so a second one cannot be real. Kept out anyway,
so whatever ended the match first is what the page keeps saying.

### Line 107 · `const view`

Inside `function MatchPage()`

A view counts only while we are still on the match it describes.
Navigating from one match to another would otherwise leave the previous board
on screen until the new snapshot arrived.
Derived rather than reset in the effect below,
which would cost a second render every time.

### Line 115 · `const unsubscribe = subscribe(…)`

Inside `function MatchPage()`

One socket serves the whole tab, so every event arrives here,
including events about other matches and other features.

### Line 125 · `setReceived((current) =>`

Inside `function MatchPage()`

This listener is built once and never sees a later render,
so the board to play the move on has to come from React
rather than from anything captured here.
A move that arrives before the first snapshot has nothing to land on
and is dropped: the snapshot is on its way and will already contain it.

### Line 131 · `setRefused(null)`

Inside `function MatchPage()`

The board has moved on, so "it's not your turn" from before
no longer describes it.

### Line 135 · `if (event.type === 'match.ended') {`

Inside `function MatchPage()`

Handled like match.moved: applied onto the view React holds,
and any refusal still showing is cleared, since the match it refused a move in is over.

### Line 148 · `if (event.type === 'match.rejected') {`

Inside `function MatchPage()`

Kept whatever it refused. Only the render below decides it matters:
before a board arrives it can only be the join,
and after one it is a refused move, which leaves the board as it was.

### Line 160 · `const stale`

Inside `function MatchPage()`

A stale board is replaced by joining again: the server answers every join
with a fresh match.state, and viewFromState clears the flag. Sent with
send, not join, because the standing join registered above already covers
reconnects; this only asks for one more snapshot.

### Line 165 · `const refusedMove`

Inside `function MatchPage()`

A refused move is a passing remark, so it goes after three seconds.
A refused join is not: with no board it is the whole page, and it stays.
Keyed on the refusal itself, so a new one starts the three seconds again.

### Line 188 · `const seat = index === -1 ? null : (index as PlayerIndex)`

Inside `function MatchPage()`

Which seat is yours, or null while you are only watching.
findIndex answers -1 for "not found"; turned into null here
so the player panel can take it as a PlayerIndex.
The logged-in user is the same identity the socket authenticated with,
so this agrees with the seat the server checks every move against.

### Line 190 · `const playing = seat !== null && view.outcome === null`

Inside `function MatchPage()`

You hold a seat and the match is still going:
the only time there is anything to play, or to resign.

### Line 191 · `const myTurn`

Inside `function MatchPage()`

Only the player to move sees the stone a click would place.
Everyone else can still click while the match runs, and the server says why it will not count:
it's not your turn, that point is taken, or you are only watching.

### Line 193 · `const play = (move: GomokuMove) =>`

Inside `function MatchPage()`

Nothing is drawn here. The move is an offer: the server decides,
and the stone arrives with everybody else's copy of it, through match.moved.
Written as a const rather than a function:
a function can be called from anywhere in the page,
including above the guard that proves matchId is there,
so inside one it counts as possibly undefined again.
The last refusal is cleared on every click, so the same refusal twice
in a row still reads as a new answer rather than a leftover.

### Line 202 · `<div className="grid w-full justify-items-center gap-8 xl:grid-cols-[1fr_32rem_1fr] xl:items-start">`

Inside `function MatchPage()`

Three columns so the board stays in the exact centre of the page:
an empty one on the left balances the player panel on the right.
Below xl there isn't room beside the board, so the panel goes under it.

### Line 206 · `onPlay={view.outcome === null ? play : undefined}`

Inside `function MatchPage()`

A finished match is a picture: without onPlay the board draws no click targets,
so nothing is sent and nothing comes back refused.
"This match is already over" still exists for a click that crosses the ending on the wire:
sent before this page heard the match was over, refused once it was.

### Line 210 · `<p aria-live="polite" className="min-h-5 text-center text-sm text-(--color-primary)">`

Inside `function MatchPage()`

Always in the page, empty when there is nothing to say:
a screen reader only announces a live region it was already watching,
and a reserved line keeps the board from jumping when one appears.

### Line 222 · `{playing && <ResignButton key={matchId} onResign={() => send(resign(matchId))} />}`

Inside `function MatchPage()`

Gone the moment the match ends, however it ended,
so a finished match never offers to be resigned.
Keyed on the match so moving to another one
starts with the plain button, never a confirmation left open.

## `apps/web/src/socket/SocketProvider.tsx`

### Line 5 · `type Props =…`

*The TEMP/TODO marker is still in the code.*

Ties the tab's one socket to whether someone is logged in, and makes it available
to every component through useSocket().

Sits above Routes so it never unmounts while navigating. The connection itself lives in
lib/socket.ts, this file only decides when it is open.

TODO Noor: the connection indicator. A component that reads useSocket().status and shows it
in the header. 'reconnecting' is the one that matters to a player mid-game.

### Line 8 · `enabled: boolean;`

open the socket while true, close it the moment it turns false

### Line 26 · `const send = useCallback(…)`

Inside `export function SocketProvider({ enabled, children}: Props)`

These four never change.
A page that joins a room in a useEffect has to list them in its dependencies;
rebuilt on every render,
that effect would leave and rejoin the room each time the status changed.
The leave is the dangerous half - Socket.IO buffers an emit made while the
socket is down, so a match.leave sent during a reconnect can be delivered
after the match.join that follows it.

Nothing to close over: the socket is one module-level object.

## `shared/src/lobby.ts`

### Line 1 · file header

What the lobby is told about each game being played.
It travels over HTTP rather than the socket, but lives in shared for the same reason ws.ts does:
the api builds it and the web app reads it, and one definition keeps the two from drifting.

### Line 4 · `export interface LiveMatch`

A match counts as live while it is active, its moves replay cleanly,
and nobody has won on the board yet. MatchService decides that; this is only the shape.

### Line 7 · `readonly players: readonly [MatchPlayer, MatchPlayer];`

Inside `export interface LiveMatch`

The same pair match.state sends, so the lobby and the match page name players the same way.
Index 0 moves first.

### Line 8 · `readonly turn: PlayerIndex;`

Inside `export interface LiveMatch`

Lets the lobby say "Your turn" next to Resume without opening the match.

### Line 10 · `readonly startedAt: string;`

Inside `export interface LiveMatch`

When the match was created, as an ISO string: JSON has no dates,
so a Date on the server arrives as a string anyway. Saying so in the type
keeps anyone from calling Date methods on it without parsing it first.
