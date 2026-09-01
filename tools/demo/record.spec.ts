/**
 * **README 第一屏那段動畫。**
 *
 * 腳本（每一拍都要看得懂，所以中間有刻意的停頓）：
 *
 * ```
 * ① 打一段四行、有迴圈的 C++      → 積木與流程【同時】長出來
 * ② 在【程式碼】改一個數字         → 另外兩格當場跟著變
 * ③ 在【積木】改一個字串           → 另外兩格當場跟著變
 * ④ 在【流程】改一個數字           → 另外兩格當場跟著變
 * ⑤ 按執行                         → 第四格（主控台）印出來
 * ```
 *
 * 🔴 **第五拍不是裝飾**：十字有四格，而前四拍只用到三格——
 * 主控台那一格整片空著，畫面上有四分之一是死的。
 * 而「按下去真的會跑」本來就是這個工具與「積木玩具」的差別。
 *
 * 🔴 **為什麼是這三拍**（2026-09-01 重錄）：README 的標語是
 * 「同一支程式，三種看法——**改哪一邊都算數**」，而**舊的那支只證明了兩邊**
 * （程式碼、積木），第三邊只是「切過去看一眼」。
 *
 * > **一支示範如果在它自己的標語上留了一格沒證明，
 * > 那一格就是讀者會懷疑的那一格。**
 *
 * 🟢 而它以前錄不出來：三個投影要切分頁才看得到。
 * **十字版面**（spec 168／169）讓四格同時在畫面上——改一邊，
 * 另外兩邊在**同一張畫面裡**一起動。
 *
 * ⚠️ **打字用真的 `type()`，不用 `setCode()`**：後者一瞬間就完成，
 * 而觀眾要看到的正是「它在跟著我變」。
 */
import { test, expect, type Page } from '@playwright/test'

/**
 * 🔴 **不打結尾的 `}`**——Monaco 會自動補上右括號。
 *
 * 第一版把整段（含 `}`）打進去，結果是**多出來的括號**：畫面上出現
 * 「1 個語法錯誤」與一顆 `直接寫程式碼：}}`——**一段讓產品看起來壞掉的示範**。
 *
 * > **錄示範時，工具的貼心功能會變成你的雜訊。**
 *
 * 🔴 **也不要自己打縮排**——編輯器在 `{` 之後會自動縮排，打進去的空白會疊上去。
 * 症狀是「每一行前面多了一層」，而它**不會報錯**。（同一條，第二次）
 */
const PROGRAM = [
  'int main() {',
  'int n = 3;',
  'for (int i = 0; i < n; i++) {',
  'cout << "Hi " << i << endl;',
].join('\n')

const app = <T>(page: Page, fn: string): Promise<T> =>
  page.evaluate(fn) as Promise<T>

const codeNow = (page: Page): Promise<string> =>
  app(page, `window.__app.codeView.getCode?.() ?? ''`)

