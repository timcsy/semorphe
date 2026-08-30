/**
 * **第八十八條護欄**：每一個投影結構的視圖，切 `ScaffoldMode` 都要**看得出差別**。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-28（接鷹架控制項時）：「程式碼的部分還是要顯示完整，而
 * **其他視圖可以有相對應的顯示**」——而那句話當時只在積木那一側兌現。
 *
 * 2026-08-30 量流程視圖：
 *
 * ```
 * hidden    include · using_namespace · func_def · print · literal_string · endl · return · literal_number
 * ghost     （逐字相同）
 * editable  （逐字相同）
 * ```
 *
 * 🔴 **連 `hidden` 都照樣把整組骨架畫出來**，而 console **零筆錯誤**
 * ——不是壞掉，是從來沒做過。
 *
 * ⚠️ 而這是**同一個形狀的第二次**：兩天前使用者說「淡的好像失效了」，
 * 查下去是積木側從來沒實作過 `ghost`。
 *
 * > **一個模式如果在某個視圖上與另一個模式長得一樣，
 * > 那個視圖就沒有實作它——而選單仍然讓人選得到。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「量到的視圖數」少於 2，代表這支根本沒切到那些分頁，
 * > 這份報表不算數——不是「每個視圖都實作好了」。**
 *
 * 錨在**量到幾個視圖**（合成量）。🔴 **刻意不錨在「幾個沒實作」**
 * ——那正是要推向零的，而它會在成功的那天變紅。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 留一個視圖，那個選單在那裡就是一句謊話
 * 修一筆要付多少？      不便宜（要為那個視圖設計顯示），而**規範不因此鬆**
 * 別台機器一樣嗎？      ✅ 量的是同一個瀏覽器裡的輸出
 * ```
 *
 * ## ⚠️ 它第一次跑是【綠】的——所以證據是對照實驗，不是那次綠
 *
 * `build-guardrail` 6.5：「新護欄的第一次執行……一開始就綠代表護欄壞了」。
 * 而這一條是**先修才蓋**的（量測是為了判定它是缺陷還是設計，判完就順手修了）
 * ——所以補了一次**對照實驗**（`diagnose-in-browser` 第 3 步）：
 *
 * ```
 * 退掉 flow-panel.ts 那一刀      流程 hidden=112 ghost=112 editable=112  → 🔴 三筆，逐項指名「流程」
 *                                積木 hidden=37  ghost=117 editable=112  → 綠
 * 還原                            兩個視圖都綠
 * ```
 *
 * 🔴 **只有一邊變紅**，證明它量的是那個視圖、不是一個到處都報的判定。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測「顯示得對不對」**——只檢測「兩個模式的輸出**不一樣**」。
 *   一個把 `hidden` 畫成紫色的實作也會通過這一支。那是各視圖自己的 e2e 的事。
 * - **不檢測程式碼視圖**——⚠️ **它是具名豁免**：使用者拍板「程式碼的部分還是要
 *   顯示完整」，所以它**應該**三個模式都一樣。把它算進來會逼出一個錯的實作。
 * - **不檢測主控台／變數面板**——它們投影的是**執行**，不是程式的結構。
 */
import { test, expect } from '@playwright/test'
import { useAsSource, freshApp } from './helpers'

const PROGRAM =
  '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hi" << endl;\n    return 0;\n}\n'

/** 這個視圖在目前這個模式下的**可觀察輸出**——一個字串，兩兩比對用。 */
type Probe = { view: string; read: (p: import('@playwright/test').Page) => Promise<string> }

const PROBES: Probe[] = [
  {
    view: '積木',
    read: (page) => page.evaluate(() => {
      const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(b: boolean): unknown[] } } } })
        .__app.blocklyPanel.workspace
      return ws.getAllBlocks(false)
        .map((x) => x as { type: string; getSvgRoot?(): SVGElement })
        .map((b) => `${b.type}${b.getSvgRoot?.()?.classList.contains('ghost-block') ? '~' : ''}`)
        .join(',')
    }),
  },
  {
    view: '流程',
    read: (page) => page.evaluate(() => {
      const g = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
        .__app.flowPanel.graph
      const ghost = new Set(Array.from(document.querySelectorAll('g.fc-ghost'))
        .map((e) => e.getAttribute('data-node')))
      return g.nodes.map((n) => `${n.componentId}${ghost.has(n.id) ? '~' : ''}`).join(',')
    }),
  },
]

