/**
 * **第二課還走得通嗎——而它多釘一樣第一課沒有的東西：課文引用的錯誤訊息。**
 *
 * ## 它從哪來
 *
 * 2026-08-15 的探針量了第一課的學生會犯的 9 種錯，而放行的那兩種，
 * 學生看到的是 `RUNTIME_ERR_UNDECLARED_VAR: {"%1":"Cout"}`
 * ——**一串他看不懂也搜尋不到的代號**。
 *
 * 修好之後它是「變數 'Cout' 尚未宣告」，而**第二課的第三步刻意用它教學**：
 * 「宣告」是什麼意思，最好的解釋就是**沒宣告時系統說了什麼**。
 *
 * 🔴 **所以這支測試釘的不只是「課走得通」，還有「課文引的那句話還是那句話」。**
 * 訊息一改，課文就在說謊——而教材比程式碼更難改（它會被人記住）。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測課文寫得好不好**——那是人的判斷
 * - **不檢測學生會不會卡**——那要人走（見 `specs/126-.../findings.md`）
 * - ⚠️ **不檢測課文與這支的步驟是否同步**——🔴 與第一課同一個弱點：
 *   課文改了而這裡沒改，它照樣綠。**寫下來而不是假裝有覆蓋。**
 * - **不檢測第三步以外的錯誤訊息**——第四十四條護欄管那個
 *   （它掃全部的 (身分, 參數) 組合），這裡只釘**課文引用到的那一句**。
 */
import { test, expect, type Page } from '@playwright/test'
import { useAsSource } from './helpers'
import fs from 'node:fs'
import path from 'node:path'

const LESSON = 'lessons/02-記住一個數字'

/** ⚠️ 三段程式與 `lesson.md` 的內容必須一致——見檔頭的「不檢測什麼」。 */
const STEP2 = 'int main() {\n    int score = 90;\n    cout << "分數是 " << score << endl;\n    return 0;\n}\n'
const STEP3_TYPO = 'int main() {\n    int score = 90;\n    cout << "分數是 " << Score << endl;\n    return 0;\n}\n'
const FINAL = 'int main() {\n    int score = 90;\n    score = score + 5;\n    cout << "分數是 " << score << endl;\n    return 0;\n}\n'

/** 🔴 課文第三步／第五步逐字引用的那兩句。改了它們，課文就在說謊。 */
const STEP3_MESSAGE = "變數 'Score' 尚未宣告——你是不是要打 'score'？"
const STEP5_MESSAGE = "變數 'bonus' 尚未宣告"

/** 第五步：開一個全新的名字而【故意忘記 int】。 */
const STEP5_FORGOT = 'int main() {\n    int score = 90;\n    bonus = 5;\n    score = score + bonus;\n    cout << "分數是 " << score << endl;\n    return 0;\n}\n'
const STEP5_FIXED = 'int main() {\n    int score = 90;\n    int bonus = 5;\n    score = score + bonus;\n    cout << "分數是 " << score << endl;\n    return 0;\n}\n'

async function fresh(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { codeView?: { editor?: unknown } } }).__app?.codeView?.editor),
    undefined, { timeout: 30_000 },
  )
}

async function run(page: Page, code: string): Promise<string> {
  await page.evaluate((c) => (window as never as { __app: any }).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(900)
  await page.getByText('執行').first().click()
  await page.waitForTimeout(1800)
  return page.evaluate(() => document.body.innerText)
}

test('第二課：照著走，最後印出 分數是 95', async ({ page }) => {
  await fresh(page)

  // ★ 入口條件：開場是空的（合成量）——課文假設學生把第一課清掉了
  const blocks0 = await page.evaluate(
    () => (window as never as { __app: any }).__app.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? -1)
  expect(blocks0, '開場不是空的 → 課文「把第一課的程式清掉」的前提變了').toBe(0)

  // 第二步：印出變數（課文：「按執行 → 分數是 90」）
  const t2 = await run(page, STEP2)
  expect(
    t2,
    '🔴 第二步的輸出與課文寫的不同（課文：「分數是 90」）——課文或系統有一邊變了',
  ).toContain('分數是 90')

  // 第四步：讓它變（課文：「按執行 → 分數是 95」），而 goal.txt 釘住它
  const t4 = await run(page, FINAL)
  const goal = fs.readFileSync(path.join(LESSON, 'goal.txt'), 'utf8').trim()
  expect(t4, `🔴 最終輸出與 goal.txt（${goal}）不符——課的目標檢查壞了`).toContain(goal)
})

test('🔴 第二課第三步：課文引用的錯誤訊息，必須逐字還是那一句', async ({ page }) => {
  await fresh(page)
  const text = await run(page, STEP3_TYPO)

  expect(
    text,
    `🔴 課文第三步逐字引用了「${STEP3_MESSAGE}」，而畫面上現在不是這句。\n` +
      '課文或訊息有一邊變了——⚠️ 而**課文比程式碼難改**（學生會記住它），\n' +
      '所以先問「訊息這樣改對嗎」，再考慮改課文。',
  ).toContain(STEP3_MESSAGE)

  // ⚠️ 而更重要的是：它**不得**退回代號。這一條與上一條分開寫，
  // 因為「訊息換了一句更好的話」與「訊息壞回代號」是兩件事，
  // 而只有後者是缺陷。
  expect(text, '🔴 代號又跑到畫面上了——第四十四條護欄漏掉了這條路徑').not.toMatch(/RUNTIME_ERR_/)
})

test('🔴 第二課第五步：忘了 int 開新名字，必須停下來並說出是哪個名字', async ({ page }) => {
  await fresh(page)

  // ⚠️ 課文說「和第三步同一句話」——那是這一段的教學重點，所以逐字釘住
  const forgot = await run(page, STEP5_FORGOT)
  expect(
    forgot,
    `🔴 課文第五步逐字引用了「${STEP5_MESSAGE}」，而畫面上現在不是這句。\n` +
      '⚠️ 若這是刻意的改動，**課文要一起改**——而課文比程式碼難改（學生會記住它）。',
  ).toContain(STEP5_MESSAGE)

  // 🔴 而更重要的：它【不得】跑完。2026-08-15 之前它會跑完並輸出「分數是 95」，
  // 而課文那時寫了一句系統做不到的提醒（specs/127 findings 坑一）。
  expect(
    forgot,
    '🔴 忘了 int 而程式跑完了——這一課花兩段講「int 不能省」，而系統又允許省了',
  ).not.toContain('分數是 95')

  // 加回 int → 課文說會看到「分數是 95」
  const fixed = await run(page, STEP5_FIXED)
  expect(fixed, '🔴 加回 int 之後應該跑得完（課文：「再跑一次 → 分數是 95」）').toContain('分數是 95')
})
