# Transcendence

## WebSocket protocol

Every message either side may send over the socket is declared once in
[`shared/src/ws.ts`](shared/src/ws.ts). The API imports it to know what it is allowed to receive
and emit, the web app imports the same file to know what it is allowed to send and expect. If a
message is not in that file, it is not part of the protocol.

The file is pure types, so it compiles to an empty module and adds nothing to either bundle.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/ws-protocol-dark.svg">
  <img alt="Match payload interfaces are wrapped by the Envelope generic into MatchClientEvent, which combines with the empty LifecycleClientEvent, ChatClientEvent and PresenceClientEvent to form ClientEvent. The server payloads follow the mirrored path into ServerEvent." src="docs/ws-protocol-light.svg">
</picture>

### The envelope

Every message has the same frame: `{ type, cid?, payload }`. Reading `type` tells TypeScript
which fields `payload` has. Nesting the payload rather than flattening it costs a `.payload` on
every access, but envelope fields and game fields can never collide, and each section owns a named
payload type instead of everyone editing the same union member.

`cid` is a correlation id. The client stamps it on a request, the server echoes it on a direct
reply so the client can tell which reply belongs to which request. Broadcasts do not carry one,
since a broadcast answers nobody.

### Match events

Seven events are live, all under `match.*`. The server holds the board and clients submit
intentions:

| Event | Direction | Sent to |
| --- | --- | --- |
| `match.join` | client to server | Start receiving updates, as a player or a spectator |
| `match.leave` | client to server | Stop receiving updates. Not a resignation |
| `match.move` | client to server | Offer a move |
| `match.resign` | client to server | Concede |
| `match.state` | server to client | The whole board, in reply to a join or rejoin |
| `match.moved` | server to client | One accepted move, broadcast to everyone watching |
| `match.rejected` | server to client | A refusal, to the sending player alone |

Two details worth knowing before you build against this:

- `move` and `state` are typed `unknown` on purpose. The transport does not know what a move is,
  it hands the value to the engine's `parseMove`, and a throw becomes `match.malformed_move`.
  That is why Reversi will reuse these events unchanged instead of needing a second set.
- `match.state` and `match.moved` both carry a `moveNumber`. Each broadcast is one higher than the
  last. A client that sees a gap knows it missed a move and should rejoin for a fresh board.

Errors are events carrying machine readable codes, never prose the client is expected to display.
`ErrorCode` splits into `TransportErrorCode`, `MatchErrorCode` , `ChatErrorCode` and `PresenceErrorCode`, each namespaced
with the same prefix as its events so the three sets cannot collide as they grow.

### Chat events

| Event | Direction | Purpose |
| --- | --- | --- |
| `chat.send` | client to server | Send a new message |
| `chat.history` | client to server | Request previous messages |
| `chat.message` | server to client | A successfully created message |
| `chat.history_result` | server to client | Previous messages returned in response to a history request |
| `chat.rejected` | server to client | A chat message refused by the server |

### Presence events

| Event | Direction | Purpose |
| --- | --- | --- |
| `presence.list` | client to server | Request the current list of online users |
| `presence.state` | server to client | Current list of online users |
| `presence.online` | server to client | A user has come online |
| `presence.offline` | server to client | A user has gone offline |

### What is still open

The dashed boxes above are `never`, which contributes nothing to a union, so the empty sections
typecheck today and `ClientEvent` and `ServerEvent` widen on their own once they are filled in.
No edit to the top level unions is needed.

- Transport: `TransportErrorCode` plus connect, authenticate, disconnect and reconnect.

Note that types are erased at build time, so nothing stops a malformed frame from arriving over
the wire. Validating incoming messages at the door is part of the transport work.

### Sending a message from the web app

[`apps/web/src/lib/protocol.ts`](apps/web/src/lib/protocol.ts) has one builder per client message,
so no component constructs an envelope by hand:

```ts
import { joinMatch, sendMove } from './lib/protocol'

socket.send(joinMatch(matchId, 'a1'))
socket.send(sendMove(matchId, { x: 7, y: 7 }))
```

## The database

Postgres, through Prisma. One schema file, `apps/api/prisma/schema.prisma`, and
one migrations folder beside it — every table anyone adds goes there.

[**docs/database.md**](docs/database.md) explains it from scratch: what the
pieces are, the conventions every table follows, how to add your own, and what
to do when something looks off. The migration rules are in
[CONTRIBUTING](CONTRIBUTING.md#database).

## Getting started

### Requirements

- **Docker** and **Docker Compose**
- **GNU Make**
- **Node 24** — run `nvm use`, which reads `.nvmrc`

Node on your machine is not optional: `make up` builds the shared game-engine
package on the host before starting the containers.

### Setup

```sh
git clone git@github.com:ASprintNotAMarathon/Transcendence.git
cd Transcendence
cp .env.example .env
```

Then edit `.env` and set three values:

| Variable | How |
| --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `DATABASE_URL` | the same password, in the connection string |

The password may only contain `A-Za-z0-9._~-`. It is embedded in
`DATABASE_URL`, where `@ : / ? # %` are structural characters and would break
the URL.

`make up` refuses to start if any value is still a placeholder, or if
`DATABASE_URL` disagrees with the `POSTGRES_*` variables — so if you change the
password, change it in both places.

```sh
make up
```

The first run takes a few minutes: it installs dependencies and builds two
images. Afterwards it is seconds.

### Checking it worked

```sh
make ps
```

Three services, all `healthy`. Then:

| URL | Expected |
| --- | --- |
| http://localhost:5173 | the web app |
| http://localhost:3000/api/health | `{"status":"ok"}` |
| http://localhost:5173/api/health | the same, through the Vite proxy |

The third one is the useful check — it proves the web container can reach the
api container.

### Everyday commands

`make help` lists them all. The ones you need daily:

| Command | Does |
| --- | --- |
| `make up` | start everything, waits until healthy |
| `make down` | stop, **keep** the database |
| `make fclean` | stop and **delete** the database |
| `make logs` | follow all logs |
| `make psql` | a shell on the database |
| `make test` | run the game engine tests |

### Good to know

- Editing source hot-reloads inside the containers. No rebuild needed.
- Ports are published on `127.0.0.1` only, so nothing is exposed to the network.
- If a container will not start, `make logs` first.
