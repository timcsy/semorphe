/**
 * **第一次打開編輯器（沒選課），要有一條指路的線。**
 *
 * ## 🔴 它從哪來（2026-09-15，整班回饋）
 *
 * ```
 * 「找不到方塊」
 * 「代碼看不太懂 但最難的還是找積木吧 眼睛快花了」
 * ```
 *
 * 兩個人都**沒有從課程點進來**——於是拿到完整工具箱（實測 **12 個分類、196 顆**）。
 *
 * > **問題不是那 196 顆太多——自由練習本來就該有全部。
 * > 問題是他不知道有一條帶路的，而那條路的入口在最下面那條狀態列裡。**
 *
 * ## 🪦 而那條線的機制【早就在】，只是那條路上沒有人叫它
 *
 * `LessonNudgeBar` 從 2026-09-10 就在，而它只在 `markOutOfScopeBlocks()`
 * 裡更新——**冷開那條路從來不呼叫它**。
 *
 * > **一條只在「某件事發生時」才更新的提示，在那件事從不發生的那條路上
 * > 等於不存在——而它不會報錯，它只是安靜。**
 */
import { test, expect, type Page } from '@playwright/test'

async function open_(page: Page, query: string): Promise<void> {
  await page.goto(query)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(query)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(4500)
}

const bar = (page: Page): Promise<{ shown: boolean; text: string }> => page.evaluate(() => {
  const el = document.querySelector('.lesson-nudge-bar') as HTMLElement | null
  return { shown: Boolean(el) && !el!.hidden, text: el?.textContent?.trim() ?? '' }
})

test('★ 冷開（沒選課、畫布空的）→ 指路條要出現，而且指得出第一課', async ({ page }) => {
  test.setTimeout(180_000)
  await open_(page, '/')
  const b = await bar(page)
  expect(b.shown, '🔴 沒有指路條——他拿到 196 顆積木而不知道有一條帶路的').toBe(true)
  expect(b.text, '🔴 沒有指名是哪一課').toContain('印出一句話')
  expect(b.text, '🔴 沒有一顆按得下去的').toContain('從這一課開始')
  // ⚠️ 他**已經在**自由練習了，再給他一顆「自由練習」是廢話
  expect(b.text, '🔴 不該給「自由練習」').not.toContain('自由練習')
})

test('★ 而選了課之後它要閉嘴', async ({ page }) => {
  test.setTimeout(180_000)
  await open_(page, `/?lesson=${encodeURIComponent('cpp-beginner/01-印出一句話')}&task=follow`)
  const b = await bar(page)
  // 🔴 這一條擋的是「一條趕不走的橫幅」——選了課還在喊，那就是噪音
  expect(b.text, '🔴 選了課還在說「第一次來？」').not.toContain('第一次來')
})

test('★ 他已經動手做東西了 → 不要插嘴', async ({ page }) => {
  test.setTimeout(180_000)
  await open_(page, '/')
  await page.locator('.view-line', { hasText: 'int main()' }).first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << "hi";', { delay: 12 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => {
    const app = (window as unknown as { __app: { markOutOfScopeBlocks?: () => void } }).__app
    app.markOutOfScopeBlocks?.()
  })
  await page.waitForTimeout(1200)
  const b = await bar(page)
  expect(b.text, '🔴 他正在寫東西而它跳出來喊「第一次來？」').not.toContain('第一次來')
})

/**
 * **浮起來的東西不准蓋住任何按得到的東西。**
 *
 * 🪦 這一條是 CI 教的（2026-09-15）：把指路條改成浮起來（不跟畫布分高度）之後，
 * 它貼在**整欄的頂端**，蓋住了那一排 `slot-picker`
 * ——`slot-view-picker` 三條 e2e 全部 `click` 逾時。
 *
 * > **把一個東西從排版流拿出來，它就不再跟旁邊的東西讓位
 * > ——而它會蓋住的第一個，是它上面那一個。**
 *
 * ⚠️ 而上一刀我只驗了「它出現」與「它該閉嘴時閉嘴」，**沒有驗它擋到誰**。
 */
test('★ 指路條不得蓋住任何控制項', async ({ page }) => {
  test.setTimeout(180_000)
  await open_(page, '/')
  const b = await bar(page)
  expect(b.shown, '🔴 指路條沒出現 → 這一支測的不是那條路').toBe(true)

  const covered = await page.evaluate(() => {
    const nudge = document.querySelector('.lesson-nudge-bar') as HTMLElement
    const r = nudge.getBoundingClientRect()
    const hit: string[] = []
    // 每一顆按得到的東西——它的中心點不得落在指路條的矩形裡
    for (const el of [...document.querySelectorAll('button, .slot-picker, [role=button]')]) {
      if (nudge.contains(el)) continue
      const e = (el as HTMLElement).getBoundingClientRect()
      if (e.width === 0 || e.height === 0) continue
      const cx = e.left + e.width / 2
      const cy = e.top + e.height / 2
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        hit.push((el as HTMLElement).className || (el as HTMLElement).id || el.tagName)
      }
    }
    return hit
  })
  expect(covered, '🔴 這幾顆按鈕被指路條蓋住了——它們會「點不到而逾時」：').toEqual([])
})
