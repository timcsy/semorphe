/**
 * e2e 的共用步驟。
 *
 * ⚠️ 每一個 helper 都**自己斷言它做到了**，而不是「做完就往下走」。
 * 理由來自這批測試的緣起：手動驗證失敗時，最貴的不是失敗，是
 * **分不出「前置條件沒成立」與「被測的東西壞了」**。
 *
 * > **一個看不見自己前置條件有沒有成立的測試，失敗時說不出任何事。**
 */
import { expect, type Page } from '@playwright/test'

/** 乾淨啟動。⚠️ 專案存在 localStorage，上一支的存檔會餵給下一支。 */
export async function freshApp(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await expect(page.locator('.injectionDiv').first()).toBeVisible({ timeout: 30_000 })
}

/**
 * 乾淨開一次，**而後面的 `page.reload()` 不會再清掉存檔**。
 *
 * 🔴 `freshApp` 用的是 `addInitScript`，而那個腳本**每一次載入都跑**
 * ——包括 `page.reload()`。所以任何「存了 → 重新整理 → 還在嗎」的測試，
 * 用 `freshApp` 會被它自己清掉，而症狀是「還原之後是空的」，
 * 看起來像產品壞了。
 *
 * > **一個「每次載入都重置」的前置動作，讓「重新整理之後還在嗎」問不出來。**
 *
 * ⚠️ 這一支改成**只清一次**（進站前清，之後不再掛腳本）。
 */
export async function appKeepingStorage(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.locator('.injectionDiv').first()).toBeVisible({ timeout: 30_000 })
}

/**
 * 打程式碼並讓它變成規範格式。
 *
 * ⚠️ **一定要打單行**：多行輸入會被 Monaco 的自動補括號弄壞
 * ——實測第一版打多行，lift 出來是 `raw_code`，
 * 而錯誤訊息（`RUNTIME_ERR_UNKNOWN_COMPONENT`）看起來像產品的 bug。
 *
 * 打完之後**以積木為準**讓它重新產生：那一步同時
 * ① 把單行攤成多行（行號才有意義）
 * ② 走一次 `resync`，確保 `codeMappings` 是當前的
 */
export async function typeAndFormat(page: Page, oneLineCode: string): Promise<void> {
  // 🔴 **用 API 設值 ＋「以此為準：程式碼」，不用鍵盤做整份取代。**
  //
  // 2026-08-31 之前這裡是「click → Cmd+A → 打字」，而它**只在編輯器本來是空的
  // 時候成立**。開機不同步那一刀修好之後，第一次打開就有骨架，於是：
  //
  // ```
  // 選全 → 打第一個字元 → 整份被取代 → code→blocks 觸發
  //      → 積木還是舊的那棵 → 骨架回寫進來 → 剩下的字元打在它中間
  // ```
  //
  // 實測結果（兩輪，第二輪壞）：
  // `int main() {\n    return 0;\nint main() { int total = 0; ...`
  //
  // ⚠️ **加等待救不了它**：試過「先刪光 → 等 1.2 秒 → 再選一次 → 打」，
  //    兩輪裡仍然壞一輪——刪光之後程式碼**會自己回來**（網頁版沒有檔案，
  //    積木就是真相），而它回來的時機不固定。
  //
  // > **只要另一邊會自動回寫，用鍵盤做「整份取代」就不是原子的
  // > ——那不是等待長度的問題，是它中間必然有一瞬間是空的。**
  //
  // 🟢 而「用鍵盤才觸發得了 code→blocks」這個理由已經不成立：
  //    `useAsSource(page, '程式碼')` 就是那個觸發器，而且是明確的一次。
  await page.evaluate((c) => (window as never as { __app: { codeView: { setCode(s: string): void } } }).__app.codeView.setCode(c), oneLineCode)
  await useAsSource(page, '程式碼')
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })

  await useAsSource(page, '積木')
  // 攤成多行了 ＝ 行數超過 1
  await expect(page.locator('.view-line').nth(5)).toBeVisible({ timeout: 10_000 })
}

