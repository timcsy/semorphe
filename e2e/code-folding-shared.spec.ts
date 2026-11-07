/**
 * **程式碼的摺疊是共享狀態的第三個投影**（spec 189，vision〈分子〉「積木／程式碼的投影」的程式碼那一半）。
 *
 * ```
 * ① 流程收起 for → 程式碼裡 for 那一行摺起來
 * ② 在程式碼改一個不相干的值 → 仍摺著
 * ③ 流程展開 → 程式碼攤開
 * ④ 在程式碼裡自己摺 for（Monaco 的摺疊動作）→ 流程收成框、積木也收起來
 * ```
 */
import { test, expect, type Page } from '@playwright/test'
import { showFlowSlot, freshApp, appReady, useAsSource, treeReady, flowReady, editsSettled, frames } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const PROG = 'int main() {\n    int total = 1;\n    for (int i = 0; i < 3; i++) {\n        total = total * 2;\n        cout << total << endl;\n    }\n    return 0;\n}\n'

/** 程式碼裡 for 那一行（1 起算） */
const forLine = (page: Page): Promise<number> =>
  page.evaluate(() => (window as any).__app.codeView.getCode().split('\n').findIndex((l: string) => l.trim().startsWith('for (')) + 1)

/** for 那一行有沒有被摺起來（看下一行是不是被藏了） */
const codeFolded = (page: Page): Promise<boolean> =>
  page.evaluate(async () => {
    const ed = (window as any).__app.codeView.getEditor()
    const line = ed.getModel().getValue().split('\n').findIndex((l: string) => l.trim().startsWith('for (')) + 1
    const ranges = ed.getVisibleRanges() as { startLineNumber: number; endLineNumber: number }[]
    return !ranges.some((r) => r.startLineNumber <= line + 1 && r.endLineNumber >= line + 1)
  })

async function setCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (c) => {
    const a = (window as any).__app
    a.codeView.setCode(c)
    await a.syncController.syncCodeToBlocks(a.codeView.getCode())
  }, code)
  await editsSettled(page)
  await frames(page, 2)
}

async function flowMenu(page: Page, label: RegExp, collapsed: boolean): Promise<void> {
  const at = await page.evaluate((c) => {
    const n = (window as any).__app.flowPanel.graph.nodes.find((x: any) => x.componentId.startsWith('cpp:loop'))
    const r = document.querySelector(`[data-node="${n.id}"] .fc-node-header`)!.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, c }
  }, collapsed)
  await page.mouse.click(at.x, at.y, { button: 'right' })
  await page.locator('.flow-menu-item', { hasText: label }).click()
  await flowReady(page)
}

const blockLoopCollapsed = (page: Page): Promise<boolean | null> =>
  page.evaluate(() => {
    const ws = (window as any).__app.blocklyPanel.getWorkspace()
    const b = ws?.getAllBlocks(false).find((x: any) => /loop|for/.test(x.type))
    return b ? b.isCollapsed() : null
  })

test('★ 流程 ↔ 程式碼共用一份收合（摺疊）', async ({ page }) => {
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await showFlowSlot(page)
  await flowReady(page)
  expect(await forLine(page), '入口條件：程式碼裡有 for 那一行').toBeGreaterThan(0)
  expect(await codeFolded(page), '入口條件：一開始是攤開的').toBe(false)

  // ① 流程收起 → 程式碼摺起
  await flowMenu(page, /收合這一塊/, false)
  await expect.poll(() => codeFolded(page), { message: '流程收起 → 程式碼那一段摺起來' }).toBe(true)

  // ② 改一個不相干的值
  await setCode(page, PROG.replace('int total = 1;', 'int total = 5;'))
  await expect.poll(() => codeFolded(page), { message: '🔴 改值之後仍摺著' }).toBe(true)

  // ③ 流程展開 → 程式碼攤開
  await flowMenu(page, /展開這一塊/, true)
  await expect.poll(() => codeFolded(page), { message: '流程展開 → 程式碼攤開' }).toBe(false)

  // ④ 在程式碼裡自己摺 → 流程與積木跟著收
  const line = await forLine(page)
  await page.evaluate((l) => {
    const ed = (window as any).__app.codeView.getEditor()
    ed.trigger('e2e', 'editor.fold', { selectionLines: [l - 1], levels: 1 })
  }, line)
  await expect(page.locator('.fc-node.fc-collapsed'), '程式碼摺起 → 流程收成框').toHaveCount(1, { timeout: 5000 })
  await expect.poll(() => blockLoopCollapsed(page), { message: '程式碼摺起 → 積木也收起來' }).toBe(true)
})
