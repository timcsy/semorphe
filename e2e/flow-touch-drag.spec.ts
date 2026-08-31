/**
 * **第九十一條護欄**：手機上「按住再拖」是拖曳，不是長按選單。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-31：「手機的流程節點拖曳**常常**會誤認為右鍵」。
 *
 * 用真的觸控事件（CDP `Input.dispatchTouchEvent`，`pointerType === 'touch'`）量到：
 *
 * ```
 * 按住 200ms 再拖  →  選單沒開          ✅ 恰好被「移動超過 8px 就取消」擋掉
 * 按住 700ms 再拖  →  🔴 選單開了，而節點也移動了 120px
 * ```
 *
 * **手指按下去先停一下再走，是手機上最自然的起手式**——而那 500ms 在移動
 * 發生之前就燒完了，`clearTimeout` 這時已經無事可做。
 *
 * > **一個「取消待辦」的機制，對「已經發生的事」沒有任何效力
 * > ——而這兩種情況在程式碼裡長得一模一樣。**
 *
 * ## 🔴 而修法的第一版沒有用，原因值得記住
 *
 * 「移動時把已開的選單關掉」這段邏輯，第一版掛在**那顆節點元素**上。實測：
 *
 * ```
 * 節點收到 pointerdown=0  pointermove=0     ← 而節點確實移動了 120px
 * ```
 *
 * 拖曳的每一次移動都會 `paint()`，而 `paint()` **把整個 SVG 重建**——收到
 * `pointerdown` 的那顆元素當場被換掉，掛在它身上的監聽器跟著消失。
 *
 * > **一個把狀態放在「會被重畫掉的元素」上的手勢處理器，
 * > 只在第一幀裡是對的。**
 *
 * 所以取消／關閉那一組改掛 `window`——與 `attachDrag` 同一個理由。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果流程圖上的節點數是 0，代表那段程式碼沒有同步進來，這份結果不算數
 * > ——不是「長按不再誤判」。**
 *
 * 錨在**節點數**（合成量：那段程式碼畫出幾顆節點）。它不隨這個缺陷被修好
 * 而變動。🔴 **刻意不錨在「誤開幾次選單」**——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測桌機右鍵**——那條路是 `contextmenu`，與長按無關
 * - **不檢測連線（wire）的長按**——它沒有拖曳，不會撞到這個衝突
 * - **不檢測捏合縮放**——`flow-zoom-pan.spec.ts` 管那個
 * - ⚠️ **不檢測「選單裡的項目按了會怎樣」**——`flow-delete-undo.spec.ts` 管
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource, appReady, treeReady } from './helpers'

test.use({ hasTouch: true, isMobile: true, viewport: { width: 500, height: 900 } })

const CODE = 'int main() {\n  int a = 1;\n  int b = 2;\n  int c = a + b;\n  return 0;\n}'
const NODES = '.flow-panel svg g:has(> .fc-node-body)'

async function openFlow(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(s: string): void } } }).__app.codeView.setCode(c), CODE)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await page.locator('[data-tab="flow"]').last().click()
  await page.waitForTimeout(2000)
}

test('★ 手機：按住再拖是拖曳，純長按才是選單', async ({ page }) => {
  // 三種手勢各重載一次（每一次都要等同步完成）——預設 30 秒不夠
  test.setTimeout(150_000)
  await freshApp(page)
  await appReady(page)
  await openFlow(page)

  // ★ 入口條件——錨在合成量，見檔頭的自我否證
  const count = await page.locator(NODES).count()
  expect(
    count,
    '🔴 流程圖上一顆節點都沒有 → 程式碼沒同步進來，這份結果不算數。⚠️ 不代表「長按不再誤判」。',
  ).toBeGreaterThan(0)

  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number): Promise<unknown> =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

  const target = page.locator(NODES).nth(Math.min(2, count - 1))

  /** 按住 `hold` 毫秒後移動 `steps` 次；回傳選單開著沒、節點走了幾 px */
  const gesture = async (hold: number, steps: number): Promise<{ menu: number; moved: number; mid: number }> => {
    await page.reload()
    await page.waitForTimeout(2500)
    await openFlow(page)
    const b = await target.boundingBox()
    const x0 = b!.x + b!.width / 2, y0 = b!.y + b!.height / 2
    await touch('touchStart', x0, y0)
    await page.waitForTimeout(hold)
    const mid = await page.locator('.flow-menu').count()
    for (let i = 1; i <= steps; i++) await touch('touchMove', x0 + i * 12, y0 + i * 5)
    await page.waitForTimeout(200)
    await touch('touchEnd', 0, 0)
    await page.waitForTimeout(600)
    const after = await target.boundingBox()
    return { menu: await page.locator('.flow-menu').count(), moved: Math.round((after?.x ?? 0) - b!.x), mid }
  }

  // ① 短按就走——長按計時器都還沒燒完
  const quick = await gesture(200, 10)
  expect(quick.menu, '🔴 才按 200ms 就開選單').toBe(0)
  expect(quick.moved, '🔴 節點沒有跟著走 → 這一次量的不是「拖曳 vs 長按」').toBeGreaterThan(50)

  // ② 🔴 使用者回報的那一個：先停一下再走
  const slow = await gesture(700, 10)
  expect(
    slow.mid,
    '🔴 按住 700ms 而選單沒開 → 長按本身壞了（這支就測不到它要測的衝突了）',
  ).toBe(1)
  expect(
    slow.menu,
    '🔴 開始拖了而選單還在——這正是使用者說的「拖曳常常會誤認為右鍵」。' +
      '⚠️ 修法要掛在 `window` 上：`paint()` 會把收到 pointerdown 的那顆元素重建掉。',
  ).toBe(0)
  expect(slow.moved, '🔴 節點沒有跟著走').toBeGreaterThan(50)

  // ③ 反向：純長按不移動，選單【必須】留著——否則上面那條可以靠「永不開選單」作弊
  const held = await gesture(700, 0)
  expect(
    held.menu,
    '🔴 長按不動而選單沒開 → 把功能修掉了，不是把衝突修掉了',
  ).toBe(1)
})
