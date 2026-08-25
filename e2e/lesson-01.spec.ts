/**
 * **第一課還走得通嗎——而截圖是它的副產品。**
 *
 * ## 它從哪來
 *
 * 使用者走完第一課後說「如果可以有圖片支援更好」，接著問
 * 「**怕圖片在版本更新之後很容易過時，要如何處理比較好？**」
 *
 * 而那個顧慮命中這個專案的招牌病——`experience` 逐字：
 * 「**路徑活著不代表做法還對——一份指著存在檔案的過時說明書最難發現。**」
 * **一張手工截圖比那更糟：連「指著的東西還在不在」都沒有人查。**
 *
 * ## 🔴 而更根本的是：這支測試本來就該在
 *
 * 寫完第一課時我跑過一支一模一樣的走查，**驗完就把它刪了**
 * ——於是「第一課還走得通嗎」沒有任何東西在看，
 * 而下一次改積木／改按鈕／改辨識層，**課會靜默地壞掉**。
 *
 * > **一份會自己重新截圖的教材，同時是一支「這一課還走得通嗎」的測試。**
 *
 * ⚠️ 而**就算永遠不加圖片，這支測試都該在**。圖片只是它的副產品。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測課文寫得好不好**——那是人的判斷
 * - **不檢測學生會不會卡**——那要人走（見 `specs/124-first-lesson/findings.md`）
 * - ⚠️ **不檢測課文與這支的步驟是否同步**——🔴 那是這支最大的弱點：
 *   課文改了而這裡沒改，它照樣綠。**寫下來而不是假裝有覆蓋。**
 *
 * ## ⚠️ 截圖的誠實代價
 *
 * ```
 * 自動截圖   永遠正確，而【不好看】（固定視窗、測試環境）
 * 手工截圖   好看，而【會說謊】
 * ```
 *
 * 第一課選「永遠正確」。哪天有一張圖真的需要構圖，
 * 那張**單獨手畫並標明「示意圖，不是實際畫面」**。
 */
import { test, expect, type Page } from '@playwright/test'
import { useAsSource } from './helpers'
import fs from 'node:fs'
import path from 'node:path'

const LESSON = 'lessons/01-印出一句話'
const SHOTS = path.join(LESSON, 'images')

/** 第一課第二步的完整程式。⚠️ 與 `lesson.md` 的內容必須一致——見檔頭的「不檢測什麼」。 */
const STEP2 = 'int main() {\n    cout << "Hello!" << endl;\n    return 0;\n}\n'

async function fresh(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { codeView?: { editor?: unknown } } }).__app?.codeView?.editor),
    undefined, { timeout: 30_000 },
  )
}

test('第一課：照著走，最後印出 Hello!', async ({ page }) => {
  await fresh(page)

  // ★ 入口條件：開場真的是空的（錨在合成量）——課文第一步假設了這件事
  const start = await page.evaluate(() => {
    const app = (window as never as { __app: any }).__app
    return { code: app.codeView.getCode?.() ?? '?', blocks: app.blocklyPanel?.workspace?.getAllBlocks(false)?.length ?? -1 }
  })
  expect(start.blocks, '開場不是空的 → 課文第一步的前提變了').toBe(0)

  // 第一步：骨架。⚠️ 課文明說這一步【不會】出現積木——那是實測出來的
  await page.evaluate(() => (window as never as { __app: any }).__app.codeView.setCode('int main() {\n    return 0;\n}\n'))
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(800)
  const afterSkeleton = await page.evaluate(
    () => (window as never as { __app: any }).__app.blocklyPanel.workspace.getAllBlocks(false).length)
  expect(
    afterSkeleton,
    '🔴 骨架這一步出現積木了——那與課文寫的相反（課文：「main 那一行沒有變成積木」）。\n' +
      '若這是刻意的改動，**課文要一起改**。',
  ).toBe(0)

  // 第二步：加 cout
  await page.evaluate((c) => (window as never as { __app: any }).__app.codeView.setCode(c), STEP2)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(900)
  const blocks = await page.evaluate(
    () => (window as never as { __app: any }).__app.blocklyPanel.workspace.getAllBlocks(false).map((b: { type: string }) => b.type))
  expect(
    blocks,
    '🔴 積木與課文寫的不同（課文：「出現了三塊積木」）——課文或積木有一邊變了',
  ).toEqual(['cpp_print', 'cpp_literal_string', 'cpp_endl'])

  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, '02-三塊積木.png'), fullPage: false })

  // 第三步：執行
  await page.getByText('執行').first().click()
  await page.waitForTimeout(1600)
  const text = await page.evaluate(() => document.body.innerText)
  const goal = fs.readFileSync(path.join(LESSON, 'goal.txt'), 'utf8').trim()
  expect(text, `🔴 輸出與 goal.txt（${goal}）不符——課的目標檢查壞了`).toContain(goal)

  await page.screenshot({ path: path.join(SHOTS, '03-執行結果.png'), fullPage: false })
})

test('第一課的「換你了」：換成自己的名字也要跑得起來', async ({ page }) => {
  await fresh(page)
  await page.evaluate(() => (window as never as { __app: any }).__app.codeView.setCode(
    'int main() {\n    cout << "timcsy" << endl;\n    return 0;\n}\n'))
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(800)
  await page.getByText('執行').first().click()
  await page.waitForTimeout(1600)
  const text = await page.evaluate(() => document.body.innerText)
  expect(text, '「換你了」那一步走不通——而它是課文唯一要學生自己動手的地方').toContain('timcsy')
})
