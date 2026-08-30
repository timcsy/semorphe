/**
 * **選取要看得見、刪得掉，而且三個視圖一起亮。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-30：「現在節點好像沒有辦法被「選」，我說的選是**有高亮**，
 * **可以 Delete 刪除**，也可以**同步把其他面板的 node 高亮**」。
 *
 * 量出來的：點一顆節點 → `.fc-node.fc-sel` **是 0**。
 *
 * 🔴 根因：選取掛在 `click` 上，而它**永遠不會發**——拖曳的
 * `pointerdown` 裡有一行 `ev.preventDefault()`。
 *
 * > **`preventDefault()` 在 `pointerdown` 上不只擋掉預設行為，
 * > 它把整條相容事件鏈都關掉了——包括你正要用的那一個。**
 *
 * 🟢 改成「按下去**沒有移動**就是選取」：tap ＝ 選，drag ＝ 移。
 *
 * ## 而跨視圖反白**不是新機制**
 *
 * 這個 app 早就有一條以 `nodeId` 為鍵的反白（積木 ↔ 程式碼）。
 * 流程視圖只是**沒有加入**。
 *
 * > **一個只有自己看得到的選取，在多視圖的編輯器裡等於沒有選。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果圖上一顆節點都沒有，這份報表不算數——不是「選取好了」。**
 */
import { test, expect } from '@playwright/test'
import { useAsSource, freshApp } from './helpers'

const PROG = 'int main() {\n    int a = 1;\n    cout << a << endl;\n    return 0;\n}\n'
const flat = (s: string): string => s.replace(/#include[^\n]*\n/g, '').replace(/\s+/g, ' ').trim()

async function openFlow(page: import('@playwright/test').Page): Promise<void> {
  await freshApp(page)
  await page.waitForTimeout(2000)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2500)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(1800)
}

const headOf = (page: import('@playwright/test').Page, comp: string): Promise<{ x: number; y: number } | null> =>
  page.evaluate((c) => {
    const g = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
      .__app.flowPanel.graph
    const n = g.nodes.find((x) => x.componentId === c)
    if (!n) return null
    const r = document.querySelector(`[data-node="${n.id}"] .fc-node-header`)?.getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  }, comp)

const codeNow = async (p: import('@playwright/test').Page): Promise<string> =>
  flat(await p.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? ''))

test('★ 點一顆節點：亮起來、Delete 刪得掉', async ({ page }) => {
  await openFlow(page)
  // ★ 入口條件
  expect(await page.locator('.fc-node').count(), '🔴 圖上一顆節點都沒有 → 這份報表不算數')
    .toBeGreaterThan(0)

  const at = await headOf(page, 'cpp:var_declare')
  expect(at, '🔴 找不到那顆節點').toBeTruthy()
  await page.mouse.click(at!.x, at!.y)
  await page.waitForTimeout(600)

  await expect(
    page.locator('.fc-node.fc-sel'),
    '🔴 點了節點而它沒有亮起來。⚠️ 2026-08-30 的根因是選取掛在 `click` 上，\n' +
      '而拖曳的 `pointerdown` 裡那一行 `preventDefault()` 把它壓掉了。',
  ).toHaveCount(1)

  await page.locator('.flow-canvas').press('Delete')
  await page.waitForTimeout(1800)
  expect(await codeNow(page), '🔴 Delete 沒有刪掉選取的那一顆').not.toContain('int a')
})

