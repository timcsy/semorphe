/**
 * **鷹架怎麼顯示，都不得改到程式碼。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-28：「我想說**程式碼的部分還是要顯示完整**，
 * 但是其他視圖可以有相對應的顯示」。
 *
 * 量完之後那個分工**本來就成立**，而它成立的理由值得記下來：
 *
 * ```
 * 🔴 語義樹   print                                     ← 鷹架【不在裡面】
 * 程式碼      #include · using · main · print · return  ← 產生器在最外層補完整
 * 積木        由 scaffoldDepth 決定畫幾顆
 * ```
 *
 * 也就是說**鷹架不是語義的一部分，是投影的一部分**——
 * 而「程式碼要完整」是因為**它是要能編譯的東西**：
 * 一支少了 `int main()` 的程式不是「簡化的程式」，是**不能跑的程式**。
 *
 * > **可以少畫的是投影，不能少的是那份要拿去跑的東西。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果三種模式量到的程式碼都是空字串，代表頁面沒開起來——
 * > 這份報表不算數，不是「三種都一致」。**
 *
 * 錨在**程式碼的長度**（合成量），不是「差異數」。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測積木畫幾顆**——那是 `lesson-pins.spec.ts` 那一族。
 * - **不檢測流程視圖**——⚠️ 它今天**沒有問過鷹架該怎麼顯示**，
 *   而那是一個還沒設計的格子（使用者：「可能要做更多的設計」）。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource, appReady, treeReady, setScaffoldMode as pickScaffold } from './helpers'

const PROGRAM =
  '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "hi" << endl;\n    return 0;\n}\n'

test('★ 三種鷹架模式，程式碼逐字相同', async ({ page }) => {
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c),
    PROGRAM)
  await useAsSource(page, '程式碼')
  await treeReady(page)

  const codeOf = async (): Promise<string> => page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')

  const seen: Record<string, string> = {}
  for (const mode of ['editable', 'ghost', 'hidden'] as const) {
    await pickScaffold(page, mode)
    seen[mode] = await codeOf()
  }

  // ★ 入口條件——錨在**程式碼長度**（合成量）。空的代表頁面沒開起來。
  expect(
    seen.editable.length,
    '🔴 程式碼是空的 → 頁面沒開起來，下面在比兩個空字串',
  ).toBeGreaterThan(20)

  for (const mode of ['ghost', 'hidden'] as const) {
    expect(
      seen[mode],
      `🔴 鷹架設成「${mode}」之後程式碼變了——` +
        `一支少了 \`int main()\` 的程式不是「簡化的程式」，是**不能跑的程式**。\n` +
        `  可以少畫的是投影，不能少的是那份要拿去跑的東西。`,
    ).toBe(seen.editable)
  }

  // ★ 而它必須真的還是那支完整的程式（不是三個都一樣地壞掉）
  for (const must of ['#include', 'int main(', 'return 0']) {
    expect(seen.hidden, `🔴 程式碼裡少了 \`${must}\``).toContain(must)
  }
})

test('★ 改顯示模式，不得改到語義樹', async ({ page }) => {
  // 🔴 **這一條抓到過一個真的**（2026-08-28）。
  //
  // 第一版的 `setScaffoldMode` 呼叫 `syncBlocksToCodeWithMappings()`
  // ——而那支從**積木**產生程式碼，積木畫的是**剝過鷹架的顯示樹**。
  // 於是切一次顯示模式，`currentTree` 就從
  //
  // ```
  // include · using_namespace · func_def     →     print
  // ```
  //
  // **一個「顯示設定」把唯一真實給改掉了**，而方向還是反的
  // （切成「完整」反而變少）。
  //
  // > **改投影的動作不得寫回真相。**
  //
  // ⚠️ 而它的症狀是**無聲的**：程式碼那一側看起來還好，
  // 因為產生器會把鷹架補回去——下一次同步才會發現東西不見了。
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c),
    PROGRAM)
  await useAsSource(page, '程式碼')
  await treeReady(page)

  const bodyOf = async (): Promise<string[]> => page.evaluate(() => {
    const t = (window as never as {
      __app: { syncController: { getCurrentTree(): { children?: { body?: { componentId?: string }[] } } | null } }
    }).__app.syncController.getCurrentTree()
    return (t?.children?.body ?? []).map((n) => n.componentId ?? '')
  })

  const before = await bodyOf()
  // ★ 入口條件——錨在**樹的節點數**（合成量）。空的代表同步沒完成。
  expect(before.length, '🔴 語義樹是空的 → 同步沒完成，下面在比兩個空陣列').toBeGreaterThanOrEqual(2)
  // ⚠️ 而它必須真的含著鷹架——否則這一條驗的是一棵本來就沒有鷹架的樹
  expect(
    before.filter((c) => /include|using_namespace/.test(c)).length,
    '🔴 這棵樹裡本來就沒有鷹架 → 下面「不得改到」驗不出東西',
  ).toBeGreaterThan(0)

  for (const mode of ['editable', 'hidden', 'ghost'] as const) {
    await pickScaffold(page, mode)
    expect(
      await bodyOf(),
      `🔴 切成「${mode}」之後語義樹變了——**改投影的動作寫回了真相**`,
    ).toEqual(before)
  }
})

test('★ `ghost` 在積木上要真的看得出來——淡的 ＋ 動不了', async ({ page }) => {
  // 🔴 使用者 2026-08-28 看著畫面說「**淡的好像失效了**」。
  //
  // 而它**不是失效，是從來沒做過**：`ghost` 只在 Monaco（程式碼側）有實作
  // （`.ghost-line`，opacity 0.4 ＋ 斜體），而積木這一側
  // `grep -rn ghost src/ui/panels` 是**零筆**——
  // 於是 `ghost` 與 `editable` 在積木上視覺完全相同。
  //
  // > **一個模式如果在某個視圖上與另一個模式長得一樣，
  // > 那個視圖就沒有實作它——而選單仍然讓人選得到。**
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c),
    PROGRAM)
  await useAsSource(page, '程式碼')
  await treeReady(page)

  const snap = async (): Promise<{ ghost: string[]; locked: string[]; all: number }> =>
    page.evaluate(() => {
      const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
        .__app.blocklyPanel.workspace
      const bs = ws.getAllBlocks(false).map((b) => b as { type: string; isMovable(): boolean; getSvgRoot?(): SVGElement })
      return {
        ghost: bs.filter((b) => b.getSvgRoot?.()?.classList.contains('ghost-block')).map((b) => b.type),
        locked: bs.filter((b) => !b.isMovable()).map((b) => b.type),
        all: bs.length,
      }
    })

  // 🔴 **這一支驗的是視覺**——要等 `markOutOfScopeBlocks`（產品裡的 900ms）
  const pick = async (mode: 'editable' | 'ghost' | 'hidden'): Promise<void> => {
    await pickScaffold(page, mode, { visual: true })
  }

  await pick('editable')
  const ed = await snap()
  // ★ 入口條件——錨在**畫布上有幾塊積木**（合成量）
  expect(ed.all, '🔴 畫布上沒有積木 → 同步沒完成，下面在比空的').toBeGreaterThanOrEqual(5)
  expect(ed.ghost, '🔴 `editable` 模式下不該有任何淡的積木').toEqual([])

  await pick('ghost')
  const gh = await snap()
  // 🔴 **四塊鷹架**：#include · using namespace · int main() · return 0
  expect(
    gh.ghost.length,
    '🔴 `ghost` 模式下沒有任何積木變淡——那與 `editable` 長得一樣，' +
      '而選單仍然讓人選得到',
  ).toBeGreaterThanOrEqual(4)
  // ⚠️ **`int main()` 那一塊是關鍵**：它靠「函式定義 ＋ 名字叫 main」才是鷹架，
  //    而那是**節點**的性質不是元件的性質——只掃元件身分的話它會漏掉。
  expect(
    gh.ghost.some((t) => t.includes('func_def')),
    '🔴 `int main()` 沒有變淡——骨架最重要的那一塊漏了',
  ).toBe(true)
  // 🪦 這裡曾經斷言「淡的一定要 `isMovable() === false`」——**而那條被實測推翻**。
  //    設了它，學生的積木就**插不進 `main` 與 `return` 之間**
  //    （連接判定要能把被擠掉的那塊移走）。
  //
  //    > **「不能拖」與「不能被移動」在 Blockly 裡是同一個旗標，而我們只要前者。**
  //
  //    🟢 「拖不動」改由**拖曳策略**表達，而它由下面那三支各自驗。
  expect(
    gh.locked.filter((t) => /print|literal_string/.test(t)),
    '🔴 把學生自己的積木鎖住了',
  ).toEqual([])

  // 🔴 **字也要淡**（使用者 2026-08-28：「我希望淡的積木那邊，**字也要是淡的**」）。
  //
  // 第一版的 CSS 寫的是 `.blocklyEditableField` / `.blocklyNonEditableField`
  // ——而積木的**標籤**（「使用命名空間」「回傳」）住在 `.blocklyLabelField` 裡，
  // **一個都沒中**。於是外框是淡的、字是亮的。
  //
  // > **一個對著不存在的類別名寫的規則，與沒有寫是同一件事，
  // > 而它看起來像已經處理過了。**
  //
  // ⚠️ 所以這一條量的是**算出來的 opacity**，不是「CSS 裡有沒有那一行」。
  const text = await page.evaluate(() => {
    const rows: { block: string; label: string; opacity: number; ghost: boolean }[] = []
    for (const g of Array.from(document.querySelectorAll('.blocklyDraggable'))) {
      const ghost = g.classList.contains('ghost-block')
      for (const c of Array.from(g.children)) {
        // ⚠️ **只看直接子代**——巢狀的積木自己有自己的那一份判斷
        if (c.classList.contains('blocklyDraggable')) continue
        const t = c.querySelector('text')
        if (!t?.textContent) continue
        rows.push({ block: g.getAttribute('data-id') ?? '?', label: t.textContent, ghost,
          opacity: Number(getComputedStyle(c).opacity) })
      }
    }
    return rows
  })
  expect(text.length, '🔴 一個文字都沒抓到 → 這一條不算數').toBeGreaterThan(4)

  const brightGhost = text.filter((r) => r.ghost && r.opacity >= 1).map((r) => r.label)
  expect(
    brightGhost,
    '🔴 這些字在淡的積木上還是亮的——多半是 CSS 的類別名對不上（量一次真的 DOM，不要猜）：',
  ).toEqual([])

  // ★ 反向：**學生自己的字不得被淡掉**
  const dimStudent = text.filter((r) => !r.ghost && r.opacity < 1).map((r) => r.label)
  expect(dimStudent, '🔴 把學生自己的字也淡掉了').toEqual([])
})

const TWO =
  '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "A" << endl;\n    cout << "B" << endl;\n    return 0;\n}\n'

const codeOf = (page: import('@playwright/test').Page): Promise<string> => page.evaluate(() =>
  (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')

async function ghostMode(page: import('@playwright/test').Page, program: string): Promise<void> {
  await freshApp(page)
  await appReady(page)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), program)
  await useAsSource(page, '程式碼')
  await treeReady(page)
  await pickScaffold(page, 'ghost', { visual: true })
}

/** 某一型積木**自己那一塊**的左上角（不含它下面接的一串）。 */
async function topOf(page: import('@playwright/test').Page, type: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((ty) => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
      .__app.blocklyPanel.workspace
    const b = ws.getAllBlocks(false).map((x) => x as { type: string; getSvgRoot(): SVGGraphicsElement })
      .find((x) => x.type === ty)
    if (!b) return null
    const r = b.getSvgRoot().getBoundingClientRect()
    // ⚠️ **抓頂端不抓中點**——`getBoundingClientRect` 含整個子樹，
    //    中點會落在下一塊上（2026-08-28 因此驗錯過兩次）。
    return { x: r.x + 15, y: r.y + 12 }
  }, type)
}

