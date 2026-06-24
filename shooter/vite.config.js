import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.js',
      name: 'ShooterGame',
      formats: ['iife'],
      fileName: () => 'bundle.js'
    }
  }
});
