import { defineConfig } from 'vite'

export default defineConfig({
  base: '/code-blockly/',
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
