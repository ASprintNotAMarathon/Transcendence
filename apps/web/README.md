# @transcendence/web

React frontend, built with Vite.

## Running it

From the repo root:

    npm run dev --workspace @transcendence/web

Served on http://localhost:5173. The dev server proxies `/api` and `/ws` to
the API on port 3000 — see `vite.config.ts`. Without something listening
there, those paths return errors; everything else works.

Note: This is the development server only. The real app runs behind nginx over
HTTPS after `make up`, on https://localhost:8443.

## Design system

Colours and sizes live as theme tokens in one daisyUI theme in `index.css`
(`gomoku`); screens reference those tokens instead of repeating hex values.
The comment at the top of `index.css` explains the reasoning and lists the
type scale. Reusable components live in `src/components`.

Open `/design` in the running app to see the palette, the type scale, the
icons and every component together.