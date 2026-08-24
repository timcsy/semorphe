// **不經 Vite 的建置**——這正是這個例子要證明的事。
// esbuild 不認識 `import.meta.glob`（那是 Vite 的轉換），所以任何依賴它的
// 載入路徑，在這裡會安靜地變成「一顆膠囊都沒有」。
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const result = await build({
  entryPoints: [join(here, 'src/main.ts')],
  outfile: join(here, 'dist/main.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  loader: { '.json': 'json', '.wasm': 'file' },
  external: ['web-tree-sitter'],
  logLevel: 'silent',
  metafile: true,
})
const warn = result.warnings.filter((w) => !/could not be bundled/.test(w.text))
if (warn.length) console.error(JSON.stringify(warn.map((w) => w.text)))
console.error('built')
