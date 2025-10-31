import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  optimizeDeps: {
    include: ['llm-schema', 'llm-schema/react']
  },
  ssr: {
    noExternal: ['llm-schema']
  }
});
