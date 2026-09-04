# @transcendence/web

React frontend, built with Vite.

## Running it

From the repo root:

    npm run dev --workspace @transcendence/web

Served on http://localhost:5173. The dev server proxies `/api` and `/ws` to
the API on port 3000 — see `vite.config.ts`. Without something listening
there, those paths return errors; everything else works.


## State

App shell in place: `PublicLayout` (landing, login, register) and
`AppLayout` (authenticated screens, header with nav/profile/logout) as
nested layout routes. Login and register forms validate client-side but
don't post anywhere yet — that lands with #23.

Styling: Tailwind + daisyUI. Brand colors live in a single daisyUI theme
in `index.css` (`gomoku`); everything else references those theme tokens
instead of repeating hex values. See the comment at the top of `index.css`
for the reasoning, and `style-guide.svg` for a visual reference.

Reusable components live in `src/components` (`PrimaryButton`, `PrimaryLink`,
`EmptyState`, `LoadingState`, `ErrorState`).