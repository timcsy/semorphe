/**
 * **四張版面示意圖，而沒有任何一層是特別的**（spec 168）。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-31 逐字：「你現在把積木和流程用 tab 切換我不太喜歡，
 * **因為這樣程式碼面板就變得比較特別了**」。
 *
 * ## ⚠️ 為什麼一定要 e2e
 *
 * 這是**版面**——happy-dom 沒有版面引擎，`getBoundingClientRect()` 一律回 0。
 * 「格子在哪、多大」這件事**單元測試量不到**（`layout-preset-width.spec.ts` 記過同一件事）。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測示意圖好不好看**——只檢測它的格數與跨度與宣告一致。
 * - **不檢測拖分隔線之後的比例**——那是 `layout-preset-width.spec.ts` 的事。
 * - **不檢測行動版**——行動版是單槽，spec 明文不做。
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'

type P = import('@playwright/test').Page

const openPicker = async (page: P): Promise<void> => {
  await page.locator('#status-controls .status-item-btn[data-control-id="layout"]').click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(1)
}

const pick = async (page: P, id: string): Promise<void> => {
  await openPicker(page)
  await page.locator(`.quick-pick-item[data-value="${id}"]`).click()
  await expect(page.locator('.quick-pick-overlay')).toHaveCount(0)
  await page.waitForFunction((v) => document.body.getAttribute('data-layout') === v, id)
}

const boxOf = (page: P, id: string): Promise<{ x: number; y: number; w: number; h: number } | null> =>
  page.evaluate((elId) => {
    const el = document.getElementById(elId)
    if (!el || getComputedStyle(el).display === 'none') return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }, id)

test('★ 入口條件：編輯區真的是一張 grid，而三欄 ＋ 底條都建出來了', async ({ page }) => {
  // 錨在**合成量**（是不是 grid、建了幾個容器），不是「有幾個位置對」
  // ——後者會在這支成功的那天變紅。
  await freshApp(page)
  const s = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('editors')!).display,
    cells: ['code-column', 'blocks-column', 'flow-column', 'bottom-container']
      .filter((id) => document.getElementById(id)).length,
  }))
  expect(s.display, '🔴 編輯區不是 grid → 下面每一個座標都不算數').toBe('grid')
  // ⚠️ `bottom-container` 現在是 `#editors` 的**兄弟**不是它的一格（spec 171）
  //    ——它仍然要在，而它不再由 grid 排。
  expect(s.cells, '🔴 三欄或底條沒有全部建出來 → 下面的「不見了」可能只是沒建').toBe(4)
})

test('🔴 從「對照」切到「三欄」，程式碼那一欄不跳走', async ({ page }) => {
  // 這是使用者那句話的執行機構：切版面時你正在看的東西不會換位子。
  //
  // 🪦 2026-09-02（spec 171）之前這一支釘的是「切到**十字**時整個左欄不跳走」。
  //    十字退場之後，**同一條性質**留在三欄上：加一欄流程，而程式碼還在最左。
  //    ⚠️ 而主控台那一半的斷言**變強了**：它現在根本不參加版面，
  //    所以它的位置**一個像素都不該動**（不只是「還在同一欄」）。
  await freshApp(page)
  const a = { code: await boxOf(page, 'code-column'), bottom: await boxOf(page, 'bottom-container') }
  expect(a.code, '🔴 一開機程式碼那一格就不見了 → 這支測的不是那條路').not.toBeNull()

  await pick(page, 'three-column')
  const b = { code: await boxOf(page, 'code-column'), bottom: await boxOf(page, 'bottom-container') }

  expect({ x: b.code!.x, y: b.code!.y }, '🔴 程式碼跳走了').toEqual({ x: a.code!.x, y: a.code!.y })
  expect(b.bottom, '🔴 切版面把主控台弄不見了').toEqual(a.bottom)
})

test('🔴 三欄：三格【等大】——「沒有任何一層是特別的」是可量的', async ({ page }) => {
  // 🪦 這一條本來量的是十字的四格。它的理念（使用者 2026-08-31：
  //    「這樣程式碼面板就變得比較特別了」）**由三欄承接**——而主控台不參加
  //    這個比較，因為它不是投影，是**執行的輸出**。
  await freshApp(page)
  await pick(page, 'three-column')
  const boxes = await Promise.all(
    ['code-column', 'flow-column', 'blocks-column'].map((id) => boxOf(page, id)))
  expect(boxes.every((b) => b !== null), '🔴 三欄裡有格子不見了').toBe(true)
  const areas = boxes.map((b) => b!.w * b!.h)
  const max = Math.max(...areas), min = Math.min(...areas)
  // SC-005：面積差在 ±5% 以內
  expect((max - min) / max, `🔴 三格不等大：${areas.join(' / ')}`).toBeLessThan(0.05)
})

test('🔴 三個版面裡，主控台一次都不准【被版面動到】', async ({ page }) => {
  // 🪦 **判準在 2026-09-02（spec 171）反轉了一次**：
  //    舊的是「每一張版面裡主控台都要在」（十字那個時代，它是版面的一格）。
  //    新的是「**版面根本碰不到它**」——它是編輯區底下一條獨立的、全寬的底條。
  //
  // > **「每一張版面都要記得留一格給它」與「版面碰不到它」守的是同一件事，
  // > 而後者不需要任何一張版面記得。**
  await freshApp(page)
  const first = await boxOf(page, 'bottom-container')
  expect(first, '🔴 一開機主控台就不在 → 這支測的不是那條路').not.toBeNull()
  for (const id of ['focus', 'compare', 'three-column']) {
    await pick(page, id)
    expect(await boxOf(page, 'bottom-container'), `🔴 「${id}」動到了主控台`).toEqual(first)
  }
})

test('🔴 三欄：程式碼·流程·積木由左到右，而主控台橫在底下【整條】', async ({ page }) => {
  // 🪦 取代「十字：左上程式碼·右上流程·右下積木·左下主控台」。
  //    使用者 2026-09-02：「讓最底下水平**完全展開**是放主控台，
  //    像是 VSCode 那樣」——「完全展開」是可量的，量在這裡。
  await freshApp(page)
  await pick(page, 'three-column')
  const [code, flow, blocks, bottom, editors] = await Promise.all(
    ['code-column', 'flow-column', 'blocks-column', 'bottom-container', 'editors']
      .map((id) => boxOf(page, id)))
  expect([code, flow, blocks, bottom].every((b) => b !== null), '🔴 三欄裡有格子不見了').toBe(true)
  // 由左到右 ＝ 理解的層次（細 → 粗），不是偏好
  expect(code!.x, '🔴 程式碼不在最左').toBeLessThan(flow!.x)
  expect(flow!.x, '🔴 流程不在中間').toBeLessThan(blocks!.x)
  // 三欄同一列
  expect([flow!.y, blocks!.y], '🔴 三欄沒有對齊').toEqual([code!.y, code!.y])
  // 🔴 主控台在**下面**，而且**與編輯區一樣寬**（±2px 容 gap／邊框）
  expect(bottom!.y, '🔴 主控台不在編輯區下面').toBeGreaterThanOrEqual(code!.y + code!.h)
  expect(Math.abs(bottom!.w - editors!.w), `🔴 主控台沒有完全展開：${bottom!.w} vs ${editors!.w}`)
    .toBeLessThanOrEqual(2)
})

test('🔴 格與格之間要有【縫】，而把手剛好蓋住那條縫——不壓到內容', async ({ page }) => {
  // 🔴 使用者 2026-09-01：「grid 邊界要處理一下」。第一版沒有 gap，
  //    兩欄貼在一起，而把手是一層 4px 的浮層——它壓掉每一欄各 2px。
  await freshApp(page)
  const gap = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('editors')!).columnGap) || 0)
  expect(gap, '🔴 沒有縫 → 把手只能蓋在內容上').toBeGreaterThan(0)

  const code = (await boxOf(page, 'code-column'))!
  const blocks = (await boxOf(page, 'blocks-column'))!
  expect(blocks.x - (code.x + code.w), '🔴 兩欄之間的距離不等於那條縫').toBe(gap)
})

// 🪦 **「分隔線的長度 ＝ 那條縫真正存在的長度」退場**（2026-09-02，spec 171）。
//
//    它守的是「橫線不得穿過**跨格**的格子」——在「對照」裡積木跨兩列，
//    它上面沒有縫，而第一版的橫線橫跨整個容器從積木中間穿過去。
//
// 🔴 **而編輯區已經沒有第二列了**，於是它裡面**一條橫的分隔線都沒有**
//    （`.grid-divider-rows` 是空的）——這一支現在測不到任何東西。
//    它不是被改綠的，是它守的那個形狀不存在了。
//
// 🟢 主控台與編輯區之間那條橫線還在，而它是**另一個機構**
//    （`bottom-panel-divider`，全寬，沒有跨格問題）。下面那一支驗它。

test('🔴 編輯區裡沒有橫線，而主控台上面那一條【橫跨整條】', async ({ page }) => {
  await freshApp(page)
  const s = await page.evaluate(() => {
    const rows = document.querySelectorAll('#editors .grid-divider-rows').length
    const d = document.querySelector('#bottom-container .bottom-panel-divider') as HTMLElement | null
    const bc = document.getElementById('bottom-container')!.getBoundingClientRect()
    return { rows, w: d?.getBoundingClientRect().width ?? -1, bw: Math.round(bc.width) }
  })
  expect(s.rows, '🔴 編輯區又長出橫的分隔線 → 那代表它有第二列了').toBe(0)
  expect(Math.abs(s.w - s.bw), `🔴 主控台上面那條線沒有橫跨整條：${s.w} vs ${s.bw}`)
    .toBeLessThanOrEqual(2)
})

// 🪦 **兩支退場（2026-09-01，spec 169）**：
//
//    「分頁收起來時那一槓也要跟著收」與「兩個投影都在時那兩顆不該還在」
//    測的都是 `#view-tabs`——**那一組已經不存在了**。切換視圖的分頁列改由
//    【每一個槽】提供（`.slot-tabs`），而且四個槽的選項完全相同。
//
// 🟢 它們要守的東西沒有不見，是**換了更強的形式**：
//    「選項一樣」現在由**同一份產生器**保證（結構，不是規範），
//    而 `e2e/slot-view-picker.spec.ts` 直接驗那件事。
//
// > **一支測試退場的正當理由，是它守的東西被一個更難違反的東西接手了
// > ——而不是它變得不方便。**


test('🔴 選單裡有三張【示意圖】＋兩頁的開關', async ({ page }) => {
  await freshApp(page)
  await openPicker(page)
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.quick-pick-overlay .quick-pick-item')].map((r) => ({
      id: (r as HTMLElement).dataset.value,
      cells: r.querySelectorAll('.quick-pick-preview-cell').length,
      visible: (r.querySelector('.quick-pick-preview') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    })))
  // 🔴 **開關排在三張版面之後**（2026-09-02，使用者：「加在單欄、對照、三欄的下方」）
  expect(rows.map((r) => r.id))
    .toEqual(['focus', 'compare', 'three-column', '__toggle-console', '__toggle-variables'])
  // 🪦 本來是 `[2, 3, 4, 4]`——那個 `3` 是「對照的積木跨兩列，跨格算一格」，
  //    而跨格隨十字一起退場了（主控台不在版面裡，沒有東西需要跨列）。
  // ⚠️ 開關那一列**沒有示意圖**：它不是一張版面，畫一張圖會讓它看起來像。
  expect(rows.map((r) => r.cells), '🔴 圖的格數與宣告不一致').toEqual([1, 2, 3, 0, 0])
  // ⚠️ **只驗有圖的那三列**——開關那兩列本來就沒有示意圖（上一行剛宣告過），
  //    連它們一起驗的話，這條測試會在「開關加進選單」的那一天變紅，
  //    而它抱怨的是一個**它自己剛說對的**設計。
  expect(
    rows.filter((r) => r.cells > 0).every((r) => r.visible > 0),
    '🔴 圖畫出來是 0 寬 → 使用者看不到',
  ).toBe(true)
})

/**
 * 🔴 **四格的頭是同一種東西**（2026-09-01）。
 *
 * 使用者：「我覺得你把積木的工具列加回來好了，我覺得**面板統一**好像更重要
 * 一點，或是你可以**統一一下這些面板的框架**嗎？」
 *
 * 而「不統一」不是感覺——量出來是四份各自寫的樣式長出了三個底色與三個間距：
 *
 * ```
 * .panel-head          #2d2d2d  gap 4  padding 2px 8px
 * .quick-access-bar    #2d2d2d  gap 4  padding 2px 8px
 * .bottom-panel-tabs   #252526  gap 0  padding 0
 * .flow-toolbar        #252526  gap 8  padding 6px 10px
 * .monaco-clipboard-bar #1e1e1e gap 4  padding 6px 8px   ← 統一了三格之後才量到它
 * ```
 *
 * > **一個沒有人決定過的差異，不是設計，是漂移——而四份各自寫的定義，
 * > 保證會漂。**
 *
 * ⚠️ 為什麼是 e2e：`getComputedStyle` 要真的套用過樣式表才答得出來，
 *    而 happy-dom 沒有 CSS 引擎。
 */
