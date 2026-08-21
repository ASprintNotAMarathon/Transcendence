/*
Vite is a BUILD TOOL or a BUNDLER. It sits between the code we write and what the browser receives,
because the browser cannot run TypeScript or JSX.

vite.config.ts is the instructions for the Vite tool.
*/

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: true, //if 5173 is not available, fail and say so

    proxy: {
      '/api' : 'http://localhost:3000',
      '/ws' : {
        target: 'ws://localhost:3000', //when the upgrade completes, connection is done speaking http, and we start speaking WebSocket
        ws: true, //the opt-in: this tells Vite to handle upgrade requests on this path, and once it's upgraded, to pipe bytes both ways
      },
    },
  },
})

