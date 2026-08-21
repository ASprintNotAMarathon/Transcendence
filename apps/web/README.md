# @transcendence/web

React frontend, built with Vite.

## Running it

From the repo root:

    npm run dev --workspace @transcendence/web

Served on http://localhost:5173. The dev server proxies `/api` and `/ws` to
the API on port 3000 — see `vite.config.ts`. Without something listening
there, those paths return errors; everything else works.

## State

Scaffold only. One placeholder route at `/`. No interface yet, and no styling
decision made — `index.css` is deliberately near-empty pending the CSS
framework choice.