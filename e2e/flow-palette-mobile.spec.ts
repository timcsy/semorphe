/**
 * **行動版流程視圖的積木盤：收合鈕要站在「目前展開到哪裡」的最外緣。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-30：「流程視圖 palette 行動版**多階層收合位置有問題**」。
 *
 * 量出來的（500×900）：
 *
 * ```
 * 分類條   x=0..84
 * 收合鈕   x=84..106      ← 卡在兩層【中間】
 * 彈出格   x=106..256     ← 絕對定位，緊貼著它右邊
 * ```
 *
 * 🔴 那顆鈕收的是**整個** palette（兩層一起），而它站在**第一層**的邊緣上
 * ——第二層一打開，它就被夾在那條 22px 的縫裡，看起來不屬於任何一邊。
 *
 * > **一顆按鈕的位置在說「我管的是這一塊」。
 * > 它管兩層而站在第一層的邊上，那句話就是錯的。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果量不到收合鈕（`boundingBox` 是 null），代表這一支根本不在行動版，
 * > 這份報表不算數——不是「位置都對了」。**
 *
 * 錨在**量到幾個狀態**（合成量）。🔴 刻意不錨在「錯位幾次」。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測它好不好按**——只檢測它在不在該在的那一邊。
 * - **不檢測桌機**——桌機上分類條靠邊排版、不蓋任何東西，
 *   那顆鈕 `display: none`（沒有理由收它）。
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

test('★ 行動版：收合鈕站在目前展開到哪裡的最外緣', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 900 })
  await freshApp(page)
  await page.waitForTimeout(2500)
  await page.locator('[data-tab="flow"]').last().click()
  await page.waitForTimeout(1500)

  const toggle = page.locator('.flow-palette-toggle')
  const palette = page.locator('.flow-palette')
  const toolbox = page.locator('.flow-toolbox')

  const right = async (l: import('@playwright/test').Locator): Promise<number | null> => {
    const b = await l.boundingBox()
    return b ? b.x + b.width : null
  }
  const leftOf = async (l: import('@playwright/test').Locator): Promise<number | null> =>
    (await l.boundingBox())?.x ?? null

  const seen: string[] = []

  // ① 分類條開著、彈出格關著 → 鈕貼在**分類條**的右緣
  seen.push('分類條開')
  expect(
    await leftOf(toggle),
    '🔴 量不到收合鈕 → 這一支不在行動版，這份報表不算數',
  ).not.toBeNull()
  expect(
    await leftOf(toggle),
    '🔴 彈出格關著時，鈕沒有貼在分類條的右緣',
  ).toBe(await right(toolbox))

  // ② 打開第二層 → 鈕移到**彈出格**的外緣（而不是夾在兩層中間）
  await page.locator('.flow-cat').first().click()
  await page.waitForTimeout(800)
  seen.push('彈出格開')
  await expect(palette, '🔴 第二層沒有打開 → 下面那條驗不出東西').toBeVisible()
  const paletteRight = await right(palette)
  expect(
    await leftOf(toggle),
    '🔴 第二層開著而鈕還夾在兩層中間——它收的是【整個】積木盤，\n' +
      '而它站的位置在說「我只管第一層」。',
  ).toBe(paletteRight)

  // ③ 關掉第二層 → 回到分類條的右緣
  await page.locator('.flow-cat').first().click()
  await page.waitForTimeout(800)
  seen.push('彈出格關回去')
  expect(
    await leftOf(toggle),
    '🔴 第二層關掉了而鈕沒有跟著回來——它會停在半空中',
  ).toBe(await right(toolbox))

  // ④ 整條收起 → 貼在畫布最左（它現在是「打開積木盤」的那顆）
  await toggle.click()
  await page.waitForTimeout(800)
  seen.push('整條收起')
  await expect(toolbox, '🔴 收起來了而分類條還在').toBeHidden()
  expect(
    await leftOf(toggle),
    '🔴 整條收起來了而鈕沒有貼到最左——那一條縫是空的，而鈕浮在它右邊',
  ).toBe(0)

  // ★ 入口條件——四個狀態都真的走到了
  expect(seen, '🔴 沒有走完四個狀態 → 上面那些斷言是空過的').toHaveLength(4)
})