/** 目前編輯器裡每一行的文字，**依行號排序**（DOM 順序不等於行順序）。 */
export async function codeLines(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const lines = [...document.querySelectorAll('.view-lines .view-line')] as HTMLElement[]
    return lines
      .map((el) => ({ top: parseInt(el.style.top || '0', 10), text: el.textContent ?? '' }))
      .sort((a, b) => a.top - b.top)
      // ⚠️ Monaco 用 **不斷行空格**（`\xa0`）渲染縮排與詞間空白。
      // 直接 `includes('total = total + i')` 永遠找不到——而症狀是
      // 「前置條件沒成立」，看起來像應用壞了。
      .map((x) => x.text.replace(/\u00a0/g, ' '))
  })
}

/**
 * ▶ 執行鈕。
 *
 * ⚠️ **用 id，不要用 class。** `.exec-btn.run` 同時匹配下拉箭頭
 * （它的 class 完全包含執行鈕的），而 `.first()` 會拿到**隱藏的 mobile 版本**
 * ——症狀是 `click` timeout 30 秒，看起來像應用沒回應。
 */
export function runButton(page: Page) {
  return page.locator('#run-btn')
}

/** 含指定文字的行號（1-based）。找不到回 -1。 */
export async function lineNumberOf(page: Page, needle: string): Promise<number> {
  const lines = await codeLines(page)
  return lines.findIndex((l) => l.includes(needle)) + 1
}

/**
 * 選一個執行模式，**而這一下就會開始執行**。
 *
 * ⚠️ 名字騙人，而騙的是產品的行為不是這個 helper：
 * `execution-controller.ts:204` 的選單 handler 在設好模式之後
 * **直接呼叫 `executeWithCurrentMode()`**。
 *
 * 選完再點一次執行鈕會是第二次執行——而第一次的 `#run-btn` 那時已經
 * 變成「停止」之類的狀態，於是 `click` 卡住 30 秒。
 *
 * > **一個按鈕做了兩件事時，測試會在第二件事上等第一件事的結果。**
 */
export async function selectMode(page: Page, mode: string): Promise<void> {
  await page.locator('#run-mode-btn').click()
  const option = page.locator(`.run-mode-option[data-mode="${mode}"]`)
  await expect(option).toBeVisible()
  await option.click()
  // ⚠️ 等選單收起來——它蓋在執行鈕上，而症狀是「點不到執行鈕」而不是「選單還開著」。
  await expect(option).toBeHidden()
}

/**
 * 在第 `line` 行設斷點，**並確認它真的設上了**。
 *
 * ⚠️ 第二句不可省。手動驗證時最大的坑正是這個：
 * **同一個座標點兩次等於沒設，而畫面上看不出差別**，
 * 於是「跑了但沒停」有兩種解釋而截圖分不出來。
 */
export async function setBreakpoint(page: Page, line: number): Promise<void> {
  const before = await page.locator('.breakpoint-glyph').count()
  // ⚠️ Monaco 從**座標**判斷這一下點在哪個 gutter 區塊（`GUTTER_GLYPH_MARGIN`），
  // 所以不能只 `.click()` 一個 locator——要點在 glyph margin 那一條上（行號左邊）。
  const row = page.locator('.margin-view-overlays > div').nth(line - 1)
  const box = await row.boundingBox()
  if (!box) throw new Error(`第 ${line} 行的 gutter 不在畫面上 → 前置條件沒成立`)
  await page.mouse.click(box.x + 5, box.y + box.height / 2)
  await expect(page.locator('.breakpoint-glyph')).toHaveCount(before + 1)
}

/** 一個有迴圈、輸出可預期（1+2+3=6）的程式。單行——見 `typeAndFormat`。 */
export const LOOP_PROGRAM =
  'int main() { int total = 0; for (int i = 1; i <= 3; i++) { total = total + i; } cout << total << endl; return 0; }'

