/**
 * **從課文頁的按鈕點進來，有起點的題目要真的有起點。**
 *
 * ## 它從哪來
 *
 * 學生回報（第 3 課〈先試試看〉）：「到編輯器試試看**不太知道要幹嘛**」。
 * 而課文那一段寫著「那一題的畫面上已經有 `int age = 16;`」——**畫布是空的**。
 *
 * 查證之後發現的比那句話大：
 *
 * ```
 * 從【選單】挑題目     → 會種
 * 從【課文頁按鈕】進來 → 不會種      ← 而那是 ?task=，是學生唯一走的那條
 * ```
 *
 * 也就是說**那 30 道「排回去」從課文點進去全部是空畫布**
 * ——而它們是同一週才補上的，補的時候只驗了選單那條路。
 *
 * > **一個功能如果只在「我測試時走的那條路」上成立，
 * > 那它的驗收量的是我的習慣，不是使用者的路徑。**
 *
 * ## 🔴 而修好之後還有第二層
 *
 * 種下去了，卻**只有某些課種得進去**：第 3 課成功、第 10 課失敗。
 * 同一支函式、同一條路，差別只在那一課大一點——`syncCodeToBlocks`
 * 在同步管線就緒之前呼叫會**安靜地什麼都不做**。
 *
 * > **一個「早了一點就失效而且不出聲」的呼叫，
 * > 會在某些課上成立、某些課上不成立——而那看起來像資料的問題。**
 *
 * 所以這一支要**三種起點各驗一次**：起始檔、打散、除錯。
 */
import { test, expect } from '@playwright/test'

interface Seen { task: string; blocks: number; types: string[] }

async function openTask(page: import('@playwright/test').Page, lesson: string, task: string): Promise<Seen> {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto(`/?lesson=${encodeURIComponent(lesson)}&task=${task}`)
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 30_000 })
  // ⚠️ 種下去要等「第一次投影 ＋ 同步回來」，而那是兩段
  await page.waitForFunction(
    () => ((window as never as Record<string, any>).__app?.blocklyPanel?.workspace
      ?.getAllBlocks(false)?.length ?? 0) > 0,
    undefined, { timeout: 20_000 }).catch(() => { /* 讓下面的斷言說話 */ })
  return page.evaluate(() => {
    const a = (window as never as Record<string, any>).__app
    const bs = a.blocklyPanel.workspace.getAllBlocks(false)
    return { task: a.currentTaskId, blocks: bs.length, types: bs.map((b: any) => b.type) }
  })
}

test('🔴 有起始檔的題目：畫布上要有那份起點', async ({ page }) => {
  const s = await openTask(page, 'cpp-beginner/03-變數', 'try')
  expect(s.task).toBe('try')
  expect(s.blocks, '🔴 空畫布——而課文說「已經幫你放好」').toBeGreaterThan(0)
  expect(s.types, '🔴 起點裡該有那個宣告').toContain('cpp_var_declare')
})

test('🔴 排回去的題目：解答的積木要被打散在畫布上', async ({ page }) => {
  const s = await openTask(page, 'cpp-beginner/02-型別', 'rebuild')
  expect(s.task).toBe('rebuild')
  // ⚠️ 錨在「有沒有東西」而不是確切顆數——那一課的程式改一行，顆數就會變
  expect(s.blocks, '🔴 空畫布——那 30 道排回去從課文頁點進去全是這樣').toBeGreaterThan(3)
})

test('🔴 除錯題：壞掉的起點要在畫布上', async ({ page }) => {
  const s = await openTask(page, 'cpp-beginner/10-while迴圈', 'ex2')
  expect(s.task).toBe('ex2')
  expect(s.blocks, '🔴 空畫布——而除錯題沒有起點就等於沒有題目').toBeGreaterThan(3)
  expect(s.types, '🔴 壞掉的那支程式裡該有迴圈').toContain('cpp_loop_while')
})

/**
 * ★ **反向**：沒有起點的題目**不該**被種東西進去
 * ——不然學生打開「做一個」會看到別人的答案。
 */
test('★ 反向：沒有起點的題目，畫布保持乾淨', async ({ page }) => {
  const s = await openTask(page, 'cpp-beginner/02-型別', 'make')
  expect(s.task).toBe('make')
  expect(s.blocks, '🔴 「做一個」被種了東西進去——那會把答案端到他面前').toBe(0)
})
