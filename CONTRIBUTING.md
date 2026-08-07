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

<category>/<issue-number>-<short-description>

Lowercase, kebab-case.

feat/12-gomoku-engine
fix/34-reversi-flip-direction
chore/7-eslint-config
docs/19-api-contract

Branch off `main`. Delete the branch after merging.

## Commits

<category>: <what changed, imperative>

feat: add five-in-a-row win detection
fix: correct diagonal flip direction in reversi
chore: add vitest config

Present tense, lowercase after the colon, no trailing period. If you need more than one line, leave a blank line and explain *why* in the body.

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