/**
 * 走 UI 選一個控制項的值（目標／風格／語系……）。
 *
 * 🔴 **不要自己呼叫 `handleTargetChange`**——那會跳過控制項那一半，
 * 而這個專案已經撞過四次「機制有了沒人接上」。
 *
 * ⚠️ 2026-08-25 起這條路變了：那幾顆 `<select>` 退場，改成
 * **狀態列的文字項目 ＋ QuickPick**（`draft/版面與檔案` §六之四）。
 * 🔴 而 CI 的 e2e 是**唯一抓到這件事的東西**——單元測試與手動實測都放它過。
 */
export async function pickControlValue(page: Page, controlId: string, value: string): Promise<void> {
  await page.locator(`#status-controls .status-item-btn[data-control-id="${controlId}"]`).click()
  await page.locator(`.quick-pick-item[data-value="${value}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(900)
}

/** 選目標——最常用的那一個。 */
export async function selectTarget(page: Page, id: string): Promise<void> {
  await pickControlValue(page, 'target', id)
}

/**
 * 以某一邊為準，讓它重新產生另一邊。
 *
 * ## 🔴 為什麼不是按「程式碼→積木」
 *
 * 那兩顆**方向**按鈕已於 2026-08-25 退場——同步從「方向」（N²）
 * 換成「來源」（N），而第六十二條護欄守著它們不准回來。
 *
 * > **加第三個可編輯視圖時不必新增按鈕。**
 *
 * ⚠️ 而 e2e 是**唯一抓到 e2e 沒跟上的東西**：單元測試與手動實測
 * 都放它過了整整一天（CI 從 2026-08-25 00:20 起紅）。
 */
export async function useAsSource(page: Page, which: '程式碼' | '積木'): Promise<void> {
  await page.locator('#sync-menu-btn').click()
  await page.locator('.quick-pick-item').filter({ hasText: new RegExp(`以此為準：${which}`) }).first().click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForTimeout(600)
}

/* ────────────────────────────────────────────────────────────────
 * 等【條件】的助手——2026-08-31 那次量測之後長出來的。
 *
 * ## 為什麼是助手，不是逐處改
 *
 * 全庫原本有 **144 處** `waitForTimeout`（平均 1761ms），而它們**不是 144 個
 * 不同的判斷**——是少數幾種形狀重複很多次：
 *
 * ```
 * freshApp ＋ 1800~2500ms      等 app 起來
 * useAsSource ＋ 1500~2500ms   等樹有內容
 * 換一個設定 ＋ 2000~3500ms     等重畫完成
 * ```
 *
 * `lessons.spec` 換掉三處之後：**888 秒 → 218 秒，133 支零改判定**。
 *
 * ## 🔴 而它同時是「不能平行跑」的原因
 *
 * 對照實驗（`workers=1` vs `4`）：序列 9/9 過，併行 3 支紅，而失敗的形狀是
 * 「產出是舊的」與「element not found」。4 個 Chromium 搶 4 個效能核，
 * 開機慢 3～4 倍——**而固定等待是照閒置機器校準的**。
 *
 * > **一個用固定秒數等待的測試，它的正確性綁在「機器現在有多閒」上
 * > ——那既讓它慢，也讓它不能平行。同一個病，兩個症狀。**
 *
 * ## ⚠️ 用哪一支：問「這一步完成的【標誌】是什麼」
 *
 * 不要用「有東西了」當條件——那在「一開始就有東西」時會立刻成立而什麼都沒等到
 *（`first-run` 那條護欄的檔頭記著同一個形狀）。
 * ──────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** app 起來了：面板在、目標釘好了、樹存在。 */
export async function appReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const a = (window as any).__app
    return Boolean(a?.blocklyPanel) && Boolean(a?.currentTarget?.id)
  }, undefined, { timeout: 30_000 })
}

/** 語義樹**真的有內容**了——`useAsSource` 回來時同步還在跑。 */
export async function treeReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const t = (window as any).__app?.syncController?.currentTree
    return Boolean(t) && Object.keys(t.children ?? {}).length > 0
  }, undefined, { timeout: 30_000 })
}

/**
 * 換鷹架模式，並等它**真的套用了**。
 *
 * ⚠️ `setScaffoldMode` 裡有一個**產品自己的** `setTimeout(…, 900)`
 *（`markOutOfScopeBlocks`）——所以「視覺蓋層」那一格不可能比 900ms 快。
 * 這支只等**深度換過去 ＋ 選單關掉**；要驗視覺的測試自己再等那一層。
 */
export async function setScaffoldMode(
  page: Page,
  mode: 'editable' | 'ghost' | 'hidden',
  opts: { visual?: boolean } = {},
): Promise<void> {
  const want = mode === 'hidden' ? 0 : mode === 'ghost' ? 1 : 2
  await page.locator('.status-item-btn[data-control-id="scaffold"]').click()
  await page.locator(`.quick-pick-item[data-value="mode:${mode}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction(
    (d) => (window as any).__app?.scaffoldDepth === d,
    want, { timeout: 30_000 },
  )
  await treeReady(page)
  if (!opts.visual) return
  // 🔴 **視覺那一層要另外等，而它的條件【依模式而不同】。**
  //
  // 2026-08-31 實測：第一版沒有這一格，於是五支驗「淡的／動不了」的測試
  // 當場紅——`setScaffoldMode` 只等到深度換過去，而 `markOutOfScopeBlocks`
  // 是產品裡一個 `setTimeout(…, 900)`。
  //
  // > **一個「換好了」的訊號如果只涵蓋一半的效果，
  // > 用它的測試會在另一半上看到上一個模式的畫面。**
  //
  // ⚠️ 而條件不能寫成「有淡的積木」——`editable`／`hidden` 下**本來就沒有**，
  //    那樣寫等於在那兩個模式下不等待。所以正反兩面各等各的。
  await page.waitForFunction((m) => {
    const ws = (window as any).__app?.blocklyPanel?.workspace
    if (!ws) return false
    const n = ws.getAllBlocks(false)
      .filter((b: any) => b.getSvgRoot?.()?.classList.contains('ghost-block')).length
    return m === 'ghost' ? n > 0 : n === 0
  }, mode, { timeout: 30_000 })
}

/** 切目標，並等它**真的換過去**——認的是 app 的狀態，不是選單關掉。 */
export async function pickTarget(page: Page, id: string): Promise<void> {
  await page.locator('.status-item-btn[data-control-id="target"]').click()
  await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction(
    (want) => (window as any).__app?.currentTarget?.id === want,
    id, { timeout: 30_000 },
  )
}

/**
 * 切到流程分頁，並等它**畫出節點**。
 *
 * ⚠️ 條件是「節點數 > 0」而不是「面板可見」——面板一按就可見，
 * 而那時圖還沒畫。用可見當條件等於沒等。
 */
/**
 * **只把流程搬到看得見的地方，不等它畫出節點。**
 *
 * ⚠️ `openFlowTab` 會等「節點數 > 0」——而**空程式沒有節點**，那時它會等到逾時。
 * 🔴 兩支不能合成一支：等節點是為了「圖畫好了才量」，
 * 而有些測試要驗的正是「還沒有東西的時候長什麼樣」。
 */
export async function showFlowSlot(page: Page): Promise<void> {
  const already = await page.evaluate(() => {
    const e = document.getElementById('flow-column')
    return !!e && getComputedStyle(e).display !== 'none'
  })
  if (already) return
  // ⚠️ **要第一顆【看得見】的**——`.first()` 會選到已經被藏起來的那一格，
  //    而那顆點不下去（實測：等到逾時，而錯誤訊息說「element is not visible」）。
  await page.locator('.slot-picker:visible').first().click()
  await page.locator('.quick-pick-item[data-value="relation"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction(() => {
    const e = document.getElementById('flow-column')
    return !!e && getComputedStyle(e).display !== 'none'
  })
}

