/**
 * **桌機的佈局預設**——「這一刻要看見哪幾層」。
 *
 * ## 路線圖那條驗收的原話
 *
 * > 驗收：桌機**佈局預設**（專注／對照／三欄）＋ 可拖分隔線；**不做自由 docking**
 *
 * 而它的分界寫在同一項的標題下：
 *
 * > 🎯 **版面的分界不是「這是哪一類」，是「這東西怎麼被用」**：
 * > 取用要**相鄰**、認識要**面積**、狀態在**面板區**。
 *
 * ## 🔴 為什麼是「哪幾層」而不是「哪幾個面板」
 *
 * 2026-08-26 已經把「面板在哪裡」換成**面板宣告自己在哪一層**
 * （`concepts/理解的層次.md`：`element`／`relation`／`space`／`state`）。
 * 佈局預設如果列面板名字，**加一個面板就要改三個預設**
 * ——而那正是那一刀要消滅的形狀。
 *
 * > **預設列的是「看見哪幾層」，而哪個面板在那一層是面板自己說的。**
 *
 * ⚠️ `state`（主控台／變數）**不在這裡**：它的家是下方的面板區，
 * 三個預設都一樣。列它進來會讓「面板區」變成一個可以被佈局關掉的東西，
 * 而那與「程式在講話的地方」衝突。
 *
 * ## 為什麼不做自由 docking
 *
 * 路線圖明文排除。理由不在這一支裡而在那份 draft：自由 docking 讓
 * **每一個使用者的畫面都不一樣**，而這是一個教學工具
 * ——老師說「看左邊那一欄」時，那句話要對每個人都成立。
 */
import type { UnderstandingLayer } from '../view-host'

export type LayoutPresetId = 'focus' | 'compare' | 'three-column' | 'grid'

/**
 * 一格裡放什麼。`'*'` ＝**使用者現在看的那一層**，只有 `focus` 用得到。
 *
 * ⚠️ 用佔位而不是特例分支——讓「專注」仍然只是一份宣告。
 */
export type LayoutSlot = UnderstandingLayer | '*'

export interface LayoutPresetSpec {
  readonly id: LayoutPresetId
  /** 給人看的名字的 i18n 鍵——⚠️ **不得把 id 印上畫面**（第七十八條同一個原則）。 */
  readonly nameKey: string
  /**
   * **二維的格子表**：一列一個陣列，**同一層連續重複 ＝ 跨格**。
   *
   * 🔴 **2026-08-31 取代了 `layers: UnderstandingLayer[]`**（spec 168）。
   * 那個欄位是一維的，說得出「開哪幾層」，說不出「**哪一層在哪一格**」
   * ——於是「十字」（四層各一格）表達不出來。
   *
   * 🟢 它與 CSS `grid-template-areas` **同構**，而**同一份 `areas` 餵三個消費者**：
   *
   * ```
   * 套用    gridTemplateAreas()  → 設進 CSS
   * 示意圖  thumbnailCells()     → 畫格子（不是另一份資料，所以不可能與畫面不符）
   * 護欄    第八十一條的六條不變式
   * ```
   */
  readonly areas: readonly (readonly LayoutSlot[])[]
  /**
   * 每一列／每一欄的**預設**大小（CSS 軌道值）。省略 ＝ 全部 `1fr`。
   *
   * ⚠️ 它是**預設**不是狀態：拖過分隔線之後不跨版面記憶（spec 168 的假設段），
   * 切版面就回到這裡寫的值。
   */
  readonly rows?: readonly string[]
  readonly cols?: readonly string[]
}

/**
 * 四個版面。**每一列與每一欄由左到右／由上到下都是 `LAYER_ORDER` 的子序列**
 * ——不重排，因為那個順序是**理解的層次**不是偏好。第八十一條護欄的 I3 盯著它。
 */
