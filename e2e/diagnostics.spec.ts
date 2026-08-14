/**
 * **一則診斷要同時到達兩個視圖。**
 *
 * ## 這一支釘住的是什麼
 *
 * 階段 6.6 的驗收 ①②：錨點是 `nodeId`、而 **Monaco 收得到**。
 * 後者是前者的**可否證版本**——錨點還是 `blockId` 的話這一條做不到，
 * 因為 Monaco 不認識 blockId。
 *
 * ⚠️ 所以這支測的**不是「有沒有警告」**，是**「同一則診斷有沒有出現在兩邊」**。
 * 只驗積木側的話，錨點退回 `blockId` 它照樣綠。
 *
 * ## 為什麼從 `window.__app` 廣播，而不是拖積木製造一個真的診斷
 *
 * 驗收 ①② 說的是**廣播的契約**（誰收得到），不是**規則的正確性**
 * （那 4 條規則在 `tests/unit/core/diagnostics.test.ts` 有覆蓋）。
 * 從契約那一層進去，這支就不會因為「規則改了」而假紅。
 *
 * ⚠️ 而它因此**測不到**「app 真的會在積木變動時跑診斷」——
 * 那是另一條線，今天沒有防線。**寫在這裡，不讓它假裝做了。**
 */
import { test, expect, type Page } from '@playwright/test'

async function freshApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
  // 等 Monaco 的 model 起來——沒有它 `setModelMarkers` 無處可掛
  await page.waitForFunction(() => Boolean((window as never as { __app?: { monacoPanel?: { editor?: unknown } } }).__app?.monacoPanel?.editor), undefined, { timeout: 30_000 })
}

test('一則診斷同時出現在積木側與程式碼側', async ({ page }) => {
  await freshApp(page)

  // ⚠️ **全新狀態的工作區是空的**——入口條件第一次跑就擋下了這件事
  // （「一顆積木都沒有 → 這支測不到任何東西」）。先放一段程式碼進去。
  await page.evaluate(() => {
    const app = (window as never as { __app: any }).__app
    app.monacoPanel?.setCode('using namespace std;\nint main() {\n    int x = 1;\n    return 0;\n}\n')
  })
  // ⚠️ **`setCode` 不會觸發同步**——它只換文字。走使用者真的走的那條路：
  // 點「程式碼→積木」。（第一版只 setCode 就等，等了 30 秒零顆積木。）
  await page.getByText('程式碼→積木').click()
  await page.waitForFunction(
    () => ((window as never as { __app: any }).__app?.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? 0) > 0,
    undefined, { timeout: 30_000 },
  )

  const before = await page.evaluate(() => {
    const app = (window as never as { __app: any }).__app
    const bp = app.blocklyPanel
    const blocks = bp.workspace.getAllBlocks(false)
    return { blockCount: blocks.length, mappings: bp._blockMappings?.length ?? 0 }
  })

  // ★ 入口條件：錨在**積木數與對映數**（合成量），不錨在「有沒有警告」
  expect(before.blockCount, '工作區一顆積木都沒有 → 這支測不到任何東西').toBeGreaterThan(0)
  expect(before.mappings, 'nodeId ↔ blockId 的對映是空的 → 廣播無處可去，這支不算數').toBeGreaterThan(0)

  const seen = await page.evaluate(async () => {
    const app = (window as never as { __app: any }).__app
    const bp = app.blocklyPanel
    const mp = app.monacoPanel
    const first = bp.workspace.getAllBlocks(false)[0]
    const nodeId = bp._blockMappings.find((m: { blockId: string }) => m.blockId === first.id)?.nodeId
    const ev = { diagnostics: [{ nodeId, severity: 'warning' as const, message: 'DIAG_MISSING_CONDITION' }] }
    bp.onDiagnostics?.(ev)
    mp.onDiagnostics?.(ev)
    await new Promise((r) => setTimeout(r, 600))
    return {
      nodeId,
      // ⚠️ **用 DOM 驗，不用 API**：Blockly 12 沒有 `getWarningText()`，
      // 而第一版用它——**讀不回來被讀成「沒生效」**，差點去改一段本來就對的程式碼。
      blockSide: document.querySelectorAll('.blocklyIconGroup, .blocklyWarningIconSymbol').length,
      codeSide: document.querySelectorAll('[class*=squiggly]').length,
    }
  })

  expect(seen.nodeId, '找不到第一顆積木的 nodeId → 對映壞了').toBeTruthy()
  expect(seen.blockSide, '積木側沒有警告圖示').toBeGreaterThan(0)
  expect(
    seen.codeSide,
    '🔴 **程式碼側沒有波浪**——這是驗收②，而它是①的可否證版本：\n' +
      '錨點退回 `blockId` 的話 Monaco 收不到（它不認識 blockId），這一條就會紅。',
  ).toBeGreaterThan(0)
})
