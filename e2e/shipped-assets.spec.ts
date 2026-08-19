/**
 * **第四十六條護欄**：出貨的每一個 wasm，都要有人真的去要它。
 *
 * ## 它從哪來
 *
 * 2026-08-17 查 `tree-sitter-c` 那條懸案（`draft/C和C++難分難捨`§四①：
 * 「裝了，而完全沒有被接上」）時量到的：
 *
 * ```
 * public/ 有 4 個 wasm，dist/ 也出貨 4 個
 * 而瀏覽器真的請求的只有 2 個
 * 🔴 tree-sitter-c.wasm  630 KB   零請求
 * 🔴 tree-sitter.wasm    192 KB   零請求
 * ```
 *
 * **822 KB 每一個使用者都要下載，而沒有任何東西會去要它。**
 * ⚠️ 它們是**專案第一個 commit**（`2584980` 初始化）放進來的——
 * 躺了整個專案的生命週期。
 *
 * ## 🔴 而靜態掃描【殺不掉它們，也會殺錯】
 *
 * `grep public/*.wasm` 的結果是：
 *
 * ```
 * tree-sitter-cpp.wasm    141 處引用
 * web-tree-sitter.wasm      0 處   ← 🔴 而它【是活的】
 * tree-sitter-c.wasm        0 處
 * tree-sitter.wasm          0 處
 * ```
 *
 * `web-tree-sitter.wasm` 是 `Parser.init({ locateFile })` **在執行期組出檔名**的
 * （`src/languages/cpp/parser.ts:23`）——**原始碼裡根本沒有那個字串**。
 *
 * > **一個靠靜態掃描判定「沒有人用」的清理，會同時漏掉死的、殺掉活的。**
 *
 * → 所以這條護欄量的是**瀏覽器真的發出去的請求**，與第四十五條同一個判準。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「出貨的 wasm 數量」低於下限，代表 build 沒跑或 dist 是空的，
 * > 這份報表不算數——不是「死資產清光了」。**
 *
 * 錨在**出貨數量**（合成量）：清掉一個死資產**會**讓它變小，所以
 * ⚠️ 下限刻意設在 **1**——它只擋「完全沒東西」，不擋清理。
 * 🔴 **刻意不錨在「死資產數」**，那正是要推向零的。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？   ❌ 「不讓使用者下載用不到的東西」留一個例外就是假的
 * 修一筆要付多少？       便宜——刪一個檔
 * 別台機器一樣嗎？       ✅ 請求攔在瀏覽器裡
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 JS／CSS 的死程式碼**——只看 `.wasm`（大的那些）
 * - **不檢測「被請求的東西有沒有用到」**——請求了就算數
 * - ⚠️ **不檢測懶載入到【這支沒走到的路徑】的資產**：
 *   若哪天有一個 wasm 只在某個面板開啟時才要，這支會誤判它是死的。
 *   **那時要擴充這支的操作，不是放寬判準。**
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test('★ 出貨的每一個 wasm，都要有人真的去要它', async ({ page }) => {
  const asked = new Set<string>()
  page.on('request', (r) => {
    const u = r.url()
    if (u.endsWith('.wasm')) asked.add(u.split('/').pop()!)
  })

  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 },
  )
  // 🔴 **必須逼它真的解析一次**——parser 是懶載入的，
  // 只開頁面的話 `tree-sitter-cpp.wasm` 也不會被請求。
  await page.evaluate(() =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } })
      .__app.codeView.setCode('int main(){ cout << 1; }'))
  await page.getByText('程式碼→積木').click()
  await page.waitForTimeout(2500)

  const shipped = fs.readdirSync(path.join(process.cwd(), 'dist'))
    .filter((f) => f.endsWith('.wasm'))

  // ★ 入口條件——錨在**出貨數量**（合成量），見檔頭的自我否證
  expect(
    shipped.length,
    `dist/ 裡一個 wasm 都沒有 → build 沒跑，這份報表不算數。` +
      `⚠️ 這不代表「死資產清光了」。`,
  ).toBeGreaterThanOrEqual(1)

  const dead = shipped.filter((f) => !asked.has(f))
  expect(
    dead,
    `🔴 出貨了而沒有人去要——每一個使用者都在下載它們：\n  ${dead.join('\n  ')}\n` +
      `⚠️ 而【不要用 grep 判定】：web-tree-sitter.wasm 的檔名是執行期組出來的，\n` +
      `原始碼裡沒有那個字串，靜態掃描會把一個活的資產殺掉。`,
  ).toEqual([])
})
