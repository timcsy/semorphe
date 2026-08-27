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
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(oneLineCode)
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
