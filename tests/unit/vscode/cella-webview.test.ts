/**
 * **擴充的 webview 起 Cella worker 的那一段**（spec 198，重構階段 6a）。
 *
 * blob 裡的 classic worker 要先設好資產根、再 `importScripts` 那份打包；兩個網址都必須是**絕對的**
 * ——blob worker 裡的相對網址是對 `blob:` 解析的（預檢頁的根是 `./`，第一版就是這樣載不到）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { cellaWorkerBootstrap } from '../../../src/vscode/webview/cella'
import { csp } from '../../../src/vscode/webview-html'

describe('擴充的 webview 起 Cella worker', () => {
  it('★ 先設資產根（dist/cella/），再載同一支 worker 的打包（dist/cella-worker.js）', () => {
    const s = cellaWorkerBootstrap('https://x.vscode-cdn.net/ext/dist/')
    expect(s.indexOf('__SEMORPHE_CELLA_BASE__')).toBeLessThan(s.indexOf('importScripts'))
    expect(s).toContain('"https://x.vscode-cdn.net/ext/dist/cella/"')
    expect(s).toContain('importScripts("https://x.vscode-cdn.net/ext/dist/cella-worker.js")')
  })

  it('🔴 CSP 放行 blob 的 worker——少了它 worker 起不來，判決一直是「載入中」', () => {
    expect(csp('vscode-resource:')).toMatch(/worker-src blob:/)
  })

  it('🔴 擴充那份 worker 讀資產走執行期的根（glob 在死分支裡被搖掉）——lib 模式會把 45 MB 內嵌成 base64', () => {
    expect(fs.readFileSync('vite.vscode.config.ts', 'utf8')).toMatch(/SEMORPHE_CELLA_RUNTIME_ASSETS/)
    expect(fs.readFileSync('src/providers/cella/assets.ts', 'utf8')).toMatch(/RUNTIME_ASSETS \? \{\} : import\.meta\.glob\(/)
  })
})
