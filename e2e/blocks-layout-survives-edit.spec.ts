/**
 * **改程式碼之後，手排的積木留在原位**（vision「暫停的代償」）。
 * 位置是版面，happy-dom 量不到；配對與「先後不同就不套用」由 `tests/unit/panels/keep-layout.test.ts` 釘。
 */
import { test, expect } from '@playwright/test'
import { freshApp, typeAndFormat, editsSettled, frames, blocksSettled } from './helpers'

type Top = { x: number; y: number; n: number }

const tops = (page: import('@playwright/test').Page): Promise<Top[]> => page.evaluate(() => {
  const ws = (window as never as { __app: { blocklyPanel: { workspace: { getTopBlocks(o: boolean): { getRelativeToSurfaceXY(): { x: number; y: number }; getDescendants(o: boolean): unknown[] }[] } } } }).__app.blocklyPanel.workspace
  return ws.getTopBlocks(true).map((b) => ({ ...b.getRelativeToSurfaceXY(), n: b.getDescendants(false).length }))
})

const setCode = (page: import('@playwright/test').Page, code: string): Promise<void> => page.evaluate(async (c) => {
  const a = (window as never as { __app: { codeView: { setCode(s: string): void; getCode(): string }; syncController: { syncCodeToBlocks(s: string): Promise<unknown> } } }).__app
  a.codeView.setCode(c)
  await a.syncController.syncCodeToBlocks(a.codeView.getCode())
}, code)

/** 把最上層那條的最後一句（main）拖開，放到右下 */
const dragLastAway = (page: import('@playwright/test').Page): Promise<void> => page.evaluate(() => {
  type B = { getNextBlock(): B | null; unplug(h: boolean): void; moveBy(x: number, y: number): void }
  const ws = (window as never as { __app: { blocklyPanel: { workspace: { getTopBlocks(o: boolean): B[] } } } }).__app.blocklyPanel.workspace
  let b = ws.getTopBlocks(true)[0]
  while (b.getNextBlock()) b = b.getNextBlock()!
  b.unplug(false)
  b.moveBy(420, 260)
})

test('★ 拖開 main 之後在程式碼裡改一個字——兩疊都留在原地，程式順序不變', async ({ page }) => {
  await freshApp(page)
  await typeAndFormat(page, 'int f() { return 1; } int main() { cout << f(); return 0; }')
  await editsSettled(page); await frames(page, 4)
  const start = await tops(page)
  expect(start.length, '入口條件：程式碼轉出來是一疊').toBe(1)

  await dragLastAway(page)
  await blocksSettled(page)
  const before = await tops(page)
  expect(before.length, '入口條件：拖開之後兩疊').toBe(2)

  const code = await page.evaluate(() => (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())
  expect(code).toContain('return 1;')
  await setCode(page, code.replace('return 1;', 'return 2;'))
  await editsSettled(page); await frames(page, 4)

  const after = await tops(page)
  expect(after.length, '兩疊沒有被併回去').toBe(2)
  expect(after.map((t) => [Math.round(t.x), Math.round(t.y)])).toEqual(before.map((t) => [Math.round(t.x), Math.round(t.y)]))
  const now = await page.evaluate(() => (window as never as { __app: { codeView: { getCode(): string } } }).__app.codeView.getCode())
  expect(now.indexOf('return 2;'), '程式碼有換').toBeGreaterThan(-1)
  expect(now.indexOf('int f()'), '程式順序不變').toBeLessThan(now.indexOf('int main()'))
})