test('★ 拖曳仍然是拖曳——移動過就不算「選」', async ({ page }) => {
  // ⚠️ 沒有這一支的話，一個「pointerdown 就選取」的實作也會通過上面那一條
  //    ——而它會讓每一次拖曳都順便改掉選取。
  await openFlow(page)
  // ⚠️ **先清掉**——程式碼的游標本來就會驅動一次跨視圖反白（那是刻意的），
  //    所以進場時可能已經有一顆是亮的。不清的話這一支驗的是那一顆。
  await page.locator('.flow-canvas').press('Escape')
  await page.waitForTimeout(400)
  await expect(page.locator('.fc-node.fc-sel'), '🔴 Escape 沒有清掉選取').toHaveCount(0)
  const at = await headOf(page, 'cpp:var_declare')
  const before = await codeNow(page)
  await page.mouse.move(at!.x, at!.y)
  await page.mouse.down()
  await page.mouse.move(at!.x + 90, at!.y + 60, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  expect(await codeNow(page), '🔴 拖曳改到了程式——位置在流程視圖上只是排版').toBe(before)
  await expect(
    page.locator('.fc-node.fc-sel'),
    '🔴 拖曳之後那一顆被選起來了——那會讓「拖完順手按 Delete」變成災難',
  ).toHaveCount(0)
})

test('★ 三個視圖一起亮——兩個方向都要', async ({ page }) => {
  await openFlow(page)
  const lit = (): Promise<{ blocks: number; flow: number }> => page.evaluate(() => ({
    blocks: document.querySelectorAll('.blocklySvg [class*=highlight]').length,
    flow: document.querySelectorAll('.fc-node.fc-sel').length,
  }))

  // ① 流程 → 其他
  await page.mouse.click((await headOf(page, 'cpp:print'))!.x, (await headOf(page, 'cpp:print'))!.y)
  await page.waitForTimeout(800)
  const a = await lit()
  expect(a.flow, '🔴 流程自己沒亮').toBe(1)
  expect(a.blocks, '🔴 在流程選了一顆，而積木那邊沒有跟著亮').toBeGreaterThan(0)

  // ② 積木 → 流程（**反方向不可省**：只做單向的實作也會通過上面那一段）
  await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(b: boolean): { type: string; select(): void }[] } } } }).__app.blocklyPanel.workspace
    ws.getAllBlocks(false).find((x) => x.type === 'cpp_var_declare')?.select()
  })
  await page.waitForTimeout(900)
  expect((await lit()).flow, '🔴 在積木選了一塊，而流程那邊沒有跟著亮').toBe(1)

  // ★ 而它真的是**同一顆**——按 Delete 刪掉的要是剛剛在積木上選的那一個
  await page.locator('.flow-canvas').press('Delete')
  await page.waitForTimeout(1800)
  expect(
    await codeNow(page),
    '🔴 流程亮的不是積木選的那一顆——兩邊的反白對不起來',
  ).not.toContain('int a')
})

test('★ 切分頁不得把反白清掉', async ({ page }) => {
  // 🔴 使用者 2026-08-30：「積木發出的高亮好像無法傳到流程」
  //    ——而他自己猜對了：「**切換到流程的 tab 會全部取消選取**」。
  //
  // 追出來的呼叫鏈逐字：
  //
  // ```
  // highlightNode(null)  ←  BlocklyPanel.onNodeSelectCallback
  // ```
  //
  // **點分頁按鈕就在工作區外面**，而 Blockly 對「點外面」的反應是取消選取。
  //
  // > **`null` 在那個事件裡有兩個意思：「使用者取消選取了」
  // > 與「焦點離開了這個視圖」——而它們長得一模一樣。**
  //
  // ⚠️ 而**第一版的修法不成立**：「看不見的視圖說的話不算數」——
  //    取消選取發生在 `display: none` **之前**，那一刻它還看得見。
  await freshApp(page)
  await page.waitForTimeout(2000)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROG)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2500)

  // 在積木上真的點一塊（此時積木分頁是開著的）
  const at = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(b: boolean): { type: string; getSvgRoot(): SVGGraphicsElement }[] } } } }).__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x) => x.type === 'cpp_var_declare')
    if (!b) return null
    const r = b.getSvgRoot().getBoundingClientRect()
    return { x: r.x + 25, y: r.y + 12 }
  })
  expect(at, '🔴 積木上找不到那一塊 → 這一支驗不出東西').toBeTruthy()
  await page.mouse.click(at!.x, at!.y)
  await page.waitForTimeout(1000)

  // ★ 入口條件：切之前流程那邊真的有一顆是亮的
  const before = await page.locator('.fc-node.fc-sel').count()
  expect(before, '🔴 切之前流程就沒有亮 → 下面那條驗的不是「切分頁弄丟了」').toBe(1)

  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(1500)

  await expect(
    page.locator('.fc-node.fc-sel'),
    '🔴 切到流程分頁之後反白不見了——那個 `null` 是「焦點離開」，不是「取消選取」',
  ).toHaveCount(1)

  // 🔴 **切回去也要還在**（使用者 2026-08-30 當場又抓到）：
  //    「點了一塊積木，切到流程，還在，**但是切回積木，就沒了**」
  //
  //    第二版的修法是「`null` 只清發話者自己那一側」，而發話者正是積木
  //    ——它自己的反白在離開的那一刻就被清掉了。
  //
  // > **一個「離開時順手收拾自己」的動作，在你回來的時候看起來像遺失。**
  await page.locator('[data-tab="blocks"], button', { hasText: /^積木$/ }).first().click()
  await page.waitForTimeout(1400)
  await expect(
    page.locator('.blocklySvg [class*=highlight]'),
    '🔴 切回積木之後它自己的反白不見了',
  ).toHaveCount(1)
  await expect(
    page.locator('.fc-node.fc-sel'),
    '🔴 切回積木之後流程那邊的反白不見了',
  ).toHaveCount(1)
})