test('★ `ghost`：拖走學生的積木，鷹架黏在原地（而學生的整串跟著走）', async ({ page }) => {
  // 🔴 使用者 2026-08-28：「**回傳 0 不應該一起被拉動**」
  //    ＋「**我可能拖的不是只有一個積木喔**」。
  //
  // ⚠️ 第二句排除了 Blockly 內建的 `healStack`（按 Alt 拖曳）——
  //    那會把**後面整串**都留下，而學生的積木該跟著走。
  //
  // 🟢 做法：拖曳開始前把鷹架**摘出那一串**，結束後接回容器尾端。
  await ghostMode(page, TWO)
  const before = await codeOf(page)
  expect(before, '🔴 這支程式裡沒有兩塊 cout → 驗不出「拖多塊」').toContain('"B"')

  const from = await topOf(page, 'cpp_print')
  expect(from, '🔴 找不到第一塊 cout').toBeTruthy()
  await page.mouse.move(from!.x, from!.y)
  await page.mouse.down()
  await page.mouse.move(from!.x + 140, from!.y + 340, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(2800)

  const after = await codeOf(page)
  // 🔴 兩塊 cout 都出去了
  expect(
    after.replace(/\s+/g, ' '),
    '🔴 只有一塊 cout 被拖走——學生的積木沒有整串跟著',
  ).not.toContain('int main() { cout')
  // 🔴 而 `return 0` 還在 main 裡
  expect(
    after.replace(/\s+/g, ' '),
    '🔴 `return 0` 被連帶拖走了——那支程式不能跑了',
  ).toContain('int main() { return 0; }')
})

test('★ `ghost`：積木插得進 `main` 與 `return` 之間', async ({ page }) => {
  // 🔴 使用者 2026-08-28：「**我的積木也要是可以插入在 main 和 return 之間的**」。
  //
  // ⚠️ 而這一條與上一條**互相拉扯**，那是這一整段最難的地方：
  //
  // > **「不能拖」與「不能被移動」在 Blockly 裡是同一個旗標，而我們只要前者。**
  //
  // `setMovable(false)`／`isMovable() → false` 都會讓**插入失效**
  // （連接判定要能把被擠掉的那塊移走）。實測拿掉它，插入立刻成立。
  // 🟢 所以留著「可動」，而把**拖曳的每一步變成沒有動作**。
  await ghostMode(page, TWO)
  const from = await topOf(page, 'cpp_print')
  await page.mouse.move(from!.x, from!.y)
  await page.mouse.down()
  // 🔴 **位移要問畫布，不能寫死**（2026-09-02，spec 171）。
  //
  //    這一行本來是 `from.y + 340`，而 spec 171 把主控台從編輯區搬出去之後
  //    積木那一格**不再跨到主控台旁邊**——它矮了 315px（實測），
  //    於是 +340 掉到畫布外面，測試說「插不回去」。
  //
  // ⚠️ 而那不是功能壞了，是**這條測試假設了一個已經不存在的高度**。
  //
  // > **一條用寫死像素位移的拖曳測試，會在版面改變的那天說「功能壞了」
  // > ——而它報的是它自己的假設。**
  const canvas = await page.locator('#blockly-panel').boundingBox()
  const dropY = Math.min(from!.y + 340, (canvas!.y + canvas!.height) - 60)
  await page.mouse.move(from!.x + 140, dropY, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(2800)

  const back = await topOf(page, 'cpp_print')
  const ret = await topOf(page, 'cpp_return')
  expect(back && ret, '🔴 找不到要拖的積木').toBeTruthy()
  await page.mouse.move(back!.x, back!.y)
  await page.mouse.down()
  await page.mouse.move(ret!.x, ret!.y - 2, { steps: 25 })
  await page.mouse.up()
  await page.waitForTimeout(2800)

  expect(
    (await codeOf(page)).replace(/\s+/g, ' '),
    '🔴 插不回 `main` 與 `return` 之間——多半是某個地方把鷹架設成了「不可移動」',
  ).toContain('int main() { cout << "A" << endl; cout << "B" << endl; return 0; }')
})

test('★ `ghost`：直接拖鷹架，什麼都不會發生', async ({ page }) => {
  await ghostMode(page, TWO)
  const before = await codeOf(page)
  for (const type of ['cpp_return', 'cpp_include', 'cpp_using_namespace', 'cpp_func_def']) {
    const p = await topOf(page, type)
    if (!p) continue
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.move(p.x + 200, p.y + 250, { steps: 15 })
    await page.mouse.up()
    await page.waitForTimeout(1500)
    expect(
      await codeOf(page),
      `🔴 拖了 ${type} 之後程式碼變了——鷹架該是拖不動的`,
    ).toBe(before)
  }
})

test('★ `ghost`：鷹架在【最外層】也黏得住（不只在容器裡）', async ({ page }) => {
  // 🔴 使用者 2026-08-28 貼了這支：`int x;` 在**最外層**，
  //    夾在 `using namespace std;` 與 `int main(){…}` 之間。
  //    拖走 `int x`，**`main` 整顆跟著出去了**。
  //
  // 原因：第一版問的是「這顆鷹架在**哪個容器**裡」，而最外層沒有容器
  // ——那個函式回 `null`，於是 `main` 根本沒被摘出來。
  //
  // > **「它在誰的肚子裡」與「它該接在誰後面」不是同一個問題，
  // > 而最外層只有後者答得出來。**
  await ghostMode(page, 'using namespace std;\nint x;\nint main() {\n    return 0;\n}\n')

  const chains = (): Promise<string[]> => page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: { getTopBlocks(o: boolean): unknown[] } } } })
      .__app.blocklyPanel.workspace
    return ws.getTopBlocks(true).map((b) => {
      const out: string[] = []
      for (let n = b as { type: string; getNextBlock(): unknown } | null; n; n = n.getNextBlock() as never) out.push(n.type)
      return out.join(' → ')
    })
  })

  expect(await chains(), '🔴 這支程式沒有排成一條最外層的鏈——驗不出這件事')
    .toEqual(['cpp_using_namespace → cpp_var_declare → cpp_func_def'])

  const x = await topOf(page, 'cpp_var_declare')
  await page.mouse.move(x!.x, x!.y)
  await page.mouse.down()
  await page.mouse.move(x!.x + 120, x!.y + 300, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(2800)

  // ★ `using` 與 `main` 併回同一條，而 `int x` 自己出去
  expect(
    await chains(),
    '🔴 最外層的鷹架被連帶拖走了——「該接在誰後面」那條規則漏了最外層',
  ).toEqual(['cpp_using_namespace → cpp_func_def', 'cpp_var_declare'])

  // ★ 而它插得回兩顆鷹架**中間**
  const b = await topOf(page, 'cpp_var_declare')
  const fd = await topOf(page, 'cpp_func_def')
  await page.mouse.move(b!.x, b!.y)
  await page.mouse.down()
  await page.mouse.move(fd!.x, fd!.y - 2, { steps: 25 })
  await page.mouse.up()
  await page.waitForTimeout(2800)
  expect(await chains(), '🔴 插不回 `using` 與 `main` 之間')
    .toEqual(['cpp_using_namespace → cpp_var_declare → cpp_func_def'])
})

