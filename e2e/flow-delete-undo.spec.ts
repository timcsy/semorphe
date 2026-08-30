/**
 * **流程視圖：刪除（節點與邊）＋ 還原。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-30：「可不可以幫流程視圖加上刪除功能？包含節點和邊，還有還原功能」。
 *
 * 量出來的：`doUndo()` 就是 `blocklyPanel.undo()`——**流程視圖改的每一格
 * 都不可還原**（實測：在流程改一個變數名，按還原，程式碼一個字都沒退回去）。
 *
 * > **一個編輯得動而還原不了的視圖，比一個唯讀的視圖更危險
 * > ——使用者會以為他隨時可以退回去。**
 *
 * ## 🔴 刪除的範圍是量出來的，不是猜的
 *
 * 把單一插槽裡的值拿掉，產出的東西**不一定合法**：
 *
 * ```
 * 宣告的初始值  int total;      ✅ 合法
 * if 的條件     if () { }       🔴 壞的
 * 算式的一邊    int a = + 2;    🔴 編得過而【意思變了】
 * ```
 *
 * 分不出這三種，因為「這一格可不可以是空的」**沒有人宣告過**
 * （vision 債表的 `ParamSpec` 那一列）。所以：
 *
 * ```
 * 語句（住在 body）  ✅ 刪——body 可以是空的 `{ }`
 * 值                 🔴 拒絕，並說出為什麼
 * 骨架               🔴 拒絕（ghost 鎖的就是關係）
 * ```
 *
 * ## 而「刪邊」與「刪節點」是同一件事
 *
 * 這個視圖的線**就是父子包含關係**（第八十條護欄），而**一棵樹沒有
 * 可以懸空的邊**。
 *
 * > **在一棵樹上，刪一條邊與刪一個節點是同一件事——
 * > 差別只在你從哪一端去說它。**
 *
 * ## ⚠️ 按的是【快速列】那一對，不是流程工具列
 *
 * 🪦 流程工具列的 ↶↷ 已於 2026-08-30 退場（三對「還原」收成一對）。
 *
 * ⚠️ 而這一支**因此在全套 e2e 上紅了兩支**：拿掉按鈕之後我跑了
 * `undo-one-pair.spec.ts`，**沒有回頭跑這一支**。
 *
 * > **「跑與這次改動相關的那幾個檔」——而「相關」是我判的，
 * > 我判漏的那一個不會舉手。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果一開始的程式碼裡沒有那一句 `cout`，這份報表不算數
 * > ——不是「刪除與還原都對」。**
 */
import { test, expect } from '@playwright/test'
import { useAsSource, freshApp } from './helpers'

const PROG = 'int main() {\n    int total = 1;\n    cout << total << endl;\n    return 0;\n}\n'

const flat = (s: string): string => s.replace(/#include[^\n]*\n/g, '').replace(/\s+/g, ' ').trim()
const codeNow = async (p: import('@playwright/test').Page): Promise<string> =>
  flat(await p.evaluate(() =>
    (window as never as { __app: { codeView: { getCode?(): string } } }).__app.codeView.getCode?.() ?? ''))

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

/**
 * 某顆節點**標題列**的位置。
 *
 * 🪦 這裡原本回的是那顆 ✕ 的位置，而 ✕ 已於 2026-08-30 退場：
 * 實測它在手機上只有 9×15 px，而且**跟著縮放一起變小**（縮到 80% 剩 6×9）。
 *
 * > **一個會隨著畫面縮小而一起縮小的觸控目標，在最需要它的時候最小。**
 *
 * 🟢 改成長按（觸控）／右鍵（桌機）選單——選單是 DOM，大小與縮放無關。
 */
const headOf = (page: import('@playwright/test').Page, comp: string): Promise<{ x: number; y: number } | null> =>
  page.evaluate((c) => {
    const g = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
      .__app.flowPanel.graph
    const n = g.nodes.find((x) => x.componentId === c)
    if (!n) return null
    const head = document.querySelector(`[data-node="${n.id}"] .fc-node-header`)
    const r = head?.getBoundingClientRect()
    if (!r) return null
    // ⚠️ **要確認那個點真的打得到這顆節點**——節點可能互相疊住
    //    （2026-08-30 撞到：右鍵下去沒有開選單，因為點在別人身上）。
    for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = r.x + r.width * f
      const y = r.y + r.height / 2
      const top = document.elementsFromPoint(x, y)[0]
      if (top && top.closest(`[data-node="${n.id}"]`)) return { x, y }
    }
    return null
  }, comp)

