# Developer notes

Working notes on the shared game engine. Aimed at contributors who are new to
TypeScript.

## `legalMoves` and the board arithmetic

`BOARD_SIZE` is 15, so a Gomoku board has `15 × 15 = 225` squares.

`legalMoves(state)` returns **every square the current player may legally play**.
On Gomoku that rule is simply "every empty square", so the length of the
returned array is:

| Board state              | Legal moves |
| ------------------------ | ----------- |
| Fresh board              | 225         |
| After 1 stone            | 224         |
| After *n* stones         | 225 − *n*   |
| Game over (win or draw)  | 0           |

The last row is the one that is easy to miss. Once someone has five in a row the
game is finished, so there are no legal moves left even though the board is
mostly empty. `legalMoves` and `isLegal` both have to consult `outcome` before
they answer.

### Why the tests never hardcode 225

From `shared/src/gomoku.test.ts`:

```ts
expect(gomoku.legalMoves(gomoku.initialState())).toHaveLength(
  BOARD_SIZE * BOARD_SIZE,
);
const s = gomoku.apply(gomoku.initialState(), { row: 7, col: 7 });
expect(gomoku.legalMoves(s)).toHaveLength(BOARD_SIZE * BOARD_SIZE - 1);
```

The expected counts are derived from `BOARD_SIZE` rather than written as literal
`225` / `224`. This asserts the *rule* ("one entry per empty square") instead of
a specific number, so changing the board to 19×19 does not require touching the
test.

Prefer this style anywhere a value is a consequence of a constant. Reserve
literal numbers for cases where the exact value is itself the thing being
specified.

### `toHaveLength`

`expect(x).toHaveLength(n)` is a vitest matcher asserting `x.length === n`. It
works on arrays and strings. It is preferred over
`expect(x.length).toBe(n)` because the failure message reports the actual
collection, not just a mismatched integer.

## Running the tests

From the repo root:

```bash
npm test --workspace shared            # watch mode, reruns on save
npm test --workspace shared -- run     # single run, exits when done
```

Everything after `--` is forwarded to `vitest` itself. Note that `--workspace`
here is npm's flag for selecting a package; vitest has an unrelated flag of the
same name, so do not pass it directly to `npx vitest`.

To focus a single test, work from inside the package:

```bash
cd shared
npx vitest run -t "lists every empty square"   # -t matches the it(...) name
```
