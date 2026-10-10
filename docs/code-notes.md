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

### Line 65 · `node_modules: package.json package-lock.json`

A file target, like .env: make builds node_modules/ from the manifests and reinstalls only when one of them is newer.
So `make test` on an up-to-date clone skips the install, but still works on a fresh one.
npm doesn't reliably update the directory's timestamp, hence the touch.

## `apps/api/src/app.service.ts`

### Line 10 · `availableGames(): string[]`

Inside `@Injectable() export class AppService`

The games that can actually be played, which is narrower than the games the schema knows about:
GameName lists reversi, but no engine implements it yet.
Derived from the registry in @transcendence/shared,
so adding an engine is the only thing needed to make it appear here.

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

### Line 18 · `function isMoveNumberTaken(error: unknown): boolean`

Move has exactly one composite unique constraint, on (matchId, moveNumber),
so a P2002 from inserting a move can only mean that number was already taken.
The code alone is enough.

### Line 25 · `@Injectable() export class MatchService`

The match runtime. The server owns the board; this is where it keeps it.

Except it does not keep it.
There is no board column and no cache: a Match row plus its Move rows is the whole truth,
and every read rebuilds the position by folding the engine's apply() over those rows.
That is what makes a rejoin free, and it is why a bug
can never leave a stored board and a stored history disagreeing.

The user id arrives as a plain argument rather than off a socket, so all of
this can be written and tested before the gateway in #21 exists.

### Line 29 · `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

Inside `@Injectable() export class MatchService`

Everything a client needs to draw a match,
whether they have been watching since the first move or just opened the page.

`userId` is accepted and deliberately not checked.
MatchJoinPayload is documented as joining "as a player or as a spectator", so there is no seat gate here;
that arrives in step 4, where seatOf() returning null becomes a match.not_a_player rejection.
The parameter stays because the gateway will pass it and any future visibility rule belongs right here.

### Line 46 · `state: engine.serialize(position.state)`

Inside `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

serialize, not the raw state.
The payload documents this field as what deserialize() accepts.
For gomoku the two happen to look alike,
which is exactly why skipping it would go unnoticed
until an engine whose state is not already JSON.

### Line 47 · `outcome: match.status === 'finished' ? outcomeOf(match.winnerId, match) : position.outcome`

Inside `async join(userId: string, matchId: string): Promise<MatchStatePayload>`

On a finished match the stored winner outranks the board:
a resignation ends a game with nobody holding five in a row,
so the two legitimately disagree.
On an active match nobody has won yet and the replayed position is the only authority.

An active match whose replay does show a win is an inconsistency step 4 prevents,
by closing the match in the same write that stores the winning move.
Report it, never repair it: a read path that writes is a surprise nobody wants to debug.

### Line 55 · `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

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

### Line 69 · `if (match.status === 'finished' || position.outcome !== null) {`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

Two witnesses, and either one is enough to refuse.
The status column is the record; the replayed board is what actually happened.
They agree unless a crash landed a winning move without closing the match.

### Line 83 · `let move: unknown`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

parseMove only decides whether this is a move at all.
It knows nothing about the position,
so "shaped like a move" and "playable here" are two separate answers,
and the protocol has a separate code for each.

### Line 115 · `if (outcome !== null) {`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

Same transaction as the move that ended the game,
so a finished match can never exist without its result,
and a result can never exist without the move that caused it.

### Line 126 · `if (isMoveNumberTaken(error)) {`

Inside `async move( userId: string, payload: MatchMovePayload, ): Promise<MatchMovedPayload>`

The unique constraint on (matchId, moveNumber) is the concurrency control.
Two players submitting at once both pass the checks above against the same position,
and the database decides: one insert lands, the other loses.
Losing means the position moved on while this request was in flight,
which is exactly "not your turn" by the time it mattered.

### Line 145 · `private async rebuild(matchId: string)`

Inside `@Injectable() export class MatchService`

Load a match and replay it into a position, or throw match.not_found.

Shared by join and move, so there is one query and one orderBy to get right
instead of two that could drift apart.

### Line 158 · `orderBy: { moveNumber: 'asc' },`

Inside `private async rebuild(matchId: string)`

Load-bearing. Prisma promises no order without it,
and replay() throws on an out-of-sequence row rather than sorting,
so that a clause forgotten here surfaces as a loud failure
instead of a plausible board built from a shuffled history.

