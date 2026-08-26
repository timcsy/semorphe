/**
 * **(d) 從 palette 拖一顆新節點出來**——而這一支存在的理由是一個誠實的缺口。
 *
 * ## 它從哪來
 *
 * 2026-08-26 做完 (d) 之後，合成 `PointerEvent` 走通了（樹尾多一顆節點、
 * 程式碼跟著變），**而真人滑鼠拖曳沒有驗成功**：
 *
 * ```
 * 手動探針：down: 0 ｜ mdown: 0 ｜ up: 1     ← 按下沒落在 chip 上（放開有）
 * ```
 *
 * 看起來是自動化的座標問題，不是產品缺陷。
 *
 * > **而「看起來是」不能拿來宣稱它對。**
 *
 * ⚠️ 合成事件與真的輸入**差在瀏覽器補的那一層**（指標捕捉、隱含的
 * `pointercancel`、`preventDefault` 的效果）。這一支用 Playwright 的
 * `mouse.down/move/up`，那條路與真人按滑鼠是同一條。
 *
 * ## 這支不驗什麼
 *
 * - **不驗 palette 上有哪些東西**——那是 `paletteFromToolbox` 的單元測試。
 * - **不驗拒絕的訊息**——那是第八十條護欄。
 * - **不驗新節點放對位置**——只驗「真人拖得動，而且真實變了」。
 */
import { test, expect } from '@playwright/test'
import { freshApp, typeAndFormat } from './helpers'

test('★ 真人滑鼠：從 palette 拖一顆到接點上 → 語義樹真的多一顆', async ({ page }) => {
  await freshApp(page)
  // ⚠️ `typeAndFormat` 斷言攤開後**超過 6 行**——太短的程式過不了它那一關
  await typeAndFormat(page, 'int main() { int a = 1; int b = 2; int c = 3; int d = 4; return 0; }')

  // 切到流程分頁——⚠️ 用**文字**認那顆分頁，而不是位置
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await expect(page.locator('.flow-palette')).toBeVisible({ timeout: 10_000 })

  /**
   * **樹裡有幾顆節點**——這一支的判準。
   *
   * ⚠️ **刻意不看程式碼**：這支要驗的是「真人拖得動」，
   * 而那一顆新節點吐不吐得出程式碼是**產生器**的事。
   * 🔴 第一版拿「程式碼有沒有變」當判準，於是
   * 「接進一個已經滿了的位置」（產生器只吐第一個）
   * **看起來與「手勢沒作用」一模一樣**——量錯了東西。
   */
  const nodeCount = (): Promise<number> =>
    page.evaluate(() => {
      const t = (window as never as { __app: { syncController: { getCurrentTree(): unknown } } })
        .__app.syncController.getCurrentTree() as { children?: Record<string, unknown[]> } | null
      let n = 0
      const walk = (x: { children?: Record<string, unknown[]> } | null): void => {
        if (!x) return
        n++
        for (const b of Object.values(x.children ?? {})) for (const c of b ?? []) walk(c as never)
      }
      walk(t)
      return n
    })
  const before = await nodeCount()

  /** 真的滑鼠：按下 → 移動 → 放開。與真人按滑鼠同一條路。 */
  const dragTo = async (chipText: string | RegExp, portKey: string): Promise<void> => {
    const chip = page.locator('.flow-chip').filter({ hasText: chipText }).first()
    await expect(chip, `🔴 palette 上沒有「${String(chipText)}」`).toBeVisible()
    const target = page.locator(`.fc-port-wirable[data-port="${portKey}"]`).first()
    await expect(target, `🔴 沒有 ${portKey} 接點 → 沒有地方可以放`).toBeVisible()
    const a = await chip.boundingBox()
    const b = await target.boundingBox()
    expect(a && b, '量不到位置 → 下面在對空氣').toBeTruthy()
    await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2)
    await page.mouse.down()
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 8 })
    await page.mouse.up()
  }

  // 🔴 ① **拖錯地方 → 誠實拒絕，而真實一個字都沒動**
  //    ⚠️ 這一半先驗，因為它是這支測試自己的對照組：
  //    少了它，「程式碼變了」可能只是別的東西造成的。
  await dragTo('宣告', 'initializer')   // 那一格要一個【值】，而「宣告」是一件事
  await expect(page.locator('.flow-notice'), '🔴 拖錯了而它沒有說話').toBeVisible({ timeout: 5000 })
  await expect(page.locator('.flow-notice')).toContainText('沒有被改動')
  expect(await nodeCount(), '🔴 拒絕了而真實變了').toBe(before)

  // 🔴 ② **拖對地方 → 真實真的變了**
  //    ⚠️ 挑 `declarators`（宣告成 `cpp:var_declare`）而**不是 `initializer`**：
  //    🔴 後者**已經有一個值了**（`int a = 1`），再塞一個進去產生器只吐第一個
  //    ——於是「程式碼沒變」，而那看起來與「手勢沒作用」一模一樣。
  //    > **一個已經滿了的位置，接得上而看不出來。**
  //    （⚠️ 那也是一個真的缺口：規則沒有判**容量**。記在路線圖上。）
  await page.evaluate(() => document.querySelector('.flow-notice')?.remove())
  await dragTo('宣告 … 變數 …', 'declarators')
  await expect
    .poll(nodeCount, { timeout: 8000, message: '🔴 真人拖曳之後樹沒有多一顆 → 這個手勢在真的輸入下沒有作用' })
    .toBe(before + 1)
})
