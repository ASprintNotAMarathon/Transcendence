/*
Vite is a BUILD TOOL or a BUNDLER. It sits between the code we write and what the browser receives,
because the browser cannot run TypeScript or JSX.

vite.config.ts is the instructions for the Vite tool.
*/

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* 
this is where the api is, as host:port.
The dev server runs on the host (npm run dev), not in a container,
and compose publishes the api on the host's localhost:3000.
*/
const apiHost = 'localhost:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    strictPort: true, //if 5173 is not available, fail and say so

    proxy: {
      '/api' : `http://${apiHost}`,
      '/ws' : {
        target: `ws://${apiHost}`, //when the upgrade completes, connection is done speaking http, and we start speaking WebSocket
        ws: true, //the opt-in: this tells Vite to handle upgrade requests on this path, and once it's upgraded, to pipe bytes both ways
      },
    },
  },
})