test('★ Arduino 也有鷹架——`setup`／`loop` 是淡的，而「隱藏」不端出來', async ({ page }) => {
  // 🔴 使用者 2026-08-28：「**我希望 Arduino 系列也有腳手架**」。
  //
  // 在此之前九個板子目標的 `skeleton` 都是 `'none'`——**而那是「沒有骨架」**。
  // 症狀：切到 Arduino、把顯示切成「淡的」，畫面上**什麼都不會變**
  // ——`scaffoldNodeIds` 認的是「函式定義 ＋ 名字叫 `main`」。
  //
  // ⚠️ 而它逼出了 `entryFunctions`：Arduino 有【兩個】進入點。
  //    原本那個寫死不只是名字錯，**數量也錯**。
  await freshApp(page)
  await appReady(page)
  await page.locator('.status-item-btn[data-control-id="target"]').click()
  await page.locator('.quick-pick-item').filter({ hasText: /Arduino Uno/ }).first().click()
  await page.waitForTimeout(2500)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c),
    'void setup() {\n    pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n    digitalWrite(13, HIGH);\n    delay(1000);\n}\n')
  await useAsSource(page, '程式碼')
  await treeReady(page)

  await page.locator('.status-item-btn[data-control-id="scaffold"]').click()
  const options = await page.locator('.quick-pick-item').allTextContents()

  // ★ 這個語言的骨架都列得出來，而 **Arduino 那一份在裡面**
  expect(
    options.some((o) => o.includes('Arduino 骨架')),
    '🔴 選單裡沒有 Arduino 的骨架——那九個板子還指著「沒有骨架」',
  ).toBe(true)

  // 🔴 **「隱藏」不得出現**——Arduino 有兩個進入點，兩批語句攤平之後分不回去。
  //    使用者：「這也會**被你選什麼目標限制有哪些選擇**」。
  expect(
    options.filter((o) => o.startsWith('隱藏')),
    '🔴 端出了一個做不到的選項——「隱藏」在兩個進入點的骨架上是把資訊弄丟，不是藏起來',
  ).toEqual([])

  await page.locator('.quick-pick-item[data-value="mode:ghost"]').click()
  await page.waitForTimeout(3200)

  const ghosts = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
      .__app.blocklyPanel.workspace
    return ws.getAllBlocks(false).map((x) => x as { type: string; getSvgRoot(): SVGGraphicsElement })
      .filter((b) => b.getSvgRoot().classList.contains('ghost-block')).map((b) => b.type)
  })
  // ★ **兩顆**函式定義都淡了——`setup` 與 `loop`
  expect(
    ghosts,
    '🔴 Arduino 的 `setup`／`loop` 沒有變成鷹架——多半是哪裡還在問「名字是不是 main」',
  ).toEqual(['cpp_func_def', 'cpp_func_def'])

  // ★ 而學生自己的東西**一顆都沒被淡掉**
  const solid = await page.evaluate(() => {
    const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
      .__app.blocklyPanel.workspace
    return ws.getAllBlocks(false).map((x) => x as { type: string; getSvgRoot(): SVGGraphicsElement })
      .filter((b) => !b.getSvgRoot().classList.contains('ghost-block')).map((b) => b.type)
  })
  expect(solid, '🔴 把學生自己的積木也淡掉了').toContain('cpp_pin_mode')
  expect(solid).toContain('cpp_digital_write')

  // ★ 狀態列同時說出兩個軸
  expect(
    await page.locator('.status-item-btn[data-control-id="scaffold"]').textContent(),
  ).toContain('Arduino 骨架')
})