test('★ 每一個投影結構的視圖，切 `ScaffoldMode` 都要看得出差別', async ({ page }) => {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))

  await freshApp(page)
  await page.waitForTimeout(1800)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROGRAM)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2500)
  // 🔴 流程分頁要**開著**——它關著的時候不重畫，而那會讓這支量到三個空字串
  //    （而空字串兩兩相同 → 它會報「沒實作」，一個誤報）。
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(2000)

  const seen: Record<string, Record<string, string>> = {}
  for (const mode of ['hidden', 'ghost', 'editable'] as const) {
    await page.locator('.status-item-btn[data-control-id="scaffold"]').click()
    await page.locator(`.quick-pick-item[data-value="mode:${mode}"]`).click()
    await page.waitForTimeout(3000)
    for (const p of PROBES) {
      seen[p.view] ??= {}
      seen[p.view][mode] = await p.read(page)
    }
  }

  for (const [view, byMode] of Object.entries(seen)) {
    // eslint-disable-next-line no-console
    console.log(`◆ ${view}  ` + Object.entries(byMode).map(([m, v]) => `${m}=${v.length}字`).join(' '))
  }

  // ★ 入口條件——真的量到視圖了（見檔頭的自我否證）
  expect(
    Object.keys(seen).length,
    '🔴 一個視圖都沒量到 → 這份報表不算數，不是「每個視圖都實作好了」',
  ).toBeGreaterThanOrEqual(2)
  for (const [view, byMode] of Object.entries(seen)) {
    expect(
      byMode.editable.length,
      `🔴 ${view} 在 editable 下是空的 → 這支量的不是那個視圖`,
    ).toBeGreaterThan(0)
  }
  expect(errs, '🔴 頁面拋了例外——先修那個，這份量測不算數').toEqual([])

  // 🔴 硬性零：三個模式**兩兩不同**
  const same: string[] = []
  for (const [view, byMode] of Object.entries(seen)) {
    for (const [a, b] of [['hidden', 'ghost'], ['ghost', 'editable'], ['hidden', 'editable']] as const) {
      if (byMode[a] === byMode[b]) same.push(`${view}：${a} 與 ${b} 的輸出一模一樣`)
    }
  }
  expect(
    same,
    '🔴 這幾個視圖沒有實作 `ScaffoldMode`——而狀態列的那個選單仍然讓人選得到。\n' +
      '> 一個模式如果在某個視圖上與另一個模式長得一樣，那個視圖就沒有實作它。\n' +
      '⚠️ 修法是**在那個視圖上設計它的顯示**，不是把那個視圖從這支裡排除。',
  ).toEqual([])
})

test('★ `ghost` 的骨架**拖得動**，而它的接法鎖著', async ({ page }) => {
  // 🔴 使用者 2026-08-30：「我是希望**淡的還是能移動**，只不過**彼此關係不能變**」。
  //
  // ⚠️ 而我第一版做錯了，因為把積木那一課直接套過來：
  //
  // ```
  // 積木視圖   位置【就是】結構——拖一塊積木會改變程式
  // 流程視圖   位置只是【排版】——拖一顆節點程式一個字都不會變（存進 flowLayout）
  // ```
  //
  // > **同一句「不能動」，在兩個視圖上禁的不是同一件事。**
  await freshApp(page)
  await page.waitForTimeout(1800)
  await page.evaluate((c) =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), PROGRAM)
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2500)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(2000)
  await page.locator('.status-item-btn[data-control-id="scaffold"]').click()
  await page.locator('.quick-pick-item[data-value="mode:ghost"]').click()
  await page.waitForTimeout(3000)

  const nodeAt = (comp: string): Promise<{ x: number; y: number; tf: string | null } | null> =>
    page.evaluate((c) => {
      const g = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
        .__app.flowPanel.graph
      const n = g.nodes.find((x) => x.componentId === c)
      if (!n) return null
      const el = document.querySelector(`[data-node="${n.id}"]`) as SVGGElement | null
      const r = el?.getBoundingClientRect()
      return r ? { x: r.x + r.width / 2, y: r.y + 12, tf: el!.getAttribute('transform') } : null
    }, comp)
  const portAt = (comp: string, key: string): Promise<{ x: number; y: number } | null> =>
    page.evaluate(([c, k]) => {
      const g = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
        .__app.flowPanel.graph
      const n = g.nodes.find((x) => x.componentId === c)
      if (!n) return null
      const el = document.querySelector(`[data-node="${n.id}"] .fc-port[data-port="${k}"]`)
      const r = el?.getBoundingClientRect()
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
    }, [comp, key])
  const codeNow = (): Promise<string> => page.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? '')

  const before = await codeNow()
  expect(before, '🔴 程式碼是空的 → 這一支驗不出任何事').toContain('int main()')

  // ① **拖得動**
  const p0 = await nodeAt('cpp:func_def')
  expect(p0, '🔴 找不到 main 那一顆').toBeTruthy()
  await page.mouse.move(p0!.x, p0!.y)
  await page.mouse.down()
  await page.mouse.move(p0!.x + 160, p0!.y + 120, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(1500)
  const p1 = await nodeAt('cpp:func_def')
  expect(p1!.tf, '🔴 淡的節點拖不動了——而使用者要的是「能移動，只是關係不能變」').not.toBe(p0!.tf)
  // ★ 而**程式一個字都沒變**（位置在流程視圖上只是排版）
  expect(await codeNow(), '🔴 拖一顆節點改到了程式——位置不該是結構').toBe(before)

  // ② **接法鎖著**：把「輸出」的 `__next__` 拉到 main 的 `__in__`
  //    ＝「把 main 接到輸出後面」——被搬的是骨架，該被拒絕。
  const from = await portAt('cpp:print', '__next__')
  const to = await portAt('cpp:func_def', '__in__')
  expect(from && to, '🔴 找不到那兩個接點 → 這一半驗不出來').toBeTruthy()
  await page.mouse.move(from!.x, from!.y)
  await page.mouse.down()
  await page.mouse.move(to!.x, to!.y, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(1500)

  expect(await codeNow(), '🔴 骨架被搬走了——`ghost` 鎖的就是這件事').toBe(before)
  // ★ 而且**它要說出理由**——默默不動與壞掉長得一樣
  const notice = (await page.locator('[class*=notice]').allTextContents()).join('｜')
  expect(notice, '🔴 拒絕了而沒有說為什麼——默默不動與壞掉長得一樣').toContain('骨架')
  // ⚠️ 通知是**純文字**：Markdown 的 `**` 會照字面印出來（2026-08-30 實測撞到）
  expect(notice, '🔴 訊息裡有 Markdown 記號，而它會照字面印給使用者').not.toContain('**')
})
