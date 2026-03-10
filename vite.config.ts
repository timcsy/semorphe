import { defineConfig } from 'vite'

export default defineConfig({
  base: '/semorphe/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
})
