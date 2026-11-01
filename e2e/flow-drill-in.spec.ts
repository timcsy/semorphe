/**
 * **鑽入 ＋ 麵包屑**（spec 193，vision〈分子〉「鑽入 ＋ 麵包屑 ＋ 裝配樹」的前兩件）。
 *
 * ```
 * ① 最外層手拖一顆、記下每一顆的位置
 * ② 右鍵 →「進入這一塊」三層（外層 for → 內層 for → if），麵包屑一層一層長出來、圖只剩那一層的身體
 * ③ 在裡層時改一個不相干的值 → 🔴 仍停在同一層（鑰匙不是 id）
 * ④ 點麵包屑跳回第一層、Esc 回到最外層 → 麵包屑消失、每一顆回到原位（含手拖的那一顆）
 * ```
 * 🔴 麵包屑**沒鑽進去時不存在**——history/193：「一個要等到東西變多才有價值的控制項，在那之前是純粹的成本」。
 */
import { test, expect, type Page } from '@playwright/test'
import { showFlowSlot, freshApp, appReady, useAsSource, treeReady, flowReady } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
// ⚠️ 三層都在 main 的身體裡——預設的骨架模式把 main 本身攤開（流程圖上沒有 main 那一顆），第一版從 main 鑽起就找不到
const PROG = 'int main() {\n    int k = 1;\n    for (int i = 0; i < 3; i++) {\n        for (int j = 0; j < 2; j++) {\n            if (i > k) {\n                cout << i << j << endl;\n            }\n        }\n    }\n    return 0;\n}\n'

const crumbs = (page: Page) => page.locator('.flow-crumbs .flow-crumb')
const positions = (page: Page): Promise<{ id: string; x: number; y: number }[]> =>
  page.evaluate(() => (window as any).__app.flowPanel.boxPositions())
const comps = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as any).__app.flowPanel.graph.nodes.map((n: any) => n.componentId))

async function enter(page: Page, prefix: string): Promise<void> {
  const at = await page.evaluate((c) => {
    const n = (window as any).__app.flowPanel.graph.nodes.find((x: any) => x.componentId.startsWith(c))
    if (!n) return null
    const r = document.querySelector(`[data-node="${n.id}"] .fc-node-header`)!.getBoundingClientRect()
    for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = r.x + r.width * f
      const y = r.y + r.height / 2
      if (document.elementsFromPoint(x, y)[0]?.closest(`[data-node="${n.id}"]`)) return { x, y }
    }
    return null
  }, prefix)
  expect(at, `找不到 ${prefix} 那顆節點（或被蓋住）`).not.toBeNull()
  await page.mouse.click(at!.x, at!.y, { button: 'right' })
  await page.locator('.flow-menu-item', { hasText: /進入這一塊/ }).click()
  await flowReady(page)
}

test('★ 三層進出回到原位；在裡層改一個字仍停在那一層', async ({ page }) => {
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await showFlowSlot(page)
  await flowReady(page)
  await expect(page.locator('.flow-crumbs'), '沒鑽進去時麵包屑不在畫面上').toBeHidden()

  // ① 手拖一顆，記下位置
  const first = (await positions(page))[0]
  await page.evaluate((id) => (window as any).__app.flowPanel.moveNode(id, 40, 30), first.id)
  const before = await positions(page)
  expect(before.find((p) => p.id === first.id)!.x).toBe(first.x + 40)

  // ② 三層
  await enter(page, 'cpp:loop')
  await expect(crumbs(page)).toHaveCount(2)
  expect((await comps(page)).filter((c) => c.startsWith('cpp:loop')), '外層迴圈的身體裡只剩內層那一個迴圈').toHaveLength(1)
  await enter(page, 'cpp:loop')
  await expect(crumbs(page)).toHaveCount(3)
  await enter(page, 'cpp:if')
  await expect(crumbs(page)).toHaveCount(4)
  expect(await comps(page), '最裡層只剩 if 的身體').not.toContain('cpp:if')
  expect((await comps(page)).some((c) => c.startsWith('cpp:loop')), '外面兩層的迴圈不在圖上').toBe(false)

  // ③ 在裡層改一個不相干的值
  await page.evaluate(async (c) => {
    const a = (window as any).__app
    a.codeView.setCode(c)
    await a.syncController.syncCodeToBlocks(a.codeView.getCode())
  }, PROG.replace('int k = 1;', 'int k = 2;'))
  await flowReady(page)
  await expect(crumbs(page), '🔴 改一個字之後仍停在第三層').toHaveCount(4)

  // ④ 點麵包屑回到第一層（main 裡面），再 Esc 回到最外層
  await crumbs(page).nth(1).dispatchEvent('pointerdown')
  await expect(crumbs(page)).toHaveCount(2)
  await page.locator('.flow-canvas').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.flow-crumbs')).toBeHidden()
  const after = await positions(page)
  expect(after.length, '回到最外層，節點數與一開始一樣').toBe(before.length)
  expect(after.map((p) => [p.x, p.y]), '🔴 每一顆回到原位（含手拖的那一顆）').toEqual(before.map((p) => [p.x, p.y]))
})
