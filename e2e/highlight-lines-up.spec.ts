/**
 * **點一顆積木，程式碼那一邊要亮【它自己那一行】。**
 *
 * ## 🔴 這一支怎麼來的（2026-09-15）
 *
 * 使用者：「積木跟程式碼好像 highlight 的地方對不上，會差一行」。實測：
 *
 * ```
 * 1  #include <iostream>     ← 補丁器塞進【文字】的，對照表算完之後才出現
 * 2  using namespace std;    「使用命名空間」那顆積木亮的是第 1 行
 * 5      cout << "hi" …      「印出」那顆亮第 4 行（`return 0;`）
 * ```
 *
 * 每一顆都早一行，而差的正是那一條 `#include`。
 *
 * > **一份對照表，如果它描述的文字在它算完之後又被動過，
 * > 那它描述的是一份不存在的文字——而它看起來仍然是一份合法的對照表。**
 *
 * ## ⚠️ 而它為什麼要走 e2e，不是單元測試
 *
 * 那個位移發生在**組裝點的 wrapper 裡**（補完相依之後把文字寫回編輯器），
 * 而對照表住在控制器、消費者住在 monaco 面板——三個地方各自都是對的。
 *
 * > **一個「三邊各自正確」的缺陷，只有把三邊接起來才量得到。**
 *
 * 🪦 而我第一次量的時候**判成「本來就是對的」**：對照表是 0-based，
 * 我拿 1-based 去讀它。基準寫在消費端（`m.startLine + 1`），不在產生端。
 */
import { test, expect, type Page } from '@playwright/test'

interface AppWindow {
  __app: {
    codeView: { getCode?(): string }
    syncController: { codeMappings?: { nodeId: string; startLine: number; endLine: number }[] }
    blocklyPanel: {
      getNodeIdForBlockId(id: string): string | null | undefined
      workspace: { getAllBlocks(ordered: boolean): { id: string; type: string }[] }
    }
  }
}

async function typeInMain(page: Page, body: string): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(
    () => Boolean((window as unknown as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(2500)
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+Home')
  const code0 = await page.evaluate(() => (window as unknown as AppWindow).__app.codeView.getCode?.() ?? '')
  const mainAt = code0.split('\n').findIndex((l) => l.includes('int main()'))
  expect(mainAt, '🔴 起點沒有 main → 這支測的不是那條路').toBeGreaterThanOrEqual(0)
  for (let i = 0; i <= mainAt; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(body, { delay: 12 })
  await page.waitForTimeout(4000)
}

/** 每一顆有對照的積木：它指到的那一行，內容是什麼。 */
const aim = (page: Page): Promise<{ type: string; line: number; text: string }[]> =>
  page.evaluate(() => {
    const app = (window as unknown as AppWindow).__app
    const lines = (app.codeView.getCode?.() ?? '').split('\n')
    const out: { type: string; line: number; text: string }[] = []
    for (const b of app.blocklyPanel.workspace.getAllBlocks(false)) {
      const nodeId = app.blocklyPanel.getNodeIdForBlockId(b.id)
      if (!nodeId) continue
      const m = (app.syncController.codeMappings ?? []).find((x) => x.nodeId === nodeId)
      if (!m) continue
      out.push({ type: b.type, line: m.startLine + 1, text: lines[m.startLine] ?? '' })
    }
    return out
  })

/** 一顆積木「該亮哪一行」——由它的型別導出的一小段特徵字串。 */
const EXPECT: Record<string, string> = {
  cpp_using_namespace: 'using namespace',
  cpp_func_def: 'int main()',
  cpp_return: 'return 0;',
  cpp_print: 'cout <<',
  cpp_include: '#include',
}

test('第 5 課：自動補了 #include 之後，每一顆積木仍指著自己那一行', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto(`/?lesson=${encodeURIComponent('cpp-beginner/05-程式從哪開始')}`)
  await typeInMain(page, 'cout << "hi" << endl;')

  const code = await page.evaluate(() => (window as unknown as AppWindow).__app.codeView.getCode?.() ?? '')
  // ★ 入口條件：補丁器真的插了那一行，不然這支在驗一個不會發生的情況
  expect(code, '🔴 沒有自動補的 #include → 這支測不到那個位移').toContain('#include <iostream>')

  const rows = await aim(page)
  expect(rows.length, '🔴 一顆積木都沒有對照 → 下面在驗空集合').toBeGreaterThan(2)
  for (const r of rows) {
    const want = EXPECT[r.type]
    if (want === undefined) continue
    expect(r.text, `🔴 ${r.type} 指到第 ${r.line} 行，而那一行是 ${JSON.stringify(r.text)}`)
      .toContain(want)
  }
})

test('自由練習：同一件事，而且它是【點下去真的會亮】那一行', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await typeInMain(page, 'int a = 1;\ncout << a << endl;')

  const rows = await aim(page)
  for (const r of rows) {
    const want = EXPECT[r.type]
    if (want === undefined) continue
    expect(r.text, `🔴 ${r.type} 指到第 ${r.line} 行：${JSON.stringify(r.text)}`).toContain(want)
  }

  // 🔴 **走一次使用者真的會做的動作**：點那顆「印出」，看編輯器亮在哪
  //    ——上面驗的是對照表，這一條驗的是【畫面】。
  const printId = await page.evaluate(() => (window as unknown as AppWindow).__app
    .blocklyPanel.workspace.getAllBlocks(false).find((b) => b.type === 'cpp_print')?.id)
  expect(printId, '🔴 畫布上沒有「印出」積木').toBeTruthy()
  await page.evaluate((id: string) => {
    const el = document.querySelector(`[data-id="${id}"]`) as SVGElement | null
    el?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    el?.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, printId!)
  await page.waitForTimeout(1200)

  const lit = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.view-line')] as HTMLElement[]
    const hi = document.querySelector('.monaco-line-highlight') as HTMLElement | null
    if (!hi) return null
    const top = hi.getBoundingClientRect().top
    const near = lines.find((l) => Math.abs(l.getBoundingClientRect().top - top) < 4)
    return near?.textContent ?? ''
  })
  if (lit !== null) {
    expect(lit, '🔴 點了「印出」而亮起來的不是那一行').toContain('cout')
  }
})
