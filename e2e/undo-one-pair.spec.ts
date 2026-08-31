/**
 * **畫面上只有一對「還原／取消還原」，而它退得掉每一種來源。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-30：「還原和取消還原有沒有辦法共用？還是這做不到？」
 * ——那時畫面上有**三對**：
 *
 * ```
 * 程式碼工具列  ↩ 還原 / ↪ 取消還原   → Monaco 自己的【文字】undo
 * 快速列        ↩ ↪                   → 登錄表的 undo/redo → 轉送
 * 流程工具列    ↶ ↷                   → 樹的歷史（同一天才加的）
 * ```
 *
 * > **同一件事在同一個畫面上有兩個開關，是一個必然會不一致的東西。**
 *
 * ## 🔴 而「共用」只共用得了按鈕，共用不了歷史
 *
 * ```
 * code    一次打字（字元群組）——編輯器自己的顆粒度最好
 * blocks  一次工作區事件
 * flow    一次語義樹的改動（而版面位移根本不在樹裡）
 * ```
 *
 * 三者的「一步」不是同一個東西，硬合成一份會讓「打字打到一半按還原」
 * 整段跳掉。所以做法是**一對按鈕 ＋ 依「上一步在哪裡做的」轉送**。
 *
 * ⚠️ 那個轉送是**近似的**：連按兩次可能跨到另一份堆疊。
 * 代價換到的是「畫面上只有一對」，而那比三對一致得多。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果快速列那一顆找不到，這份報表不算數——不是「只剩一對了」。**
 */
import { test, expect } from '@playwright/test'
import { useAsSource, freshApp, appReady, treeReady } from './helpers'

const PROG = 'int main() {\n    int a = 1;\n    cout << a << endl;\n    return 0;\n}\n'
const flat = (s: string): string => s.replace(/#include[^\n]*\n/g, '').replace(/\s+/g, ' ').trim()
const codeNow = async (p: import('@playwright/test').Page): Promise<string> =>
  flat(await p.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? ''))

test('★ 畫面上只有一對還原按鈕', async ({ page }) => {
  await freshApp(page)
  await appReady(page)

  // ★ 入口條件（見檔頭的自我否證）
  await expect(page.locator('#undo-btn'), '🔴 快速列那一顆不見了 → 這份報表不算數').toHaveCount(1)

  expect(
    await page.locator('.clipboard-btn', { hasText: /還原/ }).count(),
    '🔴 程式碼工具列又長回一對「還原」了',
  ).toBe(0)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(1500)
  expect(
    await page.locator('.flow-toolbar button[title="還原"]').count(),
    '🔴 流程工具列又長回一對 ↶↷ 了',
  ).toBe(0)
})

test('★ 在流程刪掉的，按【快速列】那一顆就退得回來', async ({ page }) => {
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(1600)

  const base = await codeNow(page)
  expect(base, '🔴 一開始就沒有那一句 → 驗不出東西').toContain('cout')

  const at = await page.evaluate(() => {
    const g = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
      .__app.flowPanel.graph
    const n = g.nodes.find((x) => x.componentId === 'cpp:print')
    if (!n) return null
    const r = document.querySelector(`[data-node="${n.id}"] .fc-node-header`)?.getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  })
  expect(at, '🔴 找不到那顆節點').toBeTruthy()
  await page.mouse.click(at!.x, at!.y, { button: 'right' })
  await expect(page.locator('.flow-menu'), '🔴 右鍵沒有開出選單').toBeVisible({ timeout: 5000 })
  await page.locator('.flow-menu-item').first().click()
  await page.waitForTimeout(1600)
  expect(await codeNow(page), '🔴 沒有刪掉').not.toContain('cout')

  // 🔴 **按的是快速列那一顆**——流程視圖已經沒有自己的還原了
  await page.locator('#undo-btn').click()
  await page.waitForTimeout(1600)
  expect(
    await codeNow(page),
    '🔴 那一顆退不掉流程做的事——轉送沒有走到樹的歷史',
  ).toBe(base)

  // ★ 反方向：取消還原要再把它刪掉
  await page.locator('#redo-btn').click()
  await page.waitForTimeout(1600)
  expect(await codeNow(page), '🔴 取消還原沒有作用').not.toContain('cout')
})