export const LAYOUT_PRESETS: readonly LayoutPresetSpec[] = [
  // 專注：一次一層。⚠️ 哪一層由使用者現在看的那個分頁決定，不寫死。
  { id: 'focus', nameKey: 'LAYOUT_PRESET_FOCUS', areas: [['*'], ['state']], rows: ['2.5fr', '1fr'] },
  // 對照：程式碼 ＋ 積木——**取用要相鄰**（同一段程式的兩個投影並排）
  // ⚠️ **主控台在程式碼底下，而積木跨兩列**——那是今天就有的形狀
  //    （`bottomContainer` 掛在 `codeColumn` 裡），不是這一刀改的。
  {
    id: 'compare', nameKey: 'LAYOUT_PRESET_COMPARE',
    areas: [['element', 'space'], ['state', 'space']], rows: ['2fr', '1fr'],
  },
  // 三欄：再加上關係層（流程）——**認識要面積**
  {
    id: 'three-column', nameKey: 'LAYOUT_PRESET_THREE',
    areas: [['element', 'relation', 'space'], ['state', 'relation', 'space']], rows: ['2fr', '1fr'],
  },
  // 十字：四層各一格，**而沒有任何一層是特別的**。
  //
  // 🔴 使用者 2026-08-31：「你現在把積木和流程用 tab 切換我不太喜歡，
  //    **因為這樣程式碼面板就變得比較特別了**」。
  //
  // ⚠️ **上排是程式碼｜積木，不是程式碼｜流程**——那樣切「對照 → 十字」時
  //    積木會從右上跳到左下。這樣排的話**程式碼與積木一格都不動**，只是底下長出兩格。
  //
  // > **一個切換版面時「你正在看的東西不會跳走」的版面組，
  // > 比一個每一格都重排的版面組好用得多。**
  {
    id: 'grid', nameKey: 'LAYOUT_PRESET_GRID',
    // ⚠️ **四格等大**——「沒有任何一層是特別的」是可量的（SC-005：面積差 ±5%）
    areas: [['element', 'space'], ['relation', 'state']], rows: ['1fr', '1fr'], cols: ['1fr', '1fr'],
  },
]

export function layoutPreset(id: LayoutPresetId): LayoutPresetSpec | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === id)
}

/** CSS `grid-template-areas` 的字串。`focusLayer` 用來代換 `'*'`。 */
export function gridTemplateAreas(
  preset: LayoutPresetSpec,
  focusLayer: UnderstandingLayer = 'element',
): string {
  return preset.areas
    .map((row) => `"${row.map((v) => (v === '*' ? focusLayer : v)).join(' ')}"`)
    .join(' ')
}

/** 示意圖的一格。**跨格算一格**，所以 `rowSpan`／`colSpan` 可能大於 1。 */
export interface ThumbnailCell {
  readonly layer: UnderstandingLayer
  readonly row: number
  readonly col: number
  readonly rowSpan: number
  readonly colSpan: number
}

/**
 * 畫示意圖要的格子。
 *
 * 🔴 **它與 `gridTemplateAreas()` 由同一份 `areas` 導出**——所以圖上的格數與位置
 * **不可能**與套用後的畫面不同。手畫的圖會漂開，而漂開時沒有任何機構會出聲。
 *
 * ⚠️ `'*'` 用 `focusLayer` 代換（預設 `element`），否則「專注」那張圖會是空的。
 */
export function thumbnailCells(
  preset: LayoutPresetSpec,
  focusLayer: UnderstandingLayer = 'element',
): readonly ThumbnailCell[] {
  const a = preset.areas.map((row) => row.map((v) => (v === '*' ? focusLayer : v)))
  const seen = new Set<string>()
  const out: ThumbnailCell[] = []
  a.forEach((row, r) => row.forEach((layer, c) => {
    if (seen.has(layer)) return
    seen.add(layer)
    let colSpan = 1
    while (c + colSpan < row.length && row[c + colSpan] === layer) colSpan++
    let rowSpan = 1
    while (r + rowSpan < a.length && a[r + rowSpan][c] === layer) rowSpan++
    out.push({ layer, row: r + 1, col: c + 1, rowSpan, colSpan })
  }))
  return out
}

/** 這個版面看得到哪幾層（工具箱／控制項要問）。 */
export function occupiedLayers(
  preset: LayoutPresetSpec,
  focusLayer: UnderstandingLayer = 'element',
): ReadonlySet<UnderstandingLayer> {
  return new Set(preset.areas.flat().map((v) => (v === '*' ? focusLayer : v)))
}