/** 右鍵開選單，然後按下那一項。 */
async function menuDelete(
  page: import('@playwright/test').Page,
  at: { x: number; y: number },
  what = '',
): Promise<void> {
  await page.mouse.click(at.x, at.y, { button: 'right' })
  await expect(page.locator('.flow-menu'), `🔴 右鍵沒有開出選單（${what}）`).toBeVisible({ timeout: 5000 })
  await page.locator('.flow-menu-item').first().click()
  await page.waitForTimeout(1800)
}

test('★ 刪一句話 → 還原 → 取消還原', async ({ page }) => {
  await openFlow(page)
  const before = await codeNow(page)
  // ★ 入口條件（見檔頭的自我否證）
  expect(before, '🔴 一開始就沒有那一句 → 這份報表不算數').toContain('cout')

  const at = await headOf(page, 'cpp:print')
  expect(at, '🔴 找不到那顆節點').toBeTruthy()
  await menuDelete(page, at!, '節點')
  expect(await codeNow(page), '🔴 按了 ✕ 而那一句還在').not.toContain('cout')

  await page.locator('#undo-btn').click()
  await page.waitForTimeout(1800)
  expect(
    await codeNow(page),
    '🔴 還原沒有把它救回來。⚠️ 2026-08-30 的根因是**視圖就地改了真相**：\n' +
      '面板存的是 `event.tree` 的參考，於是「改動前」的快照拍到的是改動後。',
  ).toBe(before)

  await page.locator('#redo-btn').click()
  await page.waitForTimeout(1800)
  expect(await codeNow(page), '🔴 取消還原沒有把它再刪掉').not.toContain('cout')
})

test('★ 語句線：點線選它，✕ 才刪——而刪掉的是【裡面】那一句', async ({ page }) => {
  // 🪦 這一支原本叫「點一條線 ＝ 刪掉它下游那一端」，而**那個模型是錯的**：
  //    「下游」在資料線上指的是消費者，不是孩子（見下面那一支）。
  //    現在的模型是：**點線＝選取，✕ 才刪；而刪的是【被包含】的那一端。**
  await openFlow(page)
  const before = await codeNow(page)

  // ⚠️ **曲線上真正的點**，不是它的邊界框中心（2026-08-30 踩到第二次）：
  //    一條貝茲的 bbox 中心**不一定在那條曲線上**，於是點下去落在空白處。
  //
  // > **一個從邊界框推算出來的座標，會落在容器裡而不在任何東西上。**
  const wireOf = (comp: string): Promise<{ x: number; y: number } | null> =>
    page.evaluate((c) => {
      const fp = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
        .__app.flowPanel
      const n = fp.graph.nodes.find((x) => x.componentId === c)
      if (!n) return null
      const path = document.querySelector(`[data-wire="${n.id}"] .fc-wire-hit`) as SVGPathElement | null
      const m = path?.getScreenCTM()
      if (!path || !m) return null
      // ⚠️ **中點可能被一顆節點蓋住**（節點是後畫的）——所以沿著曲線找一個
      //    **真的露出來**的點。第一版直接取中點，量到底下是 `fc-field-hit`。
      const len = path.getTotalLength()
      for (const f of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]) {
        const at = path.getPointAtLength(len * f)
        const pt = new DOMPoint(at.x, at.y).matrixTransform(m)
        if (document.elementsFromPoint(pt.x, pt.y)[0] === path) return { x: pt.x, y: pt.y }
      }
      return null
    }, comp)

  // ★ 那條線要以**孩子**為鍵——`main` 裡的那一句 `cout`
  const at = await wireOf('cpp:print')
  expect(at, '🔴 找不到指向那一句的線 → 這一支驗不出東西').toBeTruthy()

  // ① 點線＝**選取**，程式不得改動
  await page.mouse.click(at!.x, at!.y)
  await page.waitForTimeout(800)
  expect(
    await codeNow(page),
    '🔴 點一下線就把程式改掉了——那在觸控上會誤刪',
  ).toBe(before)
  await expect(
    page.locator('.fc-wire-g.fc-sel'),
    '🔴 點了線而沒有被選起來——那顆 ✕ 在觸控上就永遠出不來',
  ).toHaveCount(1)

  // ② 按 Delete 鍵刪掉選取的那一個
  await page.locator('.flow-canvas').press('Delete')
  await page.waitForTimeout(1800)
  expect(await codeNow(page), '🔴 Delete 鍵沒有刪掉選取的那一句').not.toContain('cout')

  // ③ 還原
  await page.locator('#undo-btn').click()
  await page.waitForTimeout(1800)
  expect(await codeNow(page), '🔴 還原不回來').toBe(before)
})

