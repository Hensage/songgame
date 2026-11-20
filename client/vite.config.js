import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Not PORT: tools that start the dev server set that to the Vite port itself.
const API_PORT = process.env.API_PORT ?? 3000;
const target = `http://localhost:${API_PORT}`;
const apiRoutes = [
  '/getGames',
  '/joinGame',
  '/leaveGame',
  '/closeGame',
  '/login',
  '/callback',
  '/search',
  '/loadinfo',
  '/update',
  '/remove',
  '/submit',
  '/clear',
  '/add',
];

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: Object.fromEntries(apiRoutes.map((route) => [route, target])),
  },
});