/** 對稱的另一半——把**積木**搬到看得見的地方。 */
export async function showBlocksSlot(page: Page): Promise<void> {
  const already = await page.evaluate(() => {
    const e = document.getElementById('blocks-column')
    return !!e && getComputedStyle(e).display !== 'none'
  })
  if (already) return
  await page.locator('.slot-picker:visible').first().click()
  await page.locator('.quick-pick-item[data-value="space"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction(() => {
    const e = document.getElementById('blocks-column')
    return !!e && getComputedStyle(e).display !== 'none'
  })
}

export async function openFlowTab(page: Page): Promise<void> {
  // 🔴 **切法換了**（2026-09-01，spec 169）：以前是快速列上一對互斥的分頁
  //    （`#view-flow-btn`），現在是**每一格自己的下拉**。
  //    ⚠️ 而下拉的字是「流程 ▾」——`^流程$` 配不到，舊寫法會在點擊上逾時。
  //
  // 🟢 已經看得見就不用點：三欄與十字兩個投影都在，那時「切過去」是多餘的動作。
  const already = await page.evaluate(() => {
    const e = document.getElementById('flow-column')
    return !!e && getComputedStyle(e).display !== 'none'
  })
  if (!already) await showFlowSlot(page)
  await flowReady(page)
}

