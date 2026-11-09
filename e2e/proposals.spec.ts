/**
 * **提議中的變更**（spec 220；history/334：AI 的變更預設待人確認，人接受才進語意樹）。
 *
 * 外部操作者經 `__app.proposals.submit` 送；人在提議列上看差異、按接受或退回。
 */
import { test, expect, type Page } from '@playwright/test'
import { freshApp, useAsSource, codeLines } from './helpers'

const SRC = '#include <iostream>\nusing namespace std;\nint main() {\n    int n = 5;\n    if (n > 3) {\n        n = 1;\n    }\n    return 0;\n}\n'

async function setCpp(page: Page, code: string): Promise<void> {
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await expect(page.locator('.blocklyDraggable').first()).toBeVisible({ timeout: 15_000 })
}

/** 目前的樹上第一顆某元件的 id。 */
const idOf = (page: Page, componentId: string) => page.evaluate((c) => {
  const st = [(window as any).__app.syncController.getCurrentTree()]
  while (st.length) { const n = st.pop(); if (n.componentId === c) return n.id as string; for (const k of Object.values(n.slots ?? {})) st.push(...(k as any[])) }
  return null
}, componentId)

const submit = (page: Page, input: unknown) => page.evaluate((i) => (window as any).__app.proposals.submit(i), input)
const code = async (page: Page) => (await codeLines(page)).join('\n')
const PRINT_N = { componentId: 'cpp:print', slots: { values: [{ componentId: 'cpp:var_ref', properties: { name: 'n' } }, { componentId: 'cpp:endl' }] } }

test('送出 → 程式不變、提議列出現差異；接受 → 程式變了；復原 → 回到原樣', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  const before = await code(page)
  const main = await idOf(page, 'cpp:func_def')
  const t0 = Date.now()
  const r = await submit(page, { author: '助教 AI', rationale: '讀完之後印出 n', ops: [{ op: 'insert', parent: main, slot: 'body', index: 1, node: PRINT_N }] })
  expect(r.status).toBe('pending')
  const bar = page.locator('.proposal-bar')
  await expect(bar).toBeVisible()
  // SC-001：送出到看見提議 < 1 秒
  expect(Date.now() - t0).toBeLessThan(1000)
  await expect(bar).toContainText('助教 AI')
  await expect(bar).toContainText('讀完之後印出 n')
  await expect(bar.locator('.proposal-diff-add')).toContainText('cout << n << endl;')
  expect(await code(page)).toBe(before)

  await bar.locator('.proposal-accept').click()
  await expect(bar).toHaveCount(0)
  await expect.poll(() => code(page)).toContain('cout << n << endl;')
  // SC-004：接受後的程式與差異的右邊一致——印出那一行落在宣告之後
  const after = (await code(page)).split('\n').map((l) => l.trim())
  expect(after.indexOf('cout << n << endl;')).toBe(after.indexOf('int n = 5;') + 1)

  await page.locator('#undo-btn').click()
  await expect.poll(() => code(page)).toBe(before)
})

test('退回 → 程式不變', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  const before = await code(page)
  await submit(page, { ops: [{ op: 'remove', node: await idOf(page, 'cpp:if') }] })
  const bar = page.locator('.proposal-bar')
  await expect(bar).toContainText('未具名')
  await expect(bar.locator('.proposal-diff-del').first()).toContainText('if')
  await bar.locator('.proposal-reject').click()
  await expect(bar).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(await code(page)).toBe(before)
})

test('送出之後人改了程式碼的別處 → 提議仍可接受，接受後保留人的修改（spec 221：身分沿用）', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  await submit(page, { ops: [{ op: 'remove', node: await idOf(page, 'cpp:if') }] })
  const bar = page.locator('.proposal-bar')
  await expect(bar.locator('.proposal-accept')).toBeEnabled()
  // 改程式碼 → 重新解析；沒動到的節點保住身分
  await setCpp(page, SRC.replace('int n = 5;', 'int n = 6;'))
  await page.waitForTimeout(300)
  await expect(bar).toHaveAttribute('data-status', 'pending')
  await expect(bar.locator('.proposal-diff-same').filter({ hasText: 'int n = 6;' })).toHaveCount(1)
  await bar.locator('.proposal-accept').click()
  // ⚠️ 等的是【接受造成的改變】（if 不見了）——`int n = 6;` 在接受之前就在了，等它會立刻通過、搶在接受生效之前斷言（長測試在忙碌的機器上撞到）
  await expect.poll(() => code(page)).not.toContain('if (')
  expect(await code(page)).toContain('int n = 6;')
})

