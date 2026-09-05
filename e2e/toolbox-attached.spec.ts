/**
 * ★ **取用面附著在它服務的那個視圖上——不得拆成獨立面板。**
 *
 * ## 🔴 為什麼需要它
 *
 * 使用者實測過，逐字：
 *
 * > 「獨立面板的拖曳效果超爛，**後來就放棄獨立面板了**」
 *
 * 而那不是一個風格偏好——它是一個**做過才知道**的結論：
 * 一個取用面（積木的工具箱、流程的 palette）的價值全在
 * 「從這裡拖到那裡」，而跨面板的拖曳在每一個宿主上都是另一套機制。
 *
 * > **一個取用面如果離開了它服務的畫布，它就從「拿東西的地方」
 * > 變成「一份清單」——而清單不需要拖曳。**
 *
 * ## ⚠️ 為什麼要一條護欄，而不是一條註解
 *
 * 「拆成獨立面板」在版面那一側看起來**永遠是進步的**：
 * 它讓每一格更乾淨、讓面板協定更整齊、讓宿主那側好排。
 * 而它的代價在**手上**，不在畫面上——所以下一個做版面的人不會看到它。
 *
 * 🔴 這條護欄擋的正是那個：**一個看起來像進步的改動**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管取用面長什麼樣**（Blockly 的工具箱與流程的 palette 差很多，
 *   而那是對的——每個視圖自己決定）
 * - **不管它開著還關著**（`flow-palette` 有一顆開關）
 * - **不管它裡面有幾類**（那是工具箱內容的護欄在管）
 */
import { test, expect, type Page } from '@playwright/test'

async function ready(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blocklyWorkspace, .injectionDiv').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3000)
}

/** 這個元素的祖先鏈上，有沒有那個選擇器指的容器。 */
const insideOf = (page: Page, child: string, ancestor: string): Promise<boolean> =>
  page.evaluate(([c, a]) => {
    const el = document.querySelector(c)
    return el !== null && el.closest(a) !== null
  }, [child, ancestor] as const)

test('★ 積木的工具箱住在積木面板裡，不是一個獨立面板', async ({ page }) => {
  test.setTimeout(90_000)
  await ready(page)

  // ★ 入口條件——工具箱真的在畫面上（否則下面那條是空過的）
  await expect(page.locator('.blocklyToolbox').first(),
    '🔴 一個工具箱都找不到 → 這支測不到任何東西').toBeAttached()

  expect(
    await insideOf(page, '.blocklyToolbox', '#blockly-panel'),
    '🔴 **工具箱被搬出積木面板了。**\n' +
      '   使用者實測過：「獨立面板的拖曳效果超爛，後來就放棄獨立面板了」。\n' +
      '   > 一個取用面如果離開了它服務的畫布，它就從「拿東西的地方」變成「一份清單」。',
  ).toBe(true)
})

test('★ 流程的 palette 住在流程面板裡', async ({ page }) => {
  test.setTimeout(90_000)
  await ready(page)

  // 切到流程那一層，palette 才建得出來
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click().catch(() => {})
  await page.locator('.quick-pick-item[data-value="three-column"]').click().catch(() => {})
  await page.waitForTimeout(3000)

  // ★ 入口條件——⚠️ **找不到就說出來，而不是靜靜通過**。
  //    這一支的價值在「它在對的地方」；而它一顆都不在的時候，
  //    上面那條斷言會**空過**，與通過長得一模一樣。
  const n = await page.locator('.flow-palette').count()
  expect(n, '🔴 一個 `.flow-palette` 都找不到 → 下面那條是空過的。' +
    '（若流程面板改了 class 名，先修這裡，不要刪這條測試）').toBeGreaterThan(0)

  expect(
    // ⚠️ 容器是 `#flow-panel`（id），而面板自己在 `container` 上加 `.flow-panel`
    //    ——兩個都接受：這條規矩管的是「在不在那個視圖裡」，不是它怎麼掛 class。
    await insideOf(page, '.flow-palette', '#flow-panel, .flow-panel'),
    '🔴 **流程的 palette 被搬出流程面板了**——同上，它的價值全在拖曳。',
  ).toBe(true)
})

/**
 * 🔴 **兩個取用面不得合成一個。**
 *
 * ⚠️ 這是「拆成獨立面板」的孿生錯誤：把兩個視圖的取用面**合併**
 * 成一個「元件庫」面板。它同樣看起來像進步（少一個重複的 UI），
 * 而它同樣把拖曳變成跨面板的。
 */
test('★ 兩個取用面各自獨立——不得合成一個共用的元件庫', async ({ page }) => {
  test.setTimeout(90_000)
  await ready(page)

  const shared = await page.locator('#component-library, .shared-palette, [data-panel="palette"]').count()
  expect(
    shared,
    '🔴 出現了一個共用的取用面板。⚠️ 那是「拆成獨立面板」的孿生錯誤：\n' +
      '   它少了一份重複的 UI，而它把【拖曳】變成跨面板的——代價在手上，不在畫面上。',
  ).toBe(0)
})