### Line 171 · `const engine`

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

### Line 111 · `.stone-win-glow {`

Win line + winning stones glow together at 1.3s, synced with the
last stone's pop-in animation finishing (10 stones x 0.12s delay).

### Line 117 · `@keyframes title-glow {`

Accent glow used on the "GO" in the logo/title

### Line 152 · `@keyframes stone-loading-pulse {`

"Five-in-a-row" inspired spinner (this is the icon for Loading... )

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
see the note in stones.ts.

### Line 22 · `onPlay?: (move: GomokuMove) => void`

Called with the point that was clicked, legal or not:
the server is the one that says no, and says why.
Left out and the board is the picture it has always been.

### Line 23 · `preview?: boolean`

Whether hovering shows the stone a click would place.
Off when the click is not yours to make, between turns or while watching:
the point still answers, so the server can say why,
but it never shows a stone that is not going to appear.

### Line 30 · `const legal = useMemo(…)`

Inside `function GomokuBoard({ state, onPlay, preview = true }: GomokuBoardProps)`

Which points are legal is the engine's answer, not this file's:
every empty one, and none at all once somebody has won.
Only those respond to the pointer. The rest still take a click,
so a stone or a finished game gets the server's reason instead of silence.

### Line 53 · `<circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 1.4} fill={`url(#${glowId})`} pointerEvents="none" />`

Inside `function GomokuBoard({ state, onPlay, preview = true }: GomokuBoardProps)`

The glow spills past the board, so it must not catch clicks meant for what sits around it.

### Line 80 · `{onPlay !== undefined && board.flatMap((cells, row) =>`

Inside `function GomokuBoard({ state, onPlay, preview = true }: GomokuBoardProps)`

Last, so the targets sit above the grid and the stones and catch the click themselves.
One on every point. On a legal one it is the stone that would be played,
kept invisible until the pointer is on it: the preview and the hit area
are the same circle, so what lights up is exactly what a click would place.

## `apps/web/src/match/MatchPlayers.tsx`

### Line 1 · file header

MatchPlayers sits beside the board: both players, their stone,
and whose turn it is (or who won, once the match is over).

Like GomokuBoard it only draws what it is given.
`turn` means nothing once `outcome` is set, so it is only read while the match runs.

### Line 17 · `const highlighted = outcome === null ? turn : outcome.kind === 'win' ? outcome.player : null`

Inside `function MatchPlayers({ players, turn, outcome }: MatchPlayersProps)`

Highlighted: the player to move, or the winner. Nobody, on a draw.

## `apps/web/src/match/stones.ts`

### Line 1 · file header

Stone colours, shared by the board and the player panel beside it.

Player 0 moves first and plays terracotta, player 1 plays sage.

### Line 3 · `export function stoneFill(cell: Exclude<Cell, null>): string`

This returns CSS, not a colour value, so whatever it is handed to must be a
style declaration: `style={{ fill: … }}`, never `fill="…"`.
var() is not valid in an SVG presentation attribute — it does not fail
loudly, it just paints black.

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
  click ─────────────► match.move    an offer, drawn only once it comes back
                       match.rejected  a join or a move the server refused

A gap in moveNumber means this tab missed a move. The cure is to rejoin,
which answers with a fresh board, so the view is marked stale
and the page sends match.join again.
```

### Line 22 · `interface MatchView`

What this page is showing right now.

Not the payload the server sent: a payload is one message,
while this is the running picture that later messages update.
match.state replaces the whole view,
while match.moved carries one move rather than a board
and needs this to apply that move onto.

### Line 28 · `readonly board: GomokuState | null`

Inside `interface MatchView`

null when the server sent a board this client cannot read. See readBoard.

### Line 29 · `readonly stale: boolean`

Inside `interface MatchView`

This board has fallen behind the server's:
a move was missed, or one would not play on it.
Moves are ignored until a fresh match.state replaces the whole view.

### Line 32 · `const NOTICE_MS`

The server sends a code and never prose, so the wording lives here.
A Record rather than a switch so a code added to the protocol
fails the build until it has a sentence.
A refused join shows one as the whole page; a refused move, under the board.
How long a refused move stays under the board.

### Line 43 · `function readBoard(game: string, state: unknown): GomokuState | null`

A deserialize failure means the server sent a board this client cannot read.
That is a bug to report, not something to draw around,
so it gets an error screen rather than an empty board.

### Line 52 · `function viewFromState(payload: MatchStatePayload): MatchView`

A snapshot arrives whole, so it is read once, here,
rather than on every render.
The page never touches payload.state itself.

### Line 64 · `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