test('🔴 四格的頭是同一種東西——底色、內距、間距都一樣', async ({ page }) => {
  // ⚠️ 「四格」＝ 三欄 ＋ 底下的主控台。它們**不在同一個容器**了（spec 171），
  //    而「讀起來是同一組」這件事不因為容器不同而放寬。
  await freshApp(page)
  await pick(page, 'three-column')
  const heads = await page.evaluate(() =>
    ['.monaco-clipboard-bar', '.flow-toolbar', '.quick-access-bar', '.bottom-panel-tabs']
      .map((sel) => {
        const el = document.querySelector(sel)
        if (!el) return { sel, missing: true }
        const cs = getComputedStyle(el)
        return {
          sel, missing: false,
          bg: cs.backgroundColor, padding: cs.padding, gap: cs.gap,
          borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomColor,
        }
      }))
  // 入口條件：四條都真的在畫面上（少一條的話下面的比對是空過的）
  expect(heads.filter((h) => h.missing).map((h) => h.sel), '🔴 有一格的頭不見了').toEqual([])
  const first = heads[0]
  for (const h of heads.slice(1)) {
    expect(h.bg, `🔴 ${h.sel} 的底色與 ${first.sel} 不同`).toBe(first.bg)
    expect(h.padding, `🔴 ${h.sel} 的內距與 ${first.sel} 不同`).toBe(first.padding)
    expect(h.gap, `🔴 ${h.sel} 的間距與 ${first.sel} 不同`).toBe(first.gap)
    expect(h.borderBottom, `🔴 ${h.sel} 的下緣線與 ${first.sel} 不同`).toBe(first.borderBottom)
  }
})

test('🔴 每一格都有頭——一格沒有頭，它讀起來就不是這一組的', async ({ page }) => {
  await freshApp(page)
  await pick(page, 'three-column')
  // ⚠️ 判準是「那一格的第一個子節點是一條頭」，不是「頁面上有幾條頭」
  //    ——後者在某一格少一條時仍然會過。
  for (const [cell, head] of [
    ['code-column', '.monaco-clipboard-bar'],
    ['flow-column', '.flow-toolbar'],
    ['blocks-column', '.quick-access-bar'],
    ['bottom-container', '.bottom-panel-tabs'],
  ] as const) {
    const has = await page.evaluate(([c, h]) => {
      const el = document.getElementById(c)
      return !!el?.querySelector(h)
    }, [cell, head] as [string, string])
    expect(has, `🔴 ${cell} 這一格沒有頭`).toBe(true)
  }
})
