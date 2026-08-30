/**
 * **流程視圖：縮放、捲動、拖曳三件事要能並存。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-30：「流程視圖行動版做得更好用，**包含拖曳、放大縮小、
 * 畫面捲動**等等」。量出來的三個缺口：
 *
 * ```
 * 拖曳   `.fc-node` 沒有 touch-action → 觸控時手勢被【捲動】搶走，節點拖不動
 * 縮放   完全沒有——viewBox 與 width/height 一比一，連桌機都不能縮
 * 捲動   有（原生 overflow: auto），而縮放做進來時它必須還活著
 * ```
 *
 * ## 🔴 三者互相拉扯，而 `touch-action` 是那個結
 *
 * ```
 * .flow-canvas  pan-x pan-y   一根手指捲動【交給瀏覽器】，兩根手指的捏合我們接手
 * .fc-node      none          不然按住節點拖曳會被判成「使用者要捲畫布」
 * ```
 *
 * ⚠️ 把畫布寫成 `touch-action: none` 的話**捲動也會一起沒了**，
 * 那時就得自己實作慣性捲動——而那永遠比不上原生的。
 *
 * > **先讓瀏覽器做它做得比你好的那一半，再接手它不做的那一半。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果圖上一顆節點都沒有，這份報表不算數——不是「縮放拖曳都對」。**
 *
 * 錨在**節點數**（合成量）。🔴 刻意不錨在「壞掉幾項」。
 *
 * ## ⚠️ 而量拖曳時，抓點要抓【畫得出來的那塊】
 *
 * 2026-08-30 第一版拿 `.fc-node`（一個 `<g>`）的 `boundingBox` 加偏移去按，
 * 量到「移動 0px」——而那**不是缺陷**：
 *
 * ```
 * <g> 本身不可命中（SVG 只有畫出來的子元素接得到事件）
 * 而它的 box 含了往外突出的接點 → y+8 落在標題列【上方兩像素】
 * ```
 *
 * > **一個從容器的邊界框推算出來的座標，會落在容器裡而不在任何東西上。**
 */
import { test, expect } from '@playwright/test'
import { useAsSource, freshApp } from './helpers'

const PROG =
  '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 1;\n    cout << x << endl;\n    return 0;\n}\n'

async function openFlow(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 500, height: 900 })
  await freshApp(page)
  await page.waitForTimeout(2000)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2500)
  await page.locator('[data-tab="flow"]').last().click()
  await page.waitForTimeout(1800)
}

const zoomNow = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(() => {
    const s = document.querySelector('.flow-svg')
    const vb = (s?.getAttribute('viewBox') ?? '0 0 1 1').split(' ')
    return Number(s?.getAttribute('width')) / Number(vb[2])
  })

test('★ 縮放：三顆按鈕，而倍率真的變了', async ({ page }) => {
  await openFlow(page)
  // ★ 入口條件
  expect(
    await page.locator('.fc-node').count(),
    '🔴 圖上一顆節點都沒有 → 這份報表不算數',
  ).toBeGreaterThan(0)

  expect(await zoomNow(page), '🔴 一開始不是原寸').toBeCloseTo(1, 2)
  await page.locator('.flow-zoom-btn').last().click()
  await page.waitForTimeout(400)
  const bigger = await zoomNow(page)
  expect(bigger, '🔴 按了放大而沒有變大').toBeGreaterThan(1)
  await expect(page.locator('.flow-zoom-label'), '🔴 倍率沒有跟著顯示').toHaveText(/%$/)

  await page.locator('.flow-zoom-btn').first().click()
  await page.locator('.flow-zoom-btn').first().click()
  await page.waitForTimeout(400)
  expect(await zoomNow(page), '🔴 按了縮小而沒有變小').toBeLessThan(bigger)

  // 🔴 **`viewBox` 不准動**——內部座標一變，節點位置與存下來的佈局就全歪了
  const vb = await page.locator('.flow-svg').getAttribute('viewBox')
  await page.locator('.flow-zoom-btn').last().click()
  await page.waitForTimeout(300)
  expect(
    await page.locator('.flow-svg').getAttribute('viewBox'),
    '🔴 縮放動到了 `viewBox`——那會把整個座標系一起縮，存下來的佈局會歪掉',
  ).toBe(vb)
})

test('★ 適配：整張圖塞得進畫面', async ({ page }) => {
  await openFlow(page)
  await page.locator('.flow-zoom-btn').last().click()
  await page.locator('.flow-zoom-btn').last().click()
  await page.waitForTimeout(400)
  await page.locator('.flow-zoom-label').click()
  await page.waitForTimeout(600)
  const fit = await page.evaluate(() => {
    const c = document.querySelector('.flow-canvas') as HTMLElement
    return { over: c.scrollWidth - c.clientWidth, top: c.scrollTop, left: c.scrollLeft }
  })
  expect(fit.over, '🔴 按了適配而圖還是比畫面寬').toBeLessThanOrEqual(1)
  expect(fit.left + fit.top, '🔴 適配之後沒有回到左上角——使用者會看著一個空白角落').toBe(0)
})

test('★ `touch-action`：一根手指捲動、兩根捏合、按住節點是拖曳', async ({ page }) => {
  await openFlow(page)
  const ta = await page.evaluate(() => ({
    canvas: getComputedStyle(document.querySelector('.flow-canvas')!).touchAction,
    node: getComputedStyle(document.querySelector('.fc-node')!).touchAction,
  }))
  // 🔴 畫布：`pan-x pan-y` ——**捲動留給瀏覽器**，而捏合（pinch-zoom）被排除掉、我們接手
  expect(
    ta.canvas,
    '🔴 畫布的 touch-action 不對。`none` 會把【捲動】一起關掉，\n' +
      '而 `auto` 會讓瀏覽器搶走兩指捏合。',
  ).toBe('pan-x pan-y');
  // 🔴 節點：`none` ——不然按住它拖曳會被判成「使用者要捲畫布」
  expect(
    ta.node,
    '🔴 節點的 touch-action 不是 none——觸控上它會拖不動，而畫面在跑',
  ).toBe('none')
})

test('★ 縮放之後拖曳：手指走多少，節點在畫面上就走多少', async ({ page }) => {
  await openFlow(page)
  await page.locator('.flow-zoom-btn').first().click()
  await page.waitForTimeout(400)
  const z = await zoomNow(page)
  expect(z, '🔴 沒有縮小 → 這一支驗的是原寸，測不到那個 bug').toBeLessThan(1)

  // ⚠️ **抓標題列，不要拿 `<g>` 的邊界框加偏移**——見檔頭
  const head = page.locator('.fc-node .fc-node-header').first()
  const hb = await head.boundingBox()
  expect(hb, '🔴 抓不到節點的標題列').toBeTruthy()
  const before = (await page.locator('.fc-node').first().boundingBox())!.x
  const px = hb!.x + hb!.width / 2
  const py = hb!.y + hb!.height / 2
  await page.mouse.move(px, py)
  await page.mouse.down()
  await page.mouse.move(px + 100, py, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  const after = (await page.locator('.fc-node').first().boundingBox())!.x

  // 🔴 少了 `toSvgLen` 的除法，縮到 0.8 倍時它只會走 80px——
  //    症狀是「縮小之後拖曳變鈍」，而那很容易被當成錯覺。
  expect(
    after - before,
    `🔴 手指走 100px 而節點走了 ${(after - before).toFixed(0)}px（縮放 ${z.toFixed(2)}）——\n` +
      '位移沒有從螢幕像素換算成 SVG 單位。',
  ).toBeGreaterThan(94)
  expect(after - before).toBeLessThan(106)
})
