/**
 * **積木的右鍵選單，使用者讀得懂。**
 *
 * ## 🔴 它從哪來（2026-09-15）
 *
 * 一個學生逐字寫：「打字跟做重複的積木，**如果可以複製會更簡單一點**」
 * ——而「複製」一直都在右鍵選單裡，只是那個選單是**英文的**。
 *
 * > **一個功能如果它的入口是使用者讀不懂的語言，那它對他來說不存在。**
 *
 * ## ⚠️ 而它為什麼要走 e2e
 *
 * 語系那條路有三段：`zh-TW/blocks.json` → `LocaleLoader.injectToBlocklyMsg`
 * → `Blockly.Msg` → Blockly 自己畫選單。改了第一段而中間任何一段沒接上，
 * **JSON 看起來是對的，而畫面上還是英文**。
 *
 * ⚠️ 既有的 `locale-integration` 驗的是「兩個語系的鍵一致」
 * ——它擋得住「漏翻一個」，擋不住「整條沒接上」。
 */
import { test, expect } from '@playwright/test'

test('★ 右鍵一顆積木，選單上的字是中文', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto(`/?lesson=${encodeURIComponent('cpp-beginner/01-印出一句話')}&task=follow`)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(3000)

  // 先弄一顆積木出來
  await page.locator('.view-line', { hasText: 'int main()' }).first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('cout << "hi";', { delay: 12 })
  await page.waitForTimeout(4000)

  const box = await page.locator('.blocklyDraggable').filter({ hasText: '印出' }).first().boundingBox()
  expect(box, '🔴 畫布上沒有積木 → 這一支測的不是那條路').toBeTruthy()
  await page.mouse.click(box!.x + 18, box!.y + box!.height / 2, { button: 'right' })
  await page.waitForTimeout(1200)

  const items = await page.evaluate(() =>
    [...document.querySelectorAll('.blocklyMenuItemContent, .blocklyMenuItem')]
      .map((e) => (e.textContent ?? '').trim()).filter(Boolean))
  const uniq = [...new Set(items)]

  expect(uniq.length, '🔴 右鍵沒有叫出選單 → 下面在驗空集合').toBeGreaterThan(2)
  // 🔴 「複製」是學生點名的那一個
  expect(uniq.join('｜'), '🔴 選單裡沒有「複製」').toContain('複製')
  // ⚠️ **一個英文字都不准**——漏翻一個，那一項對學生就是不存在的
  const english = uniq.filter((t) => /^[\x20-\x7E]+$/.test(t))
  expect(english, '🔴 這幾項還是英文——學生讀不懂的入口等於沒有入口：').toEqual([])
})
