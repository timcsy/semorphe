// 用 esbuild 建這個例子——**不經 Vite**（與 bring-your-own-view 同一個證明）。
// Blockly 與 tree-sitter 留外部：Blockly 是 peer，tree-sitter 要載 .wasm、路徑由宿主決定。
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
await build({
  entryPoints: [join(here, 'src/assemble.ts')],
  outfile: join(here, 'dist/assemble.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['web-tree-sitter', 'blockly', 'blockly/*', '@blockly/*'],
  logLevel: 'silent',
})
console.error('built')