test('demo', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 60_000 })
  await page.waitForTimeout(1200)

  // ⓪ 切到【十字】——這一支示範的前提：四格同時看得到
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await page.locator('.quick-pick-item[data-value="grid"]').click()
  await page.waitForFunction(() => document.body.getAttribute('data-layout') === 'grid')
  await page.waitForTimeout(1200)

  // ① 打字 → 積木與流程同時長出來
  await page.evaluate(() =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(''))
  await page.waitForTimeout(600)
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.type(PROGRAM, { delay: 22 })
  await page.waitForTimeout(2600)

  // 🔴 **錄製器要驗自己的產出**——一段「看起來壞掉」的示範比沒有示範更糟。
  //    ⚠️ 而它是靜靜壞的：影片照樣錄得出來，只是畫面上有一行紅字。
  const bad = await page.evaluate(() => {
    const code = (window as never as { __app: { codeView: { getCode?(): string } } })
      .__app.codeView.getCode?.() ?? ''
    return {
      code,
      extraBrace: /\}\s*\}\s*\}/.test(code.trim().replace(/\n/g, ' ')),
      raw: document.body.innerText.includes('直接寫程式碼'),
      err: /語法錯誤|syntax error/i.test(document.body.innerText),
      // ⚠️ 這一支最深有**兩層**（`main` → `for`），所以門檻是 12 不是 8。
      //    🔴 舊版寫 8——那時的示範沒有迴圈。**門檻要跟著示範的深度走。**
      overIndent: code.split('\n').filter((l) => /^ {12,}\S/.test(l)),
    }
  })
  if (bad.extraBrace || bad.raw || bad.err || bad.overIndent.length > 0) {
    throw new Error(
      `🔴 這一段錄出來是【壞的】，不要拿去當示範：\n` +
      `   多餘的括號 ${bad.extraBrace} · 灰色積木 ${bad.raw} · 語法錯誤 ${bad.err}\n` +
      `   縮排疊了兩層 ${bad.overIndent.length} 行：${JSON.stringify(bad.overIndent)}\n` +
      `   實際產出：\n${bad.code}`)
  }
  // ★ 入口條件：三格真的都有東西，否則下面「同步」演給誰看
  const grew = await page.evaluate(() => ({
    blocks: (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
      .__app.blocklyPanel.workspace.getAllBlocks(false).length,
    flow: document.querySelectorAll('.fc-node').length,
  }))
  if (grew.blocks < 3 || grew.flow < 2) {
    throw new Error(`🔴 只長出 積木 ${grew.blocks} 顆／流程 ${grew.flow} 顆——這一段沒有東西可以演同步`)
  }

  // ② 在【程式碼】改一個數字：3 → 5
  //
  // 🔴 **不要用 `dblclick` 選「那一行」**——`getByText` 配到的是整行的元素，
  //    而雙擊只會選中**游標底下那一個詞**。第一版因此打出
  //    `int n = 5;` ＋ `n = 3;` **兩行**——一段看起來壞掉的示範。
  //
  // > **「選起來再打」在編輯器裡不是一個動作，是一個【假設】
  // > ——而它假設的是你選到了你以為的那一段。**
  //
  // 🟢 改用**確定性的鍵盤動作**：跳到那一行的行尾 → 退兩格 → 打新的。
  await page.getByText('int n = 3;').first().click()
  await page.keyboard.press('End')
  await page.waitForTimeout(300)
  await page.keyboard.press('Backspace')   // ;
  await page.keyboard.press('Backspace')   // 3
  await page.keyboard.type('5;', { delay: 120 })
  await page.waitForTimeout(2200)
  const afterCode = await codeNow(page)
  expect(afterCode, '🔴 程式碼那一拍沒改成').toContain('n = 5')
  // 🔴 **而且是【取代】不是【插入】**——第一版就是這樣壞掉的
  expect(
    afterCode.split('\n').filter((l) => /\bn\s*=/.test(l)).length,
    `🔴 那一行被【插入】了而不是取代——錄出來是一段壞掉的示範：\n${afterCode}`,
  ).toBe(1)

  // ③ 在【積木】改一個字串
  const field = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: {
      getAllBlocks(b: boolean): { type: string; getSvgRoot(): SVGGraphicsElement }[] } } } })
      .__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).find((x) => x.type === 'cpp_literal_string')
    if (!b) return null
    const r = b.getSvgRoot().getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (!field) throw new Error('🔴 積木上找不到字串那一格——這一拍演不出來')
  await page.mouse.click(field.x, field.y)
  await page.waitForTimeout(700)
  // 🔴 **`ControlOrMeta`**——macOS 上 `Control+A` 在輸入框裡是「移到行首」，
  //    不是全選。第一版因此錄出「嗨，世界Hello!」：新字**接在舊字前面**。
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('嗨 ', { delay: 110 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2200)
  expect(await codeNow(page), '🔴 積木那一拍沒有傳到程式碼').toContain('"嗨 "')

  // ④ 在【流程】改迴圈的起點：0 → 1
  //
  // 🪦 **本來想演「改名字」，而那會錄出一段壞掉的示範**（2026-09-01 實測）：
  //    在流程上把宣告從 `n` 改成 `total`，**參照留在原地**——
  //    產出是 `int total = 5;` 配 `for (int i = 0; i < n; ...)`，
  //    按執行印出「變數 'n' 尚未宣告」。
  //
  // 🔴 那是一個**真的產品缺陷**（改名不改參照），不是示範的問題
  //    ——記在 `knowledge/draft/2026-03-11-已知工程待解問題.md`。
  //
  // > **一支會驗自己產出的示範，會替你抓到產品的缺陷
  // > ——因為它做的正是使用者會做的事。**
  //
  // 🔴 節點的屬性是 `data-node`（不是 `data-node-id`），可編輯的那一格是
  //    `.fc-field-editable`，它前面還有一塊 `.fc-field-hit` 負責接點擊。
  //    ⚠️ 第一版猜了 `data-node-id`，於是**這一拍整段沒有發生**——
  //    而它包在 `if (fnode)` 裡，所以測試照樣綠。
  //
  // > **一段「找不到就跳過」的示範步驟，會在找不到的那天靜靜地少錄一拍。**
  const fnode = await page.evaluate(() => {
    const fp = (window as never as { __app: { flowPanel: {
      graph: { nodes: { id: string; componentId: string }[] } } } }).__app.flowPanel
    // 迴圈的起點——⚠️ **用【值】挑，不要用身分挑**：圖上有兩顆
    //    `cpp:literal_number`（宣告的 5 與迴圈起點的 0），
    //    而 `.find(身分)` 會拿到第一顆，也就是錯的那一顆。
    //
    // > **當同一種東西有很多顆，「第一顆」不是一個判準，是一個賭。**
    const nodes = fp.graph.nodes as unknown as
      { id: string; componentId: string; fields?: { value: string }[] }[]
    const d = nodes.find((n) => n.componentId === 'cpp:literal_number' && n.fields?.[0]?.value === '0')
    if (!d) return null
    const el = [...document.querySelectorAll('.fc-node')]
      .find((n) => (n as HTMLElement).dataset.node?.startsWith(d.id))
    const hit = el?.querySelector('.fc-field-editable')
    const r = hit?.getBoundingClientRect()
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  })
  if (!fnode) throw new Error('🔴 流程上找不到可編輯的那一格——這一拍演不出來')
  await page.mouse.click(fnode.x, fnode.y)
  await page.waitForTimeout(900)
  const input = page.locator('#flow-panel input').first()
  await expect(input, '🔴 點下去沒有跳出輸入框——這一拍看不到動作').toHaveCount(1)
  await input.press('ControlOrMeta+A')
  await input.type('1', { delay: 140 })
  await input.press('Enter')
  await page.waitForTimeout(2400)
  expect(await codeNow(page), '🔴 流程那一拍沒有傳到程式碼').toContain('i = 1')

  // ⑤ 按執行 → 主控台印出來（十字的第四格）
  // ⚠️ **不要寫成 `'#run-btn, button'` 配 `hasText`**——`hasText` 會同時套到
  //    逗號兩邊，於是 `#run-btn` 也得通過那個文字比對。第一版因此一個都沒配到，
  //    而**它不會報「找不到」，它報的是最後那句斷言失敗**（主控台是空的）。
  //
  // > **一個複合選擇器加上篩選，篩的是【全部】分支——
  // > 而你以為那個 id 是免篩的。**
  await page.locator('#run-btn').click()
  await page.waitForTimeout(3200)
  const printed = await page.evaluate(() =>
    document.querySelector('.console-output')?.textContent ?? '')
  expect(printed, '🔴 主控台沒有印出東西——第四格還是空的').toContain('嗨')

  await page.waitForTimeout(1600)
})