The same match, one move later.

### Line 67 · `if (payload.moveNumber <= view.moveNumber) return view`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

Broadcasts are numbered, each one higher than the last.
Joining the room before reading the snapshot can deliver a move the snapshot
already holds (see match.handlers.ts), so a number we have passed is dropped
rather than played twice.

### Line 69 · `if (payload.moveNumber !== view.moveNumber + 1) return { ...view, stale: true }`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

A number further ahead means a move in between never arrived.
Playing this one on top would draw a board nobody has.

### Line 75 · `return { ...view, stale: true }`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

The server accepted this move against its own board,
so a throw here means the two boards have drifted apart.
Drawing it anyway would only widen the difference.

### Line 78 · `return {`

Inside `function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView`

turn and outcome come from the payload, not from what apply worked out.
The server decides both, and a client that computes its own
would be the first thing to disagree.

### Line 96 · `const view`

Inside `function MatchPage()`

A view counts only while we are still on the match it describes.
Navigating from one match to another would otherwise leave the previous board
on screen until the new snapshot arrived.
Derived rather than reset in the effect below,
which would cost a second render every time.

### Line 104 · `const unsubscribe = subscribe(…)`

Inside `function MatchPage()`

One socket serves the whole tab, so every event arrives here,
including events about other matches and other features.

### Line 114 · `setReceived((current) =>`

Inside `function MatchPage()`

This listener is built once and never sees a later render,
so the board to play the move on has to come from React
rather than from anything captured here.
A move that arrives before the first snapshot has nothing to land on
and is dropped: the snapshot is on its way and will already contain it.

### Line 120 · `setRefused(null)`

Inside `function MatchPage()`

The board has moved on, so "it's not your turn" from before
no longer describes it.

### Line 124 · `if (event.type === 'match.rejected') {`

Inside `function MatchPage()`

Kept whatever it refused. Only the render below decides it matters:
before a board arrives it can only be the join,
and after one it is a refused move, which leaves the board as it was.

### Line 136 · `const stale`

Inside `function MatchPage()`

A stale board is replaced by joining again: the server answers every join
with a fresh match.state, and viewFromState clears the flag. Sent with
send, not join, because the standing join registered above already covers
reconnects; this only asks for one more snapshot.

### Line 141 · `const refusedMove`

Inside `function MatchPage()`

A refused move is a passing remark, so it goes after three seconds.
A refused join is not: with no board it is the whole page, and it stays.
Keyed on the refusal itself, so a new one starts the three seconds again.

### Line 163 · `const seat = view.players.findIndex(…)`

Inside `function MatchPage()`

Which seat is yours, or -1 while you are only watching.
The logged-in user is the same identity the socket authenticated with,
so this agrees with the seat the server checks every move against.

### Line 166 · `const myTurn`

Inside `function MatchPage()`

Only the player to move sees the stone a click would place.
Everyone else can still click, and the server says why it will not count:
it's not your turn, that point is taken, the match is over,
or you are only watching.

### Line 168 · `const play = (move: GomokuMove) =>`

Inside `function MatchPage()`

Nothing is drawn here. The move is an offer: the server decides,
and the stone arrives with everybody else's copy of it, through match.moved.
Written as a const rather than a function:
a function can be called from anywhere in the page,
including above the guard that proves matchId is there,
so inside one it counts as possibly undefined again.
The last refusal is cleared on every click, so the same refusal twice
in a row still reads as a new answer rather than a leftover.

### Line 177 · `<div className="grid w-full justify-items-center gap-8 xl:grid-cols-[1fr_32rem_1fr] xl:items-start">`

Inside `function MatchPage()`

Three columns so the board stays in the exact centre of the page:
an empty one on the left balances the player panel on the right.
Below xl there isn't room beside the board, so the panel goes under it.

### Line 180 · `<p aria-live="polite" className="min-h-5 text-center text-sm text-(--color-primary)">`

Inside `function MatchPage()`

Always in the page, empty when there is nothing to say:
a screen reader only announces a live region it was already watching,
and a reserved line keeps the board from jumping when one appears.

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
