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
    const ev = { diagnostics: [{ nodeId, severity: 'warning' as const, rule: 'MISSING_CONDITION', params: { inputName: 'CONDITION' } }] }
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

/**
 * **同一則診斷，兩個面板必須說不一樣的話。**（階段 6.6 驗收④）
 *
 * ⚠️ 上一支測的是「兩邊都收得到」——而**兩邊收到之後說同一句話，它照樣綠**。
 * 這一支就是為了讓那個狀態紅。
 *
 * 使用者 2026-08-12 逐字：「越像實際編譯器吐出的訊息越好……**不過積木側可以不一樣**」。
 *
 * ## 為什麼問 `diagnosticMessage()` 而不是讀畫面
 *
 * Monaco 的 marker 訊息只在**滑鼠移上去**時才進 DOM，而 Blockly 12 沒有
 * `getWarningText()`（上一支的註解記過這個坑）。
 * `diagnosticMessage()` **就是渲染路徑上的那一步**——`onDiagnostics` 自己呼叫它，
 * 所以問它不是問一個旁路。
 */
test('同一則診斷在兩個面板產出不同的訊息', async ({ page }) => {
  await freshApp(page)

  const r = await page.evaluate(() => {
    const app = (window as never as { __app: any }).__app
    const bp = app.blocklyPanel
    const mp = app.monacoPanel
    const d = { nodeId: 'n-does-not-matter', severity: 'warning' as const, rule: 'MISSING_CONDITION', params: { inputName: 'CONDITION' } }
    return {
      hasBoth: Boolean(bp?.diagnosticMessage && mp?.diagnosticMessage),
      block: bp?.diagnosticMessage?.(d),
      code: mp?.diagnosticMessage?.(d),
    }
  })

  // ★ 入口條件：錨在**兩個面板都答得出話**（合成量），不錨在「不同」
  //   ——「不同」正是這支要推動的東西，拿它當入口條件會讓測試自我實現。
  expect(r.hasBoth, '有面板沒有 diagnosticMessage → 這支測不到任何東西').toBe(true)
  expect(r.block, '積木側組不出訊息').toBeTruthy()
  expect(r.code, '程式碼側組不出訊息').toBeTruthy()
  expect(r.block, '積木側把原始規則代號當訊息顯示了').not.toContain('MISSING_CONDITION')
  expect(r.code, '程式碼側把原始規則代號當訊息顯示了').not.toContain('MISSING_CONDITION')

  expect(
    r.code,
    '🔴 **兩個面板說了同一句話**——這是驗收④：\n' +
      '積木側該給初學者看得懂的說法，程式碼側該像編譯器。\n' +
      `實際上兩邊都是「${r.block}」。`,
  ).not.toBe(r.block)
})

/**
 * **少一個分號要是【錯誤】，不是一條灰色的提示。**（階段 6.6 驗收 4.5）
 *
 * ## 為什麼這一支比前兩支重要
 *
 * 前兩支測的是「空插槽」——而**空插槽是積木側才存在的狀態**，
 * 學生要拖錯積木才會遇到。少一個分號是**每個人第一週都會撞**的。
 *
 * 而它今天走的是**殘差通道**：`MarkerSeverity.Info` ＋ owner `semorphe-residual`，
 * 訊息說「這一段的語法不完整」。**上一輪做好的整套診斷機制，一點都沒套到它身上。**
 *
 * ## 用 DOM 的 class 驗，而不是問 API
 *
 * Monaco 依 severity 給不同的 class：`squiggly-error` / `squiggly-warning` /
 * `squiggly-info`。**那正是使用者眼睛看到的東西**，而 `window.monaco` 不存在
 * （這個專案沒有把它掛上全域）。
 */
test('少一個分號 → 程式碼面板出現【錯誤級】波浪', async ({ page }) => {
  await freshApp(page)

  await page.evaluate(() => {
    const app = (window as never as { __app: any }).__app
    // ⚠️ 少了 `int x = 1` 後面那個分號——第一週最常見的那個錯
    // ⚠️ **樣本是挑過的，而挑的理由要留下來。**
    // 實測三種「少分號」的形狀，只有這一種今天會被 lift 標記：
    // ```
    // int x = 1 ⏎ return 0;     → 樹上【沒有】 degradationCause  ❌
    // int x = 1 ⏎ cout << x;    → cpp:var_declare/syntax_error   ✅ 用這個
    // int x = 1 ⏎ int y = 2;    → 樹上【沒有】 degradationCause  ❌
    // ```
    // 那是**辨識那一層的涵蓋缺口**（驗收③ 的範圍），不是本支要測的東西
    // ——本支測的是「已經被標記的語法錯誤，有沒有走診斷通道」。
    // 🔴 而那個缺口本身要另外追，見 `knowledge/history/063`。
    app.monacoPanel?.setCode('#include <iostream>\nusing namespace std;\nint main() {\n    int x = 1\n    cout << x;\n    return 0;\n}\n')
  })
  await page.getByText('程式碼→積木').click()
  await page.waitForFunction(
    () => ((window as never as { __app: any }).__app?.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? 0) > 0,
    undefined, { timeout: 30_000 },
  )
  await page.waitForTimeout(800)

  const seen = await page.evaluate(() => ({
    any: document.querySelectorAll('[class*=squiggly]').length,
    error: document.querySelectorAll('.squiggly-error').length,
    info: document.querySelectorAll('.squiggly-info').length,
  }))

  // ★ 入口條件：錨在**有沒有標記**（合成量），不錨在 severity
  //   ——severity 正是這支要推動的東西，拿它當入口條件會讓測試自我實現。
  expect(seen.any, '程式碼面板一個標記都沒有 → 這支測不到任何東西').toBeGreaterThan(0)

  expect(
    seen.error,
    '🔴 **少一個分號沒有被當成錯誤**——這是驗收 4.5：\n' +
      '它今天走殘差通道（Info 級、灰色），而那條通道的主詞是「我還不認得」。\n' +
      '⚠️ 語法錯誤是【使用者寫壞了】，不是【我們沒長到】。\n' +
      `實際上：error ${seen.error} 個、info ${seen.info} 個。`,
  ).toBeGreaterThan(0)

  // 🔴 **而它不可以【同時】還留在殘差通道裡。**
  //
  // `renderResidual` 對任何 `degradationCause` 都畫一條 Info 級的灰提示。
  // 濾網拿掉的話，同一行會有【一條紅波浪疊一條灰提示】——而兩者說的是同一件事。
  //
  // ⚠️ 這條斷言是注入驗過的：把 `monaco-panel` 的 `isResidualCause(cause)`
  // 改回 `cause`，它就會紅。
  expect(
    seen.info,
    '🔴 同一個語法錯誤【同時】走了診斷通道與殘差通道——一條紅波浪疊一條灰提示。\n' +
      '`renderResidual` 的濾網掉了：`syntax_error` 已經搬去診斷了，它不該再被畫成殘差。',
  ).toBe(0)
})

