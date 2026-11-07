/**
 * **積木的收合是共享狀態的投影**（spec 188，vision〈分子〉「積木／程式碼的投影」的積木那一半）。
 *
 * ```
 * ① 用 Blockly 自己的收合收起 for → 流程面板也收成框（積木 → 狀態）
 * ② 在程式碼裡改一個不相干的值 → 積木重畫了，🔴 for 那塊還收著（以前重畫就攤開）
 * ③ 流程面板展開 → 積木也攤開（狀態 → 積木）；再收一次
 * ④ 重新整理 → 積木與流程都還收著（存檔存鑰匙，v25）
 * ⑤ 舊存檔（v24，沒有 `collapsed`，收合只在 `blocklyState` 裡）→ 升級後不被攤開（收編）
 * ```
 */
import { test, expect, type Page } from '@playwright/test'
import { showFlowSlot, appKeepingStorage, flowReady, editsSettled, frames } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const PROG = 'int main() {\n    int total = 1;\n    for (int i = 0; i < 3; i++) {\n        total = total * 2;\n        cout << total << endl;\n    }\n    return 0;\n}\n'

async function setCode(page: Page, code: string): Promise<void> {
  await page.evaluate(async (c) => {
    const a = (window as any).__app
    a.codeView.setCode(c)
    await a.syncController.syncCodeToBlocks(a.codeView.getCode())
  }, code)
  await editsSettled(page)
  await frames(page, 2)
}

/** 積木上的那塊迴圈收著沒有（`null` ＝ 找不到） */
const blockLoopCollapsed = (page: Page): Promise<boolean | null> =>
  page.evaluate(() => {
    const ws = (window as any).Blockly?.getMainWorkspace?.() ?? (window as any).__app.blocklyPanel.getWorkspace?.()
    const b = ws?.getAllBlocks(false).find((x: any) => /loop|for/.test(x.type))
    return b ? b.isCollapsed() : null
  })

const flowBoxes = (page: Page) => page.locator('.fc-node.fc-collapsed')

test('★ 積木 ↔ 流程共用一份收合；打字、重新整理都還在', async ({ page }) => {
  await appKeepingStorage(page)
  await setCode(page, PROG)
  await showFlowSlot(page)
  await flowReady(page)
  expect(await blockLoopCollapsed(page), '入口條件：積木上要有那塊迴圈，而且是攤開的').toBe(false)

  // ① 用 Blockly 自己的收合（等同右鍵「收合這一塊」）
  await page.evaluate(() => {
    const ws = (window as any).Blockly?.getMainWorkspace?.() ?? (window as any).__app.blocklyPanel.getWorkspace?.()
    ws.getAllBlocks(false).find((x: any) => /loop|for/.test(x.type)).setCollapsed(true)
  })
  await expect(flowBoxes(page), '積木收起來 → 流程也收成框').toHaveCount(1, { timeout: 5000 })

  // ② 改一個不相干的值——積木從程式碼重畫
  await setCode(page, PROG.replace('int total = 1;', 'int total = 5;'))
  await expect.poll(() => blockLoopCollapsed(page), { message: '🔴 重畫之後積木那塊還收著' }).toBe(true)
  await expect(flowBoxes(page)).toHaveCount(1)

  // ③ 流程展開 → 積木攤開
  const box = flowBoxes(page).first()
  const r = await box.locator('.fc-node-header').boundingBox()
  await page.mouse.click(r!.x + r!.width / 2, r!.y + r!.height / 2, { button: 'right' })
  await page.locator('.flow-menu-item', { hasText: /展開這一塊/ }).click()
  await expect(flowBoxes(page)).toHaveCount(0)
  await expect.poll(() => blockLoopCollapsed(page), { message: '流程展開 → 積木也攤開' }).toBe(false)
  // 再從積木收一次，存檔
  await page.evaluate(() => {
    const ws = (window as any).Blockly?.getMainWorkspace?.() ?? (window as any).__app.blocklyPanel.getWorkspace?.()
    ws.getAllBlocks(false).find((x: any) => /loop|for/.test(x.type)).setCollapsed(true)
  })
  await expect(flowBoxes(page)).toHaveCount(1, { timeout: 5000 })
  await page.evaluate(() => (window as any).__app.autoSave())
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('semorphe-state') ?? '{}'))
  expect(saved.collapsed?.length, '存檔裡要有那一筆鑰匙').toBe(1)
  expect(saved.version).toBe(25)

  // ④ 重新整理
  await page.reload()
  await page.waitForFunction(() => Boolean((window as any).__appReady), undefined, { timeout: 30_000 })
  await showFlowSlot(page)
  await flowReady(page)
  await expect(flowBoxes(page), '重新整理之後流程還收著').toHaveCount(1, { timeout: 10_000 })
  await expect.poll(() => blockLoopCollapsed(page), { message: '重新整理之後積木還收著' }).toBe(true)

  // ⑤ 舊存檔：把版本改回 24、拿掉 collapsed——收合只剩 blocklyState 裡那一格
  await page.evaluate(() => (window as any).__app.autoSave())
  const old = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('semorphe-state') ?? '{}')
    delete st.collapsed
    st.version = 24
    localStorage.setItem('semorphe-state', JSON.stringify(st))
    return JSON.stringify(st.blocklyState).includes('"collapsed":true')
  })
  expect(old, '入口條件：舊存檔的 blocklyState 裡要有收著的那塊').toBe(true)
  await page.reload()
  await page.waitForFunction(() => Boolean((window as any).__appReady), undefined, { timeout: 30_000 })
  await showFlowSlot(page)
  await flowReady(page)
  await expect.poll(() => blockLoopCollapsed(page), { message: '🔴 舊存檔升級後積木不被攤開' }).toBe(true)
  await expect(flowBoxes(page), '收編之後流程也收成框').toHaveCount(1, { timeout: 10_000 })
})
