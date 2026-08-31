/**
 * **第八十一條護欄**：佈局宣告是**二維的格子表**，而每一層都拿得到位置。
 *
 * ## 它從哪來
 *
 * 原本這支守的是「預設列的是**哪幾層**，不是哪幾個面板」（2026-08-26，`history/169`），
 * 而它的兩條硬性零是**一維**的：
 *
 * ```
 * 舊  由左到右必須是 `LAYER_ORDER` 的子序列——不得重排
 * 舊  `state` 不得出現在編輯區的預設裡
 * ```
 *
 * 🔴 **2026-08-31 升成二維**（spec 168）。使用者逐字：「你現在把積木和流程用 tab
 * 切換我不太喜歡，**因為這樣程式碼面板就變得比較特別了**」——三個都是投影，
 * 而只有一個不必跟別人搶位子。
 *
 * 解法是「十字」：`程式碼｜積木 ／ 流程｜主控台`，四層各一格。而它**兩條舊規則都違反**
 * ——攤平成一維是 `element,space,relation,state`（`space` 跑到 `relation` 前面），
 * 而且 `state` 出現在宣告裡。
 *
 * ⚠️ **而那不是「規則被違反」，是規則在二維上沒有定義。** 升成：
 *
 * ```
 * 新  【每一列】與【每一欄】都必須是 `LAYER_ORDER` 的子序列（連續重複＝跨格）
 * 新  `state` 必須在【每一個】版面裡恰好一個連續矩形——**不得缺席**
 * ```
 *
 * 🟢 四張圖逐一驗過全部通過，而新規則**仍然擋掉鏡像版面**（`space,element` 不是子序列）。
 *
 * 🔴 舊那條 `state` 規則的理由逐字是「**列它進來會讓面板區變成一個可以被佈局關掉的
 * 東西**」——而十字沒有關掉它，是給了它一個對等的格子。
 *
 * > **一條規則如果是為了防止「消失」而寫成「不准出現」，
 * > 它會連「換個位置出現」一起擋掉。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果宣告的版面數是 0，代表這支沒有讀到那份宣告——這份報表不算數，
 * > 不是「版面都合規」。**
 *
 * 錨在**宣告了幾個版面**（合成量）。🔴 刻意不錨在「有幾個違規」——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測畫面**（欄寬、分隔線、縮圖長怎樣）——那是 e2e 的事。
 * - **不檢測「四張夠不夠用」**——設計判斷，沒有機械判準。
 * - **不檢測有沒有人真的用它**——那要一支 e2e。
 */
import { describe, it, expect } from 'vitest'
import { LAYOUT_PRESETS, layoutPreset } from '../../src/core/host/layout-presets'
import { LAYER_ORDER } from '../../src/core/view-host'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import en from '../../src/i18n/en/blocks.json'

type Slot = string
type Areas = readonly (readonly Slot[])[]

/**
 * ⚠️ 用**選擇性存取**拿 `areas`，而不是直接讀型別上的欄位。
 *
 * 🔴 理由是 `build-guardrail` §9 的第四種結局：**注入讓建置壞掉，測試根本沒跑**
 * ——而那個輸出裡沒有 `failed` 字樣，會被讀成「綠的」。這支在 `areas` 還不存在時
 * 必須**真的紅**，不是編不過。
 */
const areasOf = (p: unknown): Areas | undefined =>
  (p as { areas?: Areas }).areas

/** 去掉**連續**重複（跨格算一格）。`['state','state']` → `['state']` */
export function dedupeRun(xs: readonly Slot[]): Slot[] {
  return xs.filter((x, i) => i === 0 || x !== xs[i - 1])
}

/**
 * 是不是 `LAYER_ORDER` 的子序列。
 *
 * ⚠️ **`state` 與 `'*'` 不參與**。
 *
 * 🔴 理由：`LAYER_ORDER` 排的是**對同一個程式的理解層次**（細 → 粗），
 * 而 `state` 不是程式的投影，是**程式在講話**。把它算進順序的話，
 * 「主控台在程式碼底下、而積木跨兩列」這個**今天就存在而且是對的**版面會被判成重排。
 *
 * > **一條「不准重排」的規則，只該管那些真的有順序的東西。**
 *
 * 🟢 而扣掉它之後這條仍然擋得住鏡像版面（`space, element` 還是不合格）——
 * 那才是這條規則存在的理由。
 */
