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
import { useAsSource, freshApp, appReady, treeReady, flowReady } from './helpers'

const PROG =
  '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 1;\n    cout << x << endl;\n    return 0;\n}\n'

async function openFlow(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 500, height: 900 })
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await page.locator('[data-tab="flow"]').last().click()
  await flowReady(page)
}

/** 目前的倍率——**從鏡頭的 `transform` 讀**（2026-08-30 起 SVG 自己不再變大）。 */
const zoomNow = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(() => {
    const t = document.querySelector('.fc-viewport')?.getAttribute('transform') ?? ''
    return Number(/scale\(([-\d.]+)\)/.exec(t)?.[1] ?? '0')
  })

/** 鏡頭的位移。 */
const panNow = (page: import('@playwright/test').Page): Promise<{ x: number; y: number }> =>
  page.evaluate(() => {
    const t = document.querySelector('.fc-viewport')?.getAttribute('transform') ?? ''
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(t)
    return { x: Number(m?.[1] ?? 0), y: Number(m?.[2] ?? 0) }
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

  // 🔴 **節點的座標不准動**——縮放只該動鏡頭。座標一變，存下來的佈局就歪了。
  const before = await page.locator('.fc-node').first().getAttribute('transform')
  await page.locator('.flow-zoom-btn').last().click()
  await page.waitForTimeout(300)
  expect(
    await page.locator('.fc-node').first().getAttribute('transform'),
    '🔴 縮放動到了節點自己的座標——那會把存下來的佈局弄歪',
  ).toBe(before)
})

test('★ 拖空白處＝推畫面，而且【不受內容大小限制】', async ({ page }) => {
  // 🔴 使用者 2026-08-30：「手機那邊，拖曳、縮放、刪除還是很難用」。
  //
  // 量出來的根因（400×780）：
  //
  // ```
  // 100%    縱向可捲 = 0        直的完全推不動
  // 縮小後  橫向也 = 0          整張圖完全推不動
  // ```
  //
  // 原生 `overflow: auto` 的捲動**只在內容比視窗大時存在**，而流程圖
  // 通常比手機畫面小。
  //
  // > **「能不能移動畫面」不該取決於「內容夠不夠大」。**
  //
  // 🟢 改成 Blockly 的做法：內容放在一個 `<g>` 上用 `transform` 推。
  await openFlow(page)
  const from = await panNow(page)
  await page.mouse.move(120, 600)
  await page.mouse.down()
  await page.mouse.move(260, 420, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const to = await panNow(page)
  // ★ 1:1——手指走多少，畫面就走多少
  expect(to.x - from.x, '🔴 橫的推不動').toBeCloseTo(140, 0)
  expect(to.y - from.y, '🔴 直的推不動——而那正是原生捲動做不到的那一半').toBeCloseTo(-180, 0)
})

test('★ 適配：整張圖塞得進畫面', async ({ page }) => {
  await openFlow(page)
  await page.locator('.flow-zoom-btn').last().click()
  await page.locator('.flow-zoom-btn').last().click()
  await page.waitForTimeout(400)
  await page.locator('.flow-zoom-label').click()
  await page.waitForTimeout(600)
  const fit = await page.evaluate(() => {
    const c = (document.querySelector('.flow-canvas') as HTMLElement).getBoundingClientRect()
    const g = (document.querySelector('.fc-viewport') as SVGGElement).getBoundingClientRect()
    // ⚠️ 鍵用英文——第四十條護欄：識別字必須是英文（2026-08-30 被它抓到）
    return { right: g.right - c.right, bottom: g.bottom - c.bottom, left: c.left - g.left, top: c.top - g.top }
  })
  const SIDE: Record<string, string> = { right: '超出右邊', bottom: '超出下面', left: '超出左邊', top: '超出上面' }
  for (const [k, v] of Object.entries(fit)) {
    expect(v, `🔴 按了適配而圖還是${SIDE[k]} ${v.toFixed(0)}px——那不叫塞得進去`).toBeLessThanOrEqual(2)
  }
})

test('★ `touch-action`：一根手指捲動、兩根捏合、按住節點是拖曳', async ({ page }) => {
  await openFlow(page)
  const ta = await page.evaluate(() => ({
    canvas: getComputedStyle(document.querySelector('.flow-canvas')!).touchAction,
    node: getComputedStyle(document.querySelector('.fc-node')!).touchAction,
  }))
  // 🔴 畫布：`none`——**每一種手勢都由我們接**（2026-08-30 改，與 Blockly 一致）。
  //
  // ⚠️ 原本是 `pan-x pan-y`（把捲動交給瀏覽器）。而那個捲動**只在內容比
  //    視窗大時存在**，於是手機上根本推不動——見上面那一支。
  expect(
    ta.canvas,
    '🔴 畫布的 touch-action 不是 none——瀏覽器會搶走捏合，\n' +
      '而我們自己的推畫面與它會打架。',
  ).toBe('none');
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
