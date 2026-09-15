/**
 * **只差一個空白的時候，裁判要指得出來。**
 *
 * ## 🔴 它從哪來（2026-09-15，整班回饋）
 *
 * ```
 * 「第四題卡最久，因為一直卡在中間的空格」
 * 「就算只是一個空格沒打到都不行」
 * ```
 *
 * 在此之前裁判遇到「這一行內容不同」**什麼都不說**——畫面上是兩行
 * 【看起來一模一樣】的東西並排，而它說不對。
 *
 * > **一個「你錯了」而看不出錯在哪的回饋，教的是「這個工具有脾氣」。**
 */
import { test, expect } from '@playwright/test'
import { runButton } from './helpers'

test('★ 輸出只差一個空格 → 主控台要說出差在哪', async ({ page }) => {
  test.setTimeout(180_000)
  const url = `/?lesson=${encodeURIComponent('cpp-beginner/01-印出一句話')}&task=follow`
  await page.goto(url)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(url)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(3500)

  // 🔴 學生打的那一行**多了一個空格**——這一題要的是 `Hello!`
  await page.locator('.view-line', { hasText: 'int main()' }).first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << "Hello !" << endl;', { delay: 12 })
  await page.waitForTimeout(4000)

  // ⚠️ 用 `#run-btn`，不要用 class——`.exec-btn.run` 同時匹配下拉箭頭（見 helpers）
  await runButton(page).click()
  await page.waitForTimeout(1500)
  // 🔴 **「先猜再跑」會擋在中間**——不跳過的話程式根本沒跑，
  //    而症狀是「裁判沒有說話」，看起來像裁判壞了。
  const skip = page.locator('.console-predict-skip')
  if (await skip.count() > 0) { await skip.first().click() }
  await page.waitForTimeout(6000)

  const box = page.locator('.console-verdict')
  await expect(box.first(), '🔴 裁判沒有說話 → 這一支測的不是那條路').toBeVisible({ timeout: 20_000 })
  const hint = await page.locator('.console-verdict-hint').first().textContent().catch(() => null)
  expect(hint, '🔴 只差一個空格而裁判什麼都沒說').toBeTruthy()
  expect(hint!, '🔴 沒有指出是空白的問題').toContain('空白')
  expect(hint!, '🔴 沒有指出在哪裡').toContain('Hello')
})

/**
 * **「跳過」要看得出來是一顆按鈕。**
 *
 * 🪦 一個學生逐字說：「我完全不知道**那個東西可以按**跳過」。
 * 而 `console-panel.ts` 的說明逐字寫著「跳過的按鈕一定要在，**而且不准藏起來**」
 * ——樣式那一側寫的是 `#888` 的字配 `#3a3a3a` 的框，透明底。
 *
 * > **一個「不准藏起來」的規矩，如果沒有人量它的對比度，
 * > 它會被樣式悄悄違反——而註解仍然理直氣壯地寫在那裡。**
 */
test('★ 「跳過」的對比度要看得出來是一顆按鈕', async ({ page }) => {
  test.setTimeout(180_000)
  const url = `/?lesson=${encodeURIComponent('cpp-beginner/01-印出一句話')}&task=follow`
  await page.goto(url)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(url)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(3500)
  await page.locator('.view-line', { hasText: 'int main()' }).first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << "Hello!" << endl;', { delay: 12 })
  await page.waitForTimeout(4000)
  await runButton(page).click()
  await page.waitForTimeout(2000)

  const skip = page.locator('.console-predict-skip').first()
  await expect(skip, '🔴 沒有跳過鍵 → 這一支測的不是那條路').toBeVisible({ timeout: 15_000 })

  /**
   * 🔴 量的是**邊界**對周圍的對比，不是文字對背景的。
   *
   * 🪦 第一版量文字：`#888` 在深色主控台上是 4.6:1，**過得了 AA**
   * ——而學生說的不是「字看不清楚」，是「看不出**它可以按**」。
   * 注入舊顏色的時候那一版是綠的。
   *
   * > **一個量錯軸的檢查，會在你把缺陷放回去的那一刻保持全綠
   * > ——而它看起來像一條有在守的護欄。**
   *
   * 「看不看得出是一個控制項」在 WCAG 裡是 1.4.11（非文字對比），門檻 **3:1**。
   */
  const ratio = await skip.evaluate((el) => {
    const lum = (c: string): number => {
      const [r, g, b] = (c.match(/\d+/g) ?? ['0', '0', '0']).map(Number)
      const f = (v: number): number => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const cs = getComputedStyle(el)
    // 周圍是什麼顏色——往上找到第一個不透明的
    let node: HTMLElement | null = (el as HTMLElement).parentElement
    let around = node ? getComputedStyle(node).backgroundColor : 'rgb(0,0,0)'
    while (node && (around === 'rgba(0, 0, 0, 0)' || around === 'transparent')) {
      node = node.parentElement
      around = node ? getComputedStyle(node).backgroundColor : 'rgb(0,0,0)'
    }
    const contrast = (x: string, y: string): number => {
      const a = lum(x)
      const b = lum(y)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    // 邊框或底色，任一個把它從周圍分出來就算數
    return Math.max(contrast(cs.borderTopColor, around), contrast(cs.backgroundColor, around))
  })

  // ⚠️ 門檻 3:1 是 WCAG 1.4.11（非文字對比）——**不是我挑的數字**
  expect(ratio, `🔴 跳過鍵與周圍的對比只有 ${ratio.toFixed(2)}:1（1.4.11 要 3:1）——學生看不出它可以按`)
    .toBeGreaterThanOrEqual(3)
})
