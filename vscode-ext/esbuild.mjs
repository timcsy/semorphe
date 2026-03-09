import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

const isWatch = process.argv.includes('--watch')

// Copy WASM files from public/ to dist/
const wasmFiles = [
  'tree-sitter.wasm',
  'tree-sitter-cpp.wasm',
  'web-tree-sitter.wasm',
]

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true })
}

for (const file of wasmFiles) {
  const src = path.join('..', 'public', file)
  const dest = path.join('dist', file)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log(`Copied ${file} to dist/`)
  }
}

// Copy Blockly media from node_modules
const blocklyMediaSrc = path.join('..', 'node_modules', 'blockly', 'media')
const blocklyMediaDest = path.join('dist', 'media')
if (fs.existsSync(blocklyMediaSrc)) {
  fs.cpSync(blocklyMediaSrc, blocklyMediaDest, { recursive: true })
  console.log('Copied Blockly media to dist/media/')
}

// Extension Host bundle (Node.js, CJS)
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  external: ['vscode', 'web-tree-sitter'],
  sourcemap: true,
  target: 'node18',
  // Resolve imports from parent src/
  alias: {
    '@core': '../src/core',
    '@languages': '../src/languages',
    '@blocks': '../src/blocks',
  },
}

// WebView bundle (Browser, IIFE)
const webviewConfig = {
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  outfile: 'dist/webview/main.js',
  platform: 'browser',
  format: 'iife',
  sourcemap: true,
  target: 'es2022',
  alias: {
    '@core': '../src/core',
    '@languages': '../src/languages',
    '@blocks': '../src/blocks',
    '@ui': '../src/ui',
  },
}

async function build() {
  try {
    if (isWatch) {
      const extCtx = await esbuild.context(extensionConfig)
      const webCtx = await esbuild.context(webviewConfig)
      await Promise.all([extCtx.watch(), webCtx.watch()])
      console.log('Watching for changes...')
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig),
      ])
      console.log('Build complete.')
    }
  } catch (e) {
    console.error('Build failed:', e)
    process.exit(1)
  }
}

build()