export function isSubsequence(xs: readonly Slot[]): boolean {
  const idx = dedupeRun(xs).filter((x) => x !== '*' && x !== 'state')
    .map((x) => LAYER_ORDER.indexOf(x as never))
  if (idx.some((i) => i < 0)) return false
  return idx.every((v, i) => i === 0 || v > idx[i - 1])
}

export const columnsOf = (a: Areas): Slot[][] =>
  a[0].map((_, c) => a.map((row) => row[c]))

/** 這一層佔的格子是不是一個**實心矩形**（沒有洞、沒有分成兩塊）。 */
export function isSolidRect(a: Areas, layer: Slot): boolean {
  const cells: [number, number][] = []
  a.forEach((row, r) => row.forEach((v, c) => { if (v === layer) cells.push([r, c]) }))
  if (cells.length === 0) return false
  const r0 = Math.min(...cells.map((x) => x[0])), r1 = Math.max(...cells.map((x) => x[0]))
  const c0 = Math.min(...cells.map((x) => x[1])), c1 = Math.max(...cells.map((x) => x[1]))
  if ((r1 - r0 + 1) * (c1 - c0 + 1) !== cells.length) return false
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (a[r][c] !== layer) return false
  return true
}

describe('第八十一條護欄：佈局宣告是二維的格子表', () => {
  it('★ 入口條件：真的讀到那份宣告了', () => {
    // 錨在**宣告了幾個版面**（合成量），見檔頭的自我否證聲明。
    expect(LAYOUT_PRESETS.length, '一個版面都沒讀到 → 下面的 0 是假的').toBeGreaterThan(0)
    expect(LAYOUT_PRESETS.map((p) => p.id)).toEqual(['focus', 'compare', 'three-column', 'grid'])
  })

  it('🔴 I1 硬性零：每個版面都要有 `areas`，而且是【矩形】', () => {
    const bad = LAYOUT_PRESETS.filter((p) => {
      const a = areasOf(p)
      return !a || a.length === 0 || a.some((row) => row.length !== a[0].length)
    }).map((p) => p.id)
    expect(bad, `這些版面沒有 areas 或不是矩形（不是矩形就畫不出格子）：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 I2 硬性零：每一格的值必須是宣告過的層，或 `*`', () => {
    const bad = LAYOUT_PRESETS.flatMap((p) =>
      (areasOf(p) ?? []).flat().filter((v) => v !== '*' && !LAYER_ORDER.includes(v as never)))
    expect([...new Set(bad)], `這些不是宣告過的層：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 I3 硬性零：每一【列】與每一【欄】都要是 `LAYER_ORDER` 的子序列——不得重排', () => {
    // 🔴 這一條就是「左右是**語義**不是偏好」的執行機構——它擋掉鏡像版面
    const bad: string[] = []
    for (const p of LAYOUT_PRESETS) {
      const a = areasOf(p); if (!a) continue
      a.forEach((row, i) => { if (!isSubsequence(row)) bad.push(`${p.id} 第 ${i + 1} 列`) })
      columnsOf(a).forEach((col, i) => { if (!isSubsequence(col)) bad.push(`${p.id} 第 ${i + 1} 欄`) })
    }
    expect(bad, `這些把層的順序重排了：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 I4 硬性零：`state` 必須在【每一個】版面裡恰好一個連續矩形——不得缺席', () => {
    // 🔴 舊規則寫的是「state 不得出現」，理由是怕面板區被佈局關掉。
    //    而版面可以【搬】它，不得【關掉】它——所以判準要反過來寫。
    const bad = LAYOUT_PRESETS.filter((p) => {
      const a = areasOf(p); if (!a) return true
      return !isSolidRect(a, 'state')
    }).map((p) => p.id)
    expect(bad, `這些版面把主控台弄不見了（或把它切成兩塊）：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 I5 硬性零：同一層在一個版面裡最多一個連續矩形——一層兩塊＝兩個真相', () => {
    const bad: string[] = []
    for (const p of LAYOUT_PRESETS) {
      const a = areasOf(p); if (!a) continue
      for (const layer of new Set(a.flat())) {
        if (layer !== '*' && !isSolidRect(a, layer)) bad.push(`${p.id} 的 ${layer}`)
      }
    }
    expect(bad, `這些層被切成不只一塊：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 I6 硬性零：`*`（當下那一層）只准出現在 `focus`', () => {
    // 其餘版面的內容是**宣告**出來的，不是當下狀態
    const bad = LAYOUT_PRESETS
      .filter((p) => p.id !== 'focus' && (areasOf(p) ?? []).flat().includes('*'))
      .map((p) => p.id)
    expect(bad, `這些版面把內容交給了當下狀態：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 硬性零：每一個版面都要有一個【給人看的名字】（兩種語言）', () => {
    const missing: string[] = []
    for (const p of LAYOUT_PRESETS) {
      if (!(zhTW as unknown as Record<string, string>)[p.nameKey]) missing.push(`${p.id}（zh-TW）`)
      if (!(en as unknown as Record<string, string>)[p.nameKey]) missing.push(`${p.id}（en）`)
    }
    expect(missing, `這些版面在畫面上會顯示代號：\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('★ 注入：六個判準各自認得出它要抓的那一種', () => {
    // ⚠️ **合成的格子表**，不是真實宣告——真實的會被修好，而合成規則不會
    const mirrored: Areas = [['space', 'element'], ['state', 'state']]
    // ⚠️ **第一版這個樣本寫錯了**：`[['element','space'],['relation','space']]` 的 `space`
    //    是一個合法的【直向跨格】（2×1 的實心矩形），不是兩塊——而注入當場抓到它。
    //    > **一個「證明判準會報」的樣本，本身也要是真的違規。**
    const splitLayer: Areas = [['space', 'element'], ['relation', 'space']]   // 對角線，不連續
    const noState: Areas = [['element', 'space'], ['relation', 'relation']]
    const notRect: Areas = [['element', 'space'], ['state']]
    const notALayer: Areas = [['zzz', 'space'], ['state', 'state']]

    expect(isSubsequence(['element', 'space']), 'I3 誤判了正確的順序').toBe(true)
    expect(isSubsequence(mirrored[0]), 'I3 認不出鏡像').toBe(false)
    expect(isSubsequence(['state', 'state', 'state']), 'I3 沒把連續重複當成一格').toBe(true)
    expect(isSubsequence(['state', 'space']), 'I3 把「主控台在左、積木在右」誤判成重排').toBe(true)
    expect(isSubsequence(['space', 'element', 'state']), 'I3 扣掉 state 之後就放過鏡像了').toBe(false)
    expect(columnsOf(mirrored), 'columnsOf 轉置錯了').toEqual([['space', 'state'], ['element', 'state']])
    expect(isSolidRect(splitLayer, 'space'), 'I5 認不出一層兩塊').toBe(false)
    expect(isSolidRect([['element', 'space'], ['relation', 'space']], 'space'),
      'I5 誤判了合法的直向跨格').toBe(true)
    expect(isSolidRect(noState, 'state'), 'I4 認不出主控台不見了').toBe(false)
    expect(isSolidRect([['element', 'space'], ['state', 'state']], 'state'), 'I4 誤判了正確的跨格').toBe(true)
    expect(notRect.some((r) => r.length !== notRect[0].length), 'I1 認不出不是矩形').toBe(true)
    expect(notALayer.flat().some((v) => !LAYER_ORDER.includes(v as never) && v !== '*'), 'I2 認不出不是層').toBe(true)
  })

  it('★ 反向：問一個不存在的版面要回 `undefined`——不得回一個「差不多」的', () => {
    // 缺了這一條，一個「找不到就回第一個」的實作也能通過上面幾條，
    // ⚠️ 而那會讓一個打錯的版面**靜靜地變成專注模式**。
    expect(layoutPreset('nope' as never)).toBeUndefined()
    expect(areasOf(layoutPreset('compare'))).toEqual([['element', 'space'], ['state', 'space']])
  })
})
