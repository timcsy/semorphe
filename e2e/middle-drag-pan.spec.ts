/**
 * **中鍵拖曳要推畫面，而不是拖走那顆積木。**
 *
 * 學生回饋（2026-09-10）：積木橫向長到出畫面，「有時候遇到這種其實蠻難滑的」。
 * Blockly 早就能拖背景平移——**而畫面滿的時候背景不存在**。
 *
 * ## ⚠️ 為什麼這一條非得在 e2e
 *
 * 單元測試派送的是**合成的** `PointerEvent`，而中鍵的坑全都在**真的按下去**
 * 那一側（Windows 的自動捲動、X11 的貼上主選取區、`auxclick`）。
 * 這裡是整套測試裡唯一一個地方，中鍵是瀏覽器自己發的。
 *
 * > **一個手勢的測試如果自己造事件，它驗的是接線，不是那個手勢。**
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, typeAndFormat } from './helpers'

const CODE = 'int main() { int x = 1; int y = 2; int z = 3; return 0; }'

const canvasTransform = (page: Page): Promise<string> =>
  page.locator('.blocklyBlockCanvas').first().evaluate((el) => (el as SVGElement).style.transform)

/**
 * 工作區上**每一顆**積木的位移。
 *
 * 🔴 **要全部，不能只看第一顆**：推畫面的起點若落在某顆子積木上，
 * 而 Blockly 拖走的正是那一顆——只看最外層那顆的話，這支測試會全綠。
 */
const allBlockTransforms = (page: Page): Promise<string> =>
  page.evaluate(() => JSON.stringify([...document.querySelectorAll('.blocklyBlockCanvas .blocklyBlock')]
    .map((el) => `${el.getAttribute('class')}@${el.getAttribute('transform')}`)))

/** 某一型積木的**頂端**——⚠️ 抓中點會落在下一塊上（`scaffold-code-complete` 記過）。 */
const topOf = (page: Page, type: string): Promise<{ x: number; y: number } | null> =>
  page.evaluate((ty) => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
      .__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).map((x) => x as { type: string; getSvgRoot(): SVGGraphicsElement })
      .find((x) => x.type === ty)
    if (!b) return null
    const r = b.getSvgRoot().getBoundingClientRect()
    return { x: r.x + 15, y: r.y + 12 }
  }, type)

const delta = (t: string): [number, number] => {
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(t)
  return m ? [Number(m[1]), Number(m[2])] : [NaN, NaN]
}

test('★ 中鍵壓在積木上拖 → 畫面跟著走，而每一顆積木都待在原地', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, CODE)

  const from = await topOf(page, 'cpp_var_declare')
  expect(from, '🔴 找不到宣告積木——前置條件沒成立').toBeTruthy()
  if (!from) return

  const beforeCanvas = await canvasTransform(page)
  const beforeBlocks = await allBlockTransforms(page)

  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(from.x + 120, from.y + 50, { steps: 20 })
  await page.mouse.up({ button: 'middle' })
  await page.waitForTimeout(300)

  // 🔴 位移要**逐字等於**手走的距離——不然是別的東西在動（縮放、捲軸、慣性）。
  const [bx, by] = delta(beforeCanvas)
  const [ax, ay] = delta(await canvasTransform(page))
  expect(Math.round(ax - bx)).toBe(120)
  expect(Math.round(ay - by)).toBe(50)

  // 🔴 一顆積木都沒有走——中鍵沒有被 Blockly 當成拖曳。
  expect(await allBlockTransforms(page)).toBe(beforeBlocks)
  // 手勢結束了：抓著的游標要拿掉。
  await expect(page.locator('.is-middle-panning')).toHaveCount(0)
})

test('★ 左鍵拖積木照樣拖得動——接管左鍵等於把積木變成拖不動', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, CODE)

  const from = await topOf(page, 'cpp_var_declare')
  expect(from, '🔴 找不到宣告積木——前置條件沒成立').toBeTruthy()
  if (!from) return

  const beforeCanvas = await canvasTransform(page)
  const beforeBlocks = await allBlockTransforms(page)

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 140, from.y + 260, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(1500)

  expect(await allBlockTransforms(page)).not.toBe(beforeBlocks)
  // ⚠️ 而畫面**不該**跟著走：那會是「一次動作被算了兩次」。
  expect(await canvasTransform(page)).toBe(beforeCanvas)
})
