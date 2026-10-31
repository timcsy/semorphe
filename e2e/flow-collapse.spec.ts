/**
 * **流程面板把一塊收成一個有埠的框**（spec 187，vision〈分子〉）。
 *
 * ```
 * ① 右鍵 for →「收合這一塊」→ 框出現（寫著收著幾塊）、裡面的節點不畫
 * ② 在程式碼裡改一個不相干的值 → 🔴 框還是收著（nodeId 全換了，鑰匙對得回去）
 * ③ 右鍵框 →「展開這一塊」→ 節點數回到原本、程式碼一字不差
 * ```
 * ⚠️ vision 原文：「今天 e2e 測過收合的條數是 0」——這一支是第一條。
 */
import { test, expect, type Page } from '@playwright/test'
import { showFlowSlot, useAsSource, freshApp, appReady, treeReady, flowReady } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const PROG = 'int main() {\n    int total = 1;\n    for (int i = 0; i < 3; i++) {\n        total = total * 2;\n        cout << total << endl;\n    }\n    return 0;\n}\n'
const FOR = 'cpp:loop'  // for (int i = 0; i < 3; i++) 會 lift 成計數迴圈或 for——比對前綴

const nodeCount = (page: Page): Promise<number> =>
  page.evaluate(() => (window as any).__app.flowPanel.graph.nodes.length)
const codeNow = (page: Page): Promise<string> => page.evaluate(() => (window as any).__app.codeView.getCode())

async function setCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (c) => {
    const a = (window as any).__app
    a.codeView.setCode(c)
    await a.syncController.syncCodeToBlocks(a.codeView.getCode())
  }, code)
  await flowReady(page)
}

/** 某個身分那顆節點標題列上、真的點得到它的那一點 */
const headOf = (page: Page, comp: string): Promise<{ x: number; y: number } | null> =>
  page.evaluate((c) => {
    const n = (window as any).__app.flowPanel.graph.nodes.find((x: any) => x.componentId.startsWith(c))
    if (!n) return null
    const r = document.querySelector(`[data-node="${n.id}"] .fc-node-header`)?.getBoundingClientRect()
    if (!r) return null
    for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = r.x + r.width * f
      const y = r.y + r.height / 2
      if (document.elementsFromPoint(x, y)[0]?.closest(`[data-node="${n.id}"]`)) return { x, y }
    }
    return null
  }, comp)

async function menu(page: Page, comp: string, label: RegExp): Promise<void> {
  const at = await headOf(page, comp)
  expect(at, `找不到 ${comp} 那顆節點`).not.toBeNull()
  await page.mouse.click(at!.x, at!.y, { button: 'right' })
  await expect(page.locator('.flow-menu')).toBeVisible({ timeout: 5000 })
  await page.locator('.flow-menu-item', { hasText: label }).click()
  await flowReady(page)
}

test('★ 收合 → 打一個字仍收著 → 展開回到原樣', async ({ page }) => {
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await showFlowSlot(page)
  await flowReady(page)

  const before = await nodeCount(page)
  const code = await codeNow(page)

  // ① 收合
  await menu(page, FOR, /收合這一塊/)
  const box = page.locator('.fc-node.fc-collapsed')
  await expect(box).toHaveCount(1)
  await expect(box).toContainText(/收著 \d+ 塊/)
  const inside = Number(await box.getAttribute('data-collapsed'))
  expect(inside).toBeGreaterThan(3)
  expect(await nodeCount(page)).toBe(before - inside)
  expect(await codeNow(page), '收合不改程式碼').toBe(code)

  // ② 改一個不相干的值——nodeId 全換了
  await setCode(page, PROG.replace('int total = 1;', 'int total = 5;'))
  await expect(page.locator('.fc-node.fc-collapsed'), '🔴 打一個字之後框還收著').toHaveCount(1)
  await setCode(page, PROG)

  // ③ 展開
  await menu(page, FOR, /展開這一塊/)
  await expect(page.locator('.fc-node.fc-collapsed')).toHaveCount(0)
  expect(await nodeCount(page)).toBe(before)
  expect(await codeNow(page)).toBe(code)
})
