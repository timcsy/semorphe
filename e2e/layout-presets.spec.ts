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

test('★ 入口條件：編輯區真的是一張 grid，而四格都建出來了', async ({ page }) => {
  // 錨在**合成量**（是不是 grid、建了幾個容器），不是「有幾個位置對」
  // ——後者會在這支成功的那天變紅。
  await freshApp(page)
  const s = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('editors')!).display,
    cells: ['code-column', 'blocks-column', 'flow-column', 'bottom-container']
      .filter((id) => document.getElementById(id)).length,
  }))
  expect(s.display, '🔴 編輯區不是 grid → 下面每一個座標都不算數').toBe('grid')
  expect(s.cells, '🔴 四格沒有全部建出來 → 下面的「不見了」可能只是沒建').toBe(4)
})

test('🔴 從「對照」切到「十字」，【整個左欄】不跳走', async ({ page }) => {
  // 這是使用者那句話的執行機構：切版面時你正在看的東西不會換位子。
  //
  // 🪦 2026-09-01 之前這一支釘的是「程式碼**與積木**不跳走」（那時十字是
  //    `element,space ／ relation,state`）。使用者把十字改成
  //    `element,relation ／ state,space` 之後，保住的是**更大的一塊**：
  //    整個左欄與「對照」逐格相同——只有積木讓位給流程。
  await freshApp(page)
  const a = { code: await boxOf(page, 'code-column'), bottom: await boxOf(page, 'bottom-container') }
  expect(a.code, '🔴 一開機程式碼那一格就不見了 → 這支測的不是那條路').not.toBeNull()

  await pick(page, 'grid')
  const b = { code: await boxOf(page, 'code-column'), bottom: await boxOf(page, 'bottom-container') }

  expect({ x: b.code!.x, y: b.code!.y }, '🔴 程式碼跳走了').toEqual({ x: a.code!.x, y: a.code!.y })
  expect(b.bottom!.x, '🔴 主控台換了欄').toBe(a.bottom!.x)
})

test('🔴 十字：四格【等大】——「沒有任何一層是特別的」是可量的', async ({ page }) => {
  await freshApp(page)
  await pick(page, 'grid')
  const boxes = await Promise.all(
    ['code-column', 'blocks-column', 'flow-column', 'bottom-container'].map((id) => boxOf(page, id)))
  expect(boxes.every((b) => b !== null), '🔴 十字裡有格子不見了').toBe(true)
  const areas = boxes.map((b) => b!.w * b!.h)
  const max = Math.max(...areas), min = Math.min(...areas)
  // SC-005：面積差在 ±5% 以內
  expect((max - min) / max, `🔴 四格不等大：${areas.join(' / ')}`).toBeLessThan(0.05)
})

test('🔴 四個版面裡，主控台一次都不准不見', async ({ page }) => {
  // 🔴 舊規則寫的是「state 不得出現在編輯區的預設裡」，理由是怕面板區被佈局關掉。
  //    版面可以**搬**它，**不得關掉**它——所以判準要反過來寫。
  await freshApp(page)
  for (const id of ['focus', 'compare', 'three-column', 'grid']) {
    await pick(page, id)
    expect(await boxOf(page, 'bottom-container'), `🔴 「${id}」把主控台弄不見了`).not.toBeNull()
  }
})

test('🔴 十字：左上程式碼·右上流程·右下積木·左下主控台', async ({ page }) => {
  await freshApp(page)
  await pick(page, 'grid')
  const [code, flow, blocks, bottom] = await Promise.all(
    ['code-column', 'flow-column', 'blocks-column', 'bottom-container'].map((id) => boxOf(page, id)))
  expect([code, flow, blocks, bottom].every((b) => b !== null), '🔴 十字裡有格子不見了').toBe(true)
  // 左行 ＝ 程式碼／主控台　右行 ＝ 流程／積木
  expect(code!.x, '🔴 程式碼不在左').toBeLessThan(flow!.x)
  expect(bottom!.x, '🔴 主控台不在左下').toBe(code!.x)
  expect(blocks!.x, '🔴 積木不在右下').toBe(flow!.x)
  expect(bottom!.y, '🔴 主控台不在下排').toBeGreaterThan(code!.y)
  expect(blocks!.y, '🔴 積木不在下排').toBeGreaterThan(flow!.y)
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

test('🔴 分隔線的長度 ＝ 那條縫【真正存在】的長度——不得穿過跨格的格子', async ({ page }) => {
  // 🔴 使用者 2026-09-01：「那條水平線還是沒有處理好」。
  //    在「對照」裡積木是**跨兩列**的，它上面根本沒有縫——而第一版的橫線
  //    橫跨整個容器，從積木中間穿過去。
  //
  // > **一條分隔線的長度，等於那條縫真正存在的長度
  // > ——而跨格的地方，縫是不存在的。**
  await freshApp(page)
  const seam = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.grid-divider-rows')][0] as HTMLElement | undefined
    const code = document.getElementById('code-column')!.getBoundingClientRect()
    return h ? { right: parseFloat(h.style.left) + parseFloat(h.style.width), codeRight: Math.round(code.width) } : null
  })
  expect(seam, '🔴 「對照」裡沒有橫的分隔線 → 這支測的不是那條路').not.toBeNull()
  expect(seam!.right, '🔴 橫線穿過了積木——而積木在「對照」跨兩列，那裡沒有縫')
    .toBeLessThanOrEqual(seam!.codeRight + 1)
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


test('🔴 選單裡有四張【示意圖】，而每張的格數與宣告一致', async ({ page }) => {
  await freshApp(page)
  await openPicker(page)
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.quick-pick-overlay .quick-pick-item')].map((r) => ({
      id: (r as HTMLElement).dataset.value,
      cells: r.querySelectorAll('.quick-pick-preview-cell').length,
      visible: (r.querySelector('.quick-pick-preview') as HTMLElement | null)?.getBoundingClientRect().width ?? 0,
    })))
  expect(rows.map((r) => r.id)).toEqual(['focus', 'compare', 'three-column', 'grid'])
  // 跨格算【一格】——`compare` 的積木跨兩列，所以是 3 格不是 4 格
  expect(rows.map((r) => r.cells), '🔴 圖的格數與宣告不一致').toEqual([2, 3, 4, 4])
  expect(rows.every((r) => r.visible > 0), '🔴 圖畫出來是 0 寬 → 使用者看不到').toBe(true)
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
  await freshApp(page)
  await pick(page, 'grid')
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
  await pick(page, 'grid')
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
