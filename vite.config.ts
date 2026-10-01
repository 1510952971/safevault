import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import packageInfo from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'safevault-build-info',
      closeBundle() {
        fs.writeFileSync(
          path.resolve('dist/build-info.json'),
          JSON.stringify({ name: packageInfo.name, version: packageInfo.version }, null, 2)
        );
      }
    }
  ],
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true
  }
});