test('★ 值不准刪——而它要說出為什麼', async ({ page }) => {
  await openFlow(page)
  const before = await codeNow(page)
  const at = await headOf(page, 'cpp:literal_number')
  expect(at, '🔴 找不到那顆值節點').toBeTruthy()
  await menuDelete(page, at!, '節點')

  expect(
    await codeNow(page),
    '🔴 值被刪掉了——那一格會變成空的，而 `if ()` 不是程式',
  ).toBe(before)
  const notice = (await page.locator('.flow-notice').allTextContents()).join('｜')
  expect(
    notice,
    '🔴 拒絕了而沒有說為什麼——默默不動與壞掉長得一樣',
  ).toContain('空的')
  // ⚠️ 通知是純文字：Markdown 的 `**` 會照字面印出來
  expect(notice, '🔴 訊息裡有會照字面印出來的記號').not.toContain('**')
})

test('★ 點【資料線】的 ✕ → 刪掉的是那個值，不是整句', async ({ page }) => {
  // 🔴 使用者 2026-08-30：「**為何我只是把換行節點刪掉，就整個不見？**」
  //
  // 根因：第一版一律刪 `w.to.node`，而那**只對語句線成立**：
  //
  // ```
  // 語句的線   from = 父（main）    to = 子（那一句）    → 子是 to
  // 資料的線   from = 值（換行）    to = 消費者（輸出）  → 子是 from ⚠️
  // ```
  //
  // > **線的方向講的是「資料往哪裡流」，
  // > 而包含關係講的是「誰住在誰裡面」——兩者在資料線上是相反的。**
  //
  // ⚠️ 而**我原本的三支測試抓不到它**：它們驗的是「刪語句」與「刪值被拒」，
  //    沒有一支點過資料線的 ✕。**我釘的是我想到的那幾條路。**
  await freshApp(page)
  await page.waitForTimeout(2000)
  await page.evaluate(() =>
    (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView
      .setCode('int main() {\n    cout << "Hello!" << endl;\n    return 0;\n}\n'))
  await useAsSource(page, '程式碼')
  await page.waitForTimeout(2500)
  await page.locator('[data-tab="flow"], button', { hasText: /^流程$/ }).first().click()
  await page.waitForTimeout(1800)

  const before = await codeNow(page)
  expect(before, '🔴 一開始就沒有 endl → 這一支驗不出東西').toContain('endl')

  // ⚠️ 在**曲線上沒有被節點蓋住**的那一段按右鍵——節點是後畫的，會壓在線上。
  const onWire = await page.evaluate(() => {
    const fp = (window as never as { __app: { flowPanel: { graph: { nodes: { id: string; componentId: string }[] } } } })
      .__app.flowPanel
    const endl = fp.graph.nodes.find((n) => n.componentId === 'cpp:endl')
    if (!endl) return null
    const path = document.querySelector(`[data-wire="${endl.id}"] .fc-wire-hit`) as SVGPathElement | null
    const m = path?.getScreenCTM()
    if (!path || !m) return null
    const len = path.getTotalLength()
    for (const f of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]) {
      const p = path.getPointAtLength(len * f)
      const pt = new DOMPoint(p.x, p.y).matrixTransform(m)
      if (document.elementsFromPoint(pt.x, pt.y)[0] === path) return { x: pt.x, y: pt.y }
    }
    return null
  })
  // ★ 這一格本身就是一條斷言：**那條線要以「值」為鍵**，不是以消費者為鍵
  expect(onWire, '🔴 找不到「換行」那條線——多半是它還掛在消費者身上').toBeTruthy()
  await menuDelete(page, onWire!, '資料線')

  const after = await codeNow(page)
  expect(after, '🔴 整句 `cout` 被刪掉了——刪錯了那一端').toContain('cout')
  expect(after, '🔴 `endl` 還在——那條線的 ✕ 沒有作用').not.toContain('endl')
  expect(after, '🔴 `cout << "Hello!";` 應該原封不動地留著').toContain('"Hello!"')

  // ★ 而**再刪一個就會把那一格清空**，那時要拒絕
  const solo = await headOf(page, 'cpp:literal_string')
  expect(solo, '🔴 找不到那顆文字節點').toBeTruthy()
  await menuDelete(page, solo!, '文字節點')
  expect(
    await codeNow(page),
    '🔴 把 `values` 清空了——`cout;` 不是一句話',
  ).toBe(after)
})
