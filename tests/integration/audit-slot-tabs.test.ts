/**
 * **第九十九條護欄**：每一個槽的分頁列**選項完全相同**，而使用者的指派是一個**置換**。
 *
 * ## 它從哪來
 *
 * 使用者 2026-09-01：「我希望**每個面板可以去選擇要哪一種視圖**，
 * 而不是現在只能用 tab 切換積木跟流程」。
 *
 * 而上一刀（spec 168）已經說出這件事的形狀：
 *
 * > 「**分頁不是問題，不對稱的分頁才是。**」
 *
 * 所以這一條守的是**對稱**：四個槽拿到的選項必須是同一份。
 * 🔴 每個面板自己帶一條分頁列的話，「選項一樣」就變成一條**要靠人維護**的規範
 * ——而這個專案有一句話講過那種東西：**沒有機械檢查的規範就是殼**。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果宣告的層少於 3、或置換的定義域是空的，代表這支沒有讀到那份宣告
 * > ——這份報表不算數，不是「指派都合法」。**
 *
 * 錨在**宣告了幾層**（合成量）。🔴 刻意不錨在「有幾個不合法的指派」。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測畫面**（分頁列長怎樣、點得動嗎）——那是 e2e 的事。
 * - **不檢測指派存不存得住**——那要跨一次重載，e2e 才驗得到。
 */
import { describe, it, expect } from 'vitest'
import { LAYER_ORDER } from '../../src/core/view-host'
import {
  identityAssignment, swapTo, effectiveAreas,
} from '../../src/core/host/slot-assignment'
import { LAYOUT_PRESETS, layoutPreset } from '../../src/core/host/layout-presets'

type Layer = (typeof LAYER_ORDER)[number]

/**
 * 是不是**雙射**：每一層恰好對到一層，而且沒有兩層對到同一個。
 *
 * 🔴 **第一版把它寫成「對合」**（`a[a[k]] === k`，套兩次回到自己），而那太嚴：
 * 連續兩次**不同**的對調會產生一個 3-cycle——它仍然是雙射，只是不是對合。
 * 護欄第一次跑就抓到這件事。
 *
 * > **「換回去一定回得去」要的是雙射，不是對合
 * > ——而後者聽起來也很對，所以它會被寫下來。**
 */
const isBijection = (a: Record<string, string>): boolean => {
  const keys = Object.keys(a), vals = Object.values(a)
  return keys.length === LAYER_ORDER.length
    && new Set(vals).size === vals.length
    && vals.every((v) => LAYER_ORDER.includes(v as Layer))
}

describe('第九十九條護欄：槽的分頁對稱，而指派是一個置換', () => {
  it('★ 入口條件——真的讀到那份宣告了', () => {
    // 錨在**宣告了幾層／幾個版面**（合成量），見檔頭的自我否證聲明
    expect(LAYER_ORDER.length, '🔴 層都沒讀到 → 下面的 0 是假的').toBeGreaterThan(2)
    expect(LAYOUT_PRESETS.length, '🔴 一個版面都沒讀到').toBeGreaterThan(0)
    expect(Object.keys(identityAssignment()).length, '🔴 置換的定義域是空的').toBe(LAYER_ORDER.length)
  })

  it('🔴 A1 硬性零：任何一次 `swapTo` 之後仍然是【雙射】', () => {
    // 雙射 ＝ 同一層不會出現在兩個槽，而且「換回去」一定回得去
    const bad: string[] = []
    let a = identityAssignment()
    for (const from of LAYER_ORDER) {
      for (const to of LAYER_ORDER) {
        a = swapTo(a, from, to)
        if (!isBijection(a as unknown as Record<string, string>)) bad.push(`${from}→${to}`)
      }
    }
    expect(bad, `這些 swapTo 之後不再是雙射：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 A4 硬性零：沒有覆寫時是【恆等】，而換兩次同樣的會回到原狀', () => {
    const id = identityAssignment()
    for (const l of LAYER_ORDER) expect(id[l], `${l} 的恆等壞了`).toBe(l)
    const once = swapTo(id, 'element', 'space')
    expect(swapTo(once, 'element', 'space'), '🔴 換兩次沒有回到原狀').toEqual(id)
    // ⚠️ 而**連續兩次不同的對調不必**回到原狀——那是 3-cycle，仍然是合法的雙射
    const twice = swapTo(swapTo(id, 'element', 'relation'), 'element', 'space')
    expect(isBijection(twice as unknown as Record<string, string>), '🔴 3-cycle 被判成壞的').toBe(true)
  })

  it('🔴 A2 硬性零：套用置換之後，格子的【形狀】一格都沒變', () => {
    // 置換只換名字不換形狀——格數、每一列的長度都要與宣告相同
    const a = swapTo(identityAssignment(), 'space', 'relation')
    const bad: string[] = []
    for (const p of LAYOUT_PRESETS) {
      const before = p.areas.map((r) => r.length)
      const after = effectiveAreas(p, a).map((r) => r.length)
      if (JSON.stringify(before) !== JSON.stringify(after)) bad.push(p.id)
    }
    expect(bad, `這些版面套用置換之後形狀變了：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 A2 硬性零：套用之後每一層仍然只佔【一塊】', () => {
    const a = swapTo(identityAssignment(), 'element', 'state')
    const bad: string[] = []
    for (const p of LAYOUT_PRESETS) {
      const areas = effectiveAreas(p, a)
      for (const layer of new Set(areas.flat())) {
        const cells: [number, number][] = []
        areas.forEach((row, r) => row.forEach((v, c) => { if (v === layer) cells.push([r, c]) }))
        const r0 = Math.min(...cells.map((x) => x[0])), r1 = Math.max(...cells.map((x) => x[0]))
        const c0 = Math.min(...cells.map((x) => x[1])), c1 = Math.max(...cells.map((x) => x[1]))
        if ((r1 - r0 + 1) * (c1 - c0 + 1) !== cells.length) bad.push(`${p.id} 的 ${layer}`)
      }
    }
    expect(bad, `這些層被置換切成不只一塊：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('★ 注入：兩個合成的壞指派各自認得出來', () => {
    // ⚠️ 合成的 Record，不是真實狀態——真實的會被修好，而合成規則不會
    const notBijection = { element: 'space', relation: 'space', space: 'element', state: 'state' }
    const missingLayer = { element: 'element', relation: 'relation', space: 'space' }
    expect(isBijection(notBijection), '🔴 認不出「兩層對到同一個」').toBe(false)
    expect(isBijection(missingLayer), '🔴 認不出「少一層」').toBe(false)
    expect(isBijection(identityAssignment() as unknown as Record<string, string>),
      '🔴 把正確的恆等判成壞的').toBe(true)
  })

  it('★ 反向：`swapTo` 到自己身上不得改變任何東西', () => {
    // 缺了這一條，一個「每次都亂換」的實作也能通過上面幾條
    const a = swapTo(identityAssignment(), 'space', 'relation')
    expect(swapTo(a, 'space', 'space'), '🔴 換到自己身上卻改了東西').toEqual(a)
  })

  it('🔴 硬性零：`effectiveAreas` 對【每一個】版面都算得出來', () => {
    const bad = LAYOUT_PRESETS.filter((p) => {
      try { return effectiveAreas(p, identityAssignment()).length === 0 } catch { return true }
    }).map((p) => p.id)
    expect(bad, `這些版面算不出有效格子表：\n  ${bad.join('\n  ')}`).toEqual([])
    expect(layoutPreset('nope' as never), '找不到的版面要回 undefined').toBeUndefined()
  })
})
