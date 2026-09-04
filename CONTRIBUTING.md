## Contributing

Team conventions.

## Categories

One vocabulary for issue labels, branch names and commit messages.

| Category | Use for |
|---|---|
| `feat` | New functionality |
| `fix` | Bug fixes |
| `refactor` | Restructuring with no behaviour change |
| `test` | Adding or fixing tests |
| `chore` | Tooling, dependencies, config, CI |
| `docs` | README, comments |

## Branches

```<category>/<issue-number>-<short-description>```

Lowercase, kebab-case.

```
feat/12-gomoku-engine
fix/34-reversi-flip-direction
chore/7-eslint-config
docs/19-api-contract
```

Branch off `main`. Delete the branch after merging.

## Commits

```<category>: <what changed, imperative>```

```
feat: add five-in-a-row win detection
fix: correct diagonal flip direction in reversi
chore: add vitest config
```

Present tense, lowercase after the colon, no trailing period. If you need more than one line, leave a blank line and explain *why* in the body.

## Database

Postgres, through Prisma. One schema file, `apps/api/prisma/schema.prisma`, and one migrations folder beside it. Every table anyone adds lives there, so `Game`, `Move`, `Friendship` and the rest go into the same file rather than one per person.

### Conventions

Four rules, so nobody has to read an existing model to work out what the last person decided.

**Ids are uuids.** `String @id @default(uuid()) @db.Uuid`. Sequential integers would tell anyone who reads a URL how many users exist and let them walk `/users/1`, `/users/2`. A uuid also lets the application mint an id before the insert, which matters when two rows have to reference each other. `@db.Uuid` stores it as the native Postgres type rather than as text.

**Casing is Prisma's default.** A model is its table and a field is its column: `model User` is the table `"User"`, `displayName` is the column `"displayName"`. No `@map`, no `@@map`. The trade is that Postgres lowercases unquoted identifiers, so raw SQL needs double quotes:

```sql
select * from "User" where "displayName" = 'kimia';
```

The alternative — mapping everything to `snake_case` — means an annotation on every field of every table that five people all have to remember. One quoting rule in psql is cheaper than that.

**Every table carries `createdAt` and `updatedAt`**, as `@db.Timestamptz(3)`. Without the timezone, Postgres stores a wall-clock reading with no indication of where the clock was, and comparing it against `now()` silently applies the server's timezone. With it, a row records an instant that means the same thing everywhere.

```prisma
createdAt DateTime @default(now()) @db.Timestamptz(3)
updatedAt DateTime @updatedAt @db.Timestamptz(3)
```

**State that can be reconstructed is stored as events, not snapshots.** A board is not a column. `Move` rows are the record, and the current position is rebuilt by folding the engine's `apply()` over them from the empty state — which is what the pure engine in `shared/` is for. The same rule is why `Game` has no board column, and why a profile's win count is derived from `Game` rows instead of being a counter on `User` that drifts the first time a row is deleted or backfilled wrong. See [#22](https://github.com/ASprintNotAMarathon/Transcendence/issues/22). Cache a derived value only when a profiler says to, and as a separate, argued change.

### Changing the schema

Editing `schema.prisma` changes nothing on its own. The migration is the artefact that runs against a database, and it is generated, never written by hand:

```bash
npm run prisma:migrate --workspace api -- --name add_friendship
```

Then the rules:

- **Commit `prisma/migrations/`.** It is the only record of how a database gets from empty to current. `src/generated/` is not committed — it is regenerated on every `npm install`.
- **Never edit a migration that has been pushed.** Someone else has already applied it, and their `_prisma_migrations` row holds a checksum of the old text. Editing it makes their database refuse to migrate. Fix a mistake with a new migration.
- **One migration per pull request**, matching one schema change. Three migrations in a PR usually means the first two were wrong; squash them locally before pushing by resetting and regenerating.
- **Never run `prisma db push` on a branch anyone else will pull.** It changes a database without leaving a migration, so the schema and the migrations drift apart and the next person to run `migrate dev` inherits it.
- **`migrate dev` locally, `migrate deploy` everywhere else.** `deploy` applies committed migrations and nothing else: it never generates, never prompts, never resets. The API runs it on start, so a container cannot come up against a database it does not match.
- **A migration that drops or renames a column needs a note in the PR description.** It is not reversible and it will run on everyone's database.

CI applies every migration to an empty Postgres and then diffs the result against `schema.prisma`. A schema edited without a generated migration fails there, because that mistake has no local symptom: the client is generated from the schema, so the code typechecks and only the query fails.

To check it yourself before pushing:

```bash
npm run prisma:check --workspace api
```

### Commands

All from the repo root; the database comes from `make up`.

| Command | Does |
|---|---|
| `npm run prisma:migrate --workspace api -- --name <name>` | Generate and apply a migration |
| `npm run prisma:deploy --workspace api` | Apply committed migrations |
| `npm run prisma:generate --workspace api` | Regenerate the client after a schema change |
| `npm run prisma:check --workspace api` | Fail if the schema and migrations disagree |
| `npm run prisma:studio --workspace api` | Browse the data |

### Injecting the client

`PrismaModule` is `@Global`, so a service asks for `PrismaService` in its constructor and imports nothing:

```ts
constructor(private readonly prisma: PrismaService) {}
```

Let the database enforce what it can. A duplicate `email` should be caught, not pre-checked with a `findUnique` that two concurrent registrations both pass. Prisma raises `P2002`, and in Prisma 7 the constraint name is at `error.meta.driverAdapterError.cause.constraint.index` — `"User_email_key"` — not at `meta.target` as it was in version 6. That string is how you tell which field collided.

## Pull requests

- Every change goes through a PR. Nobody pushes to `main`.
- One approval required from someone outside the area being changed.
- Squash merge by default, so `main` stays one commit per change. Use a normal merge if the individual commits are worth keeping.
- Fill in the PR template.
- Keep them small. A 300-line PR gets a real review; a 3000-line one just gets approved without anyone really reading it.

## Issues

Every issue gets a category label and an owner.
Each claimed module gets its own tracking issue, with its tasks linked underneath, so we can see at any point how many points are actually finished.

## Definition of done

- It works after `docker compose up` from a clean clone
- No errors or warnings in the browser console
- Tests pass and CI is green
- Checked in Firefox (if we take the extra-browsers module)
- Any decision worth remembering is written down