/**
 * 流程圖**畫出節點**了。
 *
 * ⚠️ 這一支只等，不點——各檔點分頁的選擇器不一樣（`.first()` vs `.last()`，
 * 那是行動版有第二條分頁列造成的）。**把點擊也收進助手會安靜地點到另一顆。**
 */
export async function flowReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll('.flow-panel svg g').length > 1,
    undefined, { timeout: 30_000 },
  )
}

/**
 * 按執行，並等它**停在一個穩定的狀態**——狀態列自己會說。
 *
 * 🔴 **「跑完」不是唯一的結局**，而漏掉任何一個都會等滿逾時然後拿過期的輸出去比對：
 *
 * ```
 * 程式執行完畢 ／ Completed   正常結束
 * 錯誤 ／ Error               炸了
 * 等待輸入⋯ ／ Waiting        🔴 停在 cin——【它永遠不會「完畢」】
 * ```
 *
 * ⚠️ 第三個是實測補的：2026-08-31 換掉固定等待之後，
 * `templates.spec` 那兩個**會讀輸入**的範例當場各等滿 23 秒。
 *
 * > **一個「做完了嗎」的條件，如果只涵蓋一種結局，
 * > 在其他結局上它等的是逾時。**
 *
 * 🟢 而「等待輸入」是一個**穩定狀態**——它就是那些測試接下來要餵字的時機。
 */
export async function runAndSettle(page: Page): Promise<void> {
  await page.locator('#run-btn').click()
  await expect
    .poll(() => page.locator('.console-status').innerText(), { timeout: 20_000 })
    .toMatch(/程式執行完畢|錯誤|Error|Completed|等待輸入|Waiting/)
}

/**
 * **按了執行之後，如果跳出「先猜一下」的問句，就跳過它。**
 *
 * 🔴 2026-09-04 加預測那一刀之後，**題目模式下的第一次執行會停下來問**
 * ——而既有的 66 支課程測試按了執行就等輸出，於是整片紅。
 *
 * > **一個「開跑之前先問人」的機制，會讓每一個【按了執行就等結果】的
 * > 既有測試同時失效——而它們紅得看起來像是那 66 堂課壞了。**
 *
 * ⚠️ 這一支**不是把那個機制關掉**：它是替測試按下「跳過」，
 * 也就是**明說「這支測試不是在扮演一個學生」**。真的在驗預測的那幾支
 * （`lesson-pins.spec.ts`）會自己填答案，不走這裡。
 */
export async function skipPredictionIfAsked(page: Page): Promise<void> {
  const skip = page.locator('.console-predict-skip')
  // ⚠️ 短逾時：多數情況下它不會出現（純練習、沒有課、問不出好問題），
  //    而每一支都等三秒的話，這個檔會多花三分鐘。
  if (await skip.isVisible({ timeout: 2500 }).catch(() => false)) await skip.click()
}