test('送出之後人刪掉了它指的那個節點 → 過期、接受停用、只能退回', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  await submit(page, { ops: [{ op: 'remove', node: await idOf(page, 'cpp:if') }] })
  const bar = page.locator('.proposal-bar')
  await setCpp(page, SRC.replace('    if (n > 3) {\n        n = 1;\n    }\n', ''))
  await expect(bar).toHaveAttribute('data-status', 'stale', { timeout: 10_000 })
  await expect(bar.locator('.proposal-accept')).toBeDisabled()
  await expect(bar.locator('.proposal-bar-stale')).toBeVisible()
  await bar.locator('.proposal-reject').click()
  await expect(bar).toHaveCount(0)
})

test('套用範例 → 程式被換掉，提議過期（即使新程式也有 main）', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  await submit(page, { ops: [{ op: 'insert', parent: await idOf(page, 'cpp:func_def'), slot: 'body', index: 0, node: PRINT_N }] })
  const bar = page.locator('.proposal-bar')
  await expect(bar).toHaveAttribute('data-status', 'pending')
  await page.locator('.status-item-btn[data-control-id="template"]').click()
  await page.locator('.quick-pick-item[data-value="01-空白程式"]').click()
  const confirmApply = page.locator('.quick-pick-item').filter({ hasText: /^套用/ })
  if (await confirmApply.count() > 0) await confirmApply.first().click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await expect(bar).toHaveAttribute('data-status', 'stale', { timeout: 10_000 })
  await expect(bar.locator('.proposal-bar-stale')).toContainText('套用了範例')
  await expect(bar.locator('.proposal-accept')).toBeDisabled()
})

test('連送三個 → 依序；說得出還有幾個', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  const main = await idOf(page, 'cpp:func_def')
  const decl = await idOf(page, 'cpp:var_declare')
  await submit(page, { author: 'A', ops: [{ op: 'setProperty', node: decl, name: 'name', value: 'total' }] })
  await submit(page, { author: 'B', ops: [{ op: 'insert', parent: main, slot: 'body', index: 0, node: PRINT_N }] })
  await submit(page, { author: 'C', ops: [{ op: 'remove', node: await idOf(page, 'cpp:if') }] })
  const bar = page.locator('.proposal-bar')
  await expect(bar.locator('.proposal-bar-count')).toContainText('3')
  await expect(bar.locator('.proposal-bar-author')).toContainText('A')
  await bar.locator('.proposal-reject').click()
  await expect(bar.locator('.proposal-bar-author')).toContainText('B')
  await expect(bar.locator('.proposal-bar-count')).toContainText('2')
})

test('不合法的提議 → refused、畫面上沒有提議列', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  const r = await submit(page, { ops: [{ op: 'remove', node: 'node_nope' }] })
  expect(r.status).toBe('refused')
  expect(r.reason.code).toBe('node-missing')
  await page.waitForTimeout(300)
  await expect(page.locator('.proposal-bar')).toHaveCount(0)
  // 外部只能送與查，不能替人接受
  expect(await page.evaluate(() => typeof (window as any).__app.proposals.accept)).toBe('undefined')
})

test('詞彙：拿得到目前語言的元件，照它組的提議通過（spec 222）', async ({ page }) => {
  await freshApp(page)
  await setCpp(page, SRC)
  const vocab = await page.evaluate(() => (window as any).__app.proposals.vocabulary())
  expect(vocab.length).toBeGreaterThan(100)
  expect(vocab.every((e: { componentId: string }) => e.componentId.startsWith('cpp:'))).toBe(true)
  const print = vocab.find((e: { componentId: string }) => e.componentId === 'cpp:print')
  expect(print.slots.find((s: { slot: string }) => s.slot === 'values').accepts).toEqual(['expression'])
  // 說明文字照畫面的語系（spec 226）
  expect(print.description).toBe('印出一個或多個值到螢幕上')
  const r = await submit(page, { author: 'AI', ops: [{ op: 'insert', parent: await idOf(page, 'cpp:func_def'), slot: 'body', index: 0, node: { componentId: print.componentId, slots: { values: [{ componentId: 'cpp:var_ref', properties: { name: 'n' } }] } } }] })
  expect(r.status).toBe('pending')
})

