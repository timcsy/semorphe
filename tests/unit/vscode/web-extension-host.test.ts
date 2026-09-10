/**
 * **第一百二十一條護欄：網頁版的 VS Code 也要打得開。**
 *
 * ## 🔴 使用者在 Codespaces 撞到（2026-09-10）
 *
 * ```
 * command 'semorphe.openBlocks' not found
 * ```
 *
 * 指令沒被註冊，因為**擴充根本沒有啟動**：manifest 只宣告了 `main`，
 * 而那是給 **node 擴充主機**的。vscode.dev／github.dev／瀏覽器裡的
 * Codespaces 用的是 **web worker 擴充主機**——它只讀 `browser` 那一格。
 *
 * > **一個只宣告了 `main` 的擴充，在網頁版裡不是「壞掉」——
 * > 它是【不存在】，而畫面上只看得到一句「找不到那個指令」。**
 *
 * 🟢 而這份程式碼**本來就跑得動**：`src/vscode/` 底下一個 node 內建都沒用到。
 * 所以那是建置的事，不是重寫——而**沒有人發現，因為沒有人在網頁版裡開過**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不驗它在網頁版裡真的跑得起來**——那要一個真的網頁版 VS Code：
 *   ```
 *   npx @vscode/test-web --extensionDevelopmentPath=build/vscode <資料夾>
 *   ```
 *   （2026-09-10 用它實測過：指令找得到、面板開得起來、打字同步得到積木。）
 * - ⚠️ 這一條守的是**必要條件**：宣告在、產物在、而且產物裡沒有 node 的東西。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../../helpers/guardrail'
import { buildManifest } from '../../../src/vscode/manifest'

const manifest = buildManifest() as unknown as Record<string, unknown>
const WEB_OUT = path.join(REPO_ROOT, 'build/vscode/dist/extension.web.js')

describe('第一百二十一條護欄：網頁版的擴充主機', () => {
  it('🔴 manifest 兩個進入點都要有', () => {
    expect(manifest.main, '🔴 少了 main → 桌面版不會啟動').toBe('./dist/extension.js')
    expect(
      manifest.browser,
      '🔴 少了 browser → 網頁版的 VS Code 只會說「找不到那個指令」',
    ).toBe('./dist/extension.web.js')
  })

  /** ⚠️ 兩份產物的 `platform` 不同，共用一個檔會在 worker 裡執行期才炸。 */
  it('🔴 兩個進入點不得是同一個檔', () => {
    expect(manifest.browser).not.toBe(manifest.main)
  })

  it('🔴 建置腳本要真的跑那個目標', () => {
    const build = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/build-vscode.ts'), 'utf8')
    expect(build, '🔴 建置沒有跑 extension-web → manifest 指向一個不存在的檔')
      .toContain("SEMORPHE_VSCODE_TARGET: 'extension-web'")
    const vite = fs.readFileSync(path.join(REPO_ROOT, 'vite.vscode.config.ts'), 'utf8')
    expect(vite).toContain("target === 'extension-web'")
    expect(vite, '🔴 網頁版產物的檔名要與 manifest 對得上')
      .toContain("entryFileNames: 'extension.web.js'")
  })

  /**
   * 🔴 **`src/vscode/` 不得用 node 內建**——用了的話網頁版就真的要重寫。
   *
   * ⚠️ 這一條**現在守的是未來**：今天是零，而下一個人加一行 `import fs`
   * 不會有任何東西出聲，直到有人在網頁版裡打開它。
   */
  it('🔴 硬性零：擴充那一側不得 import node 內建', () => {
    const bad: string[] = []
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name)
        if (e.isDirectory()) { walk(f); continue }
        if (!/\.ts$/.test(e.name)) continue
        // ⚠️ webview 那一側是瀏覽器程式，本來就不會有——一起掃，成本是零
        const src = fs.readFileSync(f, 'utf8')
        for (const m of src.matchAll(/from\s+'(node:[a-z_]+|fs|path|os|child_process|worker_threads)'/g)) {
          bad.push(`${path.relative(REPO_ROOT, f)} → ${m[1]}`)
        }
      }
    }
    walk(path.join(REPO_ROOT, 'src/vscode'))
    expect(
      bad,
      '🔴 擴充那一側用了 node 內建——網頁版的 worker 裡沒有它，\n'
        + '   而症狀是執行期才炸（畫面上只看得到「找不到那個指令」或一片空白）。',
    ).toEqual([])
  })

  // ─── 產物（建過才驗——⚠️ 沒建過不得**默默跳過**，見下）───

  it.skipIf(!fs.existsSync(WEB_OUT))('🔴 產物裡沒有 node 的東西', () => {
    const js = fs.readFileSync(WEB_OUT, 'utf8')
    for (const bad of ['require("fs")', "require('fs')", '__dirname', 'node:', 'process.env']) {
      expect(js.includes(bad), `🔴 網頁版產物裡有 ${bad}——worker 裡跑不動`).toBe(false)
    }
    expect(js, '🔴 worker 擴充主機靠 `module.exports` 拿 activate')
      .toMatch(/exports\.activate|module\.exports/)
  })

  /**
   * ★ **「還沒建」與「建壞了」要分得出來。**
   *
   * ⚠️ 上面那一條在沒建過時跳過——而**跳過不得是靜默的**：
   * 一條在 CI 上永遠跳過的檢查，與一條不存在的檢查是同一個東西。
   * 🟢 CI 那一側由 `vsix.yml` 的產物體檢守（它 grep `extension.web.js`）。
   */
  it('★ 沒建過時，這裡說得出來', () => {
    if (!fs.existsSync(WEB_OUT)) {
      expect(
        fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/vsix.yml'), 'utf8'),
        '🔴 本機沒建、CI 也沒驗 → 那一格沒有任何人守',
      ).toContain('extension.web.js')
    }
    expect(true).toBe(true)
  })
})
