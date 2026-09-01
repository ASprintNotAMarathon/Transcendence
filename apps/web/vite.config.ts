/*
Vite is a BUILD TOOL or a BUNDLER. It sits between the code we write and what the browser receives,
because the browser cannot run TypeScript or JSX.

vite.config.ts is the instructions for the Vite tool.
*/

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* 
this is where the api is, as host:port.
Inside compose the service name is 'localhost', and localhost inside of container means that container.
so proxying to localhost:3000 would search for the api inside of the web container.
Outside of compose (npm run dev) the default is right
*/
const apiHost = process.env.API_HOST ?? 'localhost:3000'

export default defineConfig({
  plugins: [react()],

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

