/**
 * **在流程改一格，積木要跟著變**——2026-08-27，使用者：「流程和積木好像沒有同步到」。
 *
 * ## 根因：一個用「哪一類視圖」判斷來源的條件
 *
 * `handleEditTree` 廣播時寫死 `source: 'blocks'`，而積木面板據此**跳過**那種更新
 * （那是它自己的編輯，重畫會打斷拖曳、清掉復原堆疊）：
 *
 * ```ts
 * if ((event.source === 'code' || event.source === 'resync') && event.blockState) …
 * ```
 *
 * 流程面板 2026-08-26 也開始送 `edit:tree` 之後，**積木把它的編輯認成自己的**。
 * 實測：在流程改一個變數名，程式碼與流程都變了，**而積木上還寫著舊名字**。
 *
 * > **一個用「哪一類視圖」當來源的欄位，在第二個同類視圖出現的那天
 * > 會把別人的編輯認成自己的。**
 *
 * 🔴 修法**不是**讓核心去認某一顆面板的名字（P9 視圖獨立性），
 * 而是把「誰改的」如實傳下去（`originViewId`），由每個視圖判斷那是不是它自己。
 *
 * ## ⚠️ 而「一律重畫」也是錯的——所以第二支測試不可省
 *
 * 積木重畫自己的編輯會**打斷拖曳、清掉復原堆疊**。少了那一支，
 * 一個「拿掉所有跳過條件」的實作也會通過第一支。
 */
import { test, expect } from '@playwright/test'
import { freshApp, typeAndFormat } from './helpers'

const BASE = 'int main() { int total = 0; int b = 2; int c = 3; int d = 4; return 0; }'

const declFieldValue = (page: import('@playwright/test').Page): Promise<string | null> =>
  page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(o: boolean): { type: string; id: string; getFieldValue(n: string): string | null }[]
    } } } }).__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x) => x.type === 'cpp_var_declare')
    return b ? b.getFieldValue('NAME_0') : null
  })

const flowFieldValue = (page: import('@playwright/test').Page): Promise<string | null> =>
  page.evaluate(() => {
    const g = (window as never as { __app: { flowPanel: { graph: {
      nodes: { componentId: string; fields: { value: string }[] }[]
    } } } }).__app.flowPanel.graph
    return g.nodes.find((n) => n.componentId === 'cpp:var_declare')?.fields[0]?.value ?? null
  })

test('★ 在流程改一格 → 積木跟著變（而不是只有程式碼變）', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, BASE)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })

  // ★ 入口條件：三邊都真的看得到那個名字，否則下面在比 null
  await expect.poll(() => declFieldValue(page), { timeout: 8000 }).toBe('total')
  expect(await flowFieldValue(page), '流程上沒有那一格 → 這支測的不是那條路').toBe('total')

  await page.evaluate(() => {
    const fp = (window as never as { __app: { flowPanel: {
      graph: { nodes: { id: string; componentId: string }[] }
      editField(id: string, key: string, v: string): void
    } } }).__app.flowPanel
    const d = fp.graph.nodes.find((n) => n.componentId === 'cpp:var_declare')!
    fp.editField(d.id, 'name', 'renamed')
  })

  await expect
    .poll(() => declFieldValue(page), {
      timeout: 8000,
      message: '🔴 積木沒跟著變 —— `originViewId` 沒傳到，或積木仍然用 `source` 判斷來源',
    })
    .toBe('renamed')
  expect(await flowFieldValue(page), '流程自己也要是新的').toBe('renamed')
  expect(await page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode(),
  )).toContain('renamed')
})

test('★ 反向：在積木改一格 → 流程跟著變，而【積木不得被自己的編輯重畫】', async ({ page }) => {
  // 🔴 少了後半，一個「拿掉所有跳過條件、一律重畫」的實作也會通過上一支
  // ——而它的症狀是拖到一半積木自己跳掉、復原堆疊被清空。
  await freshApp(page)
  await typeAndFormat(page, BASE)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await expect(page.locator('.flow-toolbox')).toBeVisible({ timeout: 10_000 })
  await expect.poll(() => declFieldValue(page), { timeout: 8000 }).toBe('total')

  await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(o: boolean): { type: string; setFieldValue(v: string, n: string): void }[]
    } } } }).__app.blocklyPanel.workspace
    ws.getAllBlocks(false).find((x) => x.type === 'cpp_var_declare')!
      .setFieldValue('fromBlocks', 'NAME_0')
  })

  await expect
    .poll(() => flowFieldValue(page), { timeout: 8000, message: '🔴 流程沒跟著積木變' })
    .toBe('fromBlocks')

  // 🔴 **判準是【復原堆疊還在不在】，不是積木 id**（2026-08-27 注入抓到）。
  //
  // 第一版斷言「積木還是同一顆」——而**重畫會沿用 blockState 裡的 id**，
  // 於是「一律重畫」那個注入照樣通過。
  //
  // > **一個在缺陷存在時也不會變的量，量的不是那個缺陷。**
  //
  // 重畫那條路會 `clearUndo()`（見 `blockly-panel` 那一段的說明），
  // 所以復原堆疊是這件事**看得見的影子**。
  const undoDepth = await page.evaluate(() =>
    (window as never as { __app: { blocklyPanel: { workspace: {
      getUndoStack(): unknown[]
    } } } }).__app.blocklyPanel.workspace.getUndoStack().length)
  expect(
    undoDepth,
    '🔴 復原堆疊被清空了 —— 積木把【自己的】編輯也重畫了，' +
      '而那會打斷拖曳、讓使用者的復原歷史消失',
  ).toBeGreaterThan(0)
})
