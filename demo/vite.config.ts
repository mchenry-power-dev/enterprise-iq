import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/enterprise-iq/', plugins: [react()],
  define: { __RELEASE__: JSON.stringify(process.env.GITHUB_SHA || 'local-development') },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022', sourcemap: false }
});
