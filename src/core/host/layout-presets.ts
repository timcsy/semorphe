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
import { LAYER_ORDER, type UnderstandingLayer } from '../view-host'

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
  // ⚠️ **左欄與「對照」逐格相同**（程式碼在上、主控台在下）——切過去時
  //    整個左半一個像素都不動，右半才從「積木佔滿」拆成「流程／積木」。
  //
  // > **一個切換版面時「你正在看的東西不會跳走」的版面組，
  // > 比一個每一格都重排的版面組好用得多。**
  //
  // 🪦 2026-09-01 之前是 `element,space ／ relation,state`（上排程式碼｜積木）。
  //    使用者改成這一版——而它**保住的是更大的一塊**：整個左欄，而不只是兩格的位置。
  //    ⚠️ 代價是積木從右上移到右下；`e2e/layout-presets.spec.ts` 的斷言跟著改。
  {
    id: 'grid', nameKey: 'LAYOUT_PRESET_GRID',
    // ⚠️ **四格等大**——「沒有任何一層是特別的」是可量的（SC-005：面積差 ±5%）
    areas: [['element', 'relation'], ['state', 'space']], rows: ['1fr', '1fr'], cols: ['1fr', '1fr'],
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

/**
 * 這張版面**在這個宿主上**實際會長成什麼形狀。
 *
 * ## 🔴 為什麼版面清單不能是一份固定的清單
 *
 * 2026-09-01，使用者在 VSCode 裡：「**說是四格其實根本不是**，
 * 在 VSCode 中主控台好像只能佔領下面整片」。
 *
 * 而他是對的：程式碼在 IDE 的編輯器裡、主控台是 IDE 的終端機
 * （`vscode-profile.ts` 的 `controlSurfaces` 明說），於是面板裡**只有兩層**。
 * 「十字（四格，每一層一格）」在那裡永遠只畫得出兩格。
 *
 * ```
 * 宣告的十字              VSCode 實際畫出來的
 *   程式碼 │ 流程            流程
 *   ───────┼─────    →      ────
 *   主控台 │ 積木            積木
 * ```
 *
 * > **一個版面的名字如果數的是【宣告裡的格數】，
 * > 它在少了一層的宿主上就是一句假話——而畫面不會反駁它。**
 *
 * 🟢 所以名字從**這裡**導出：先把宿主沒有的整列整欄拿掉，再看剩下什麼。
 *
 * ⚠️ 而**塌成同一個形狀的版面只留一張**——在 VSCode 上「專注」與「對照」
 * 都只剩積木一格，兩個選項長得一樣、按下去也一樣。
 *
 * > **兩個選項如果做的是同一件事，它們不是「兩個選擇」，是一份雜訊。**
 */
export interface HostLayoutOption {
  readonly id: LayoutPresetId
  readonly nameKey: string
  /** 拿掉這個宿主沒有的整列整欄之後，剩下的格子（**跨格保留**——示意圖要畫它）。 */
  readonly areas: readonly (readonly UnderstandingLayer[])[]
  /**
   * 同上，但**跨格收成一格**——「有幾格、怎麼排」問的是這個。
   *
   * 🔴 2026-09-01 實測抓到的：在 VSCode 上「三欄」縮減成
   * `[[流程,積木],[流程,積木]]`——兩列**逐格相同**，那不是四格，
   * 是**兩格各跨兩列**。而拿列數去判斷形狀的話，它會被當成「二維」而放棄命名，
   * 於是名字退回宣告的「三欄（程式碼 · 流程 · 積木）」——**又在說程式碼**。
   *
   * ⚠️ 同一個根還讓「專注」與「對照」在那裡變成**兩個一模一樣的選項**
   * （`[[積木]]` 與 `[[積木],[積木]]` 簽章不同、畫面相同）。
   *
   * > **一張矩陣裡重複的整列，說的是「這一格比較高」，不是「這裡有兩格」
   * > ——把它當成兩格，會同時弄錯【數量】與【形狀】。**
   */
  readonly shape: readonly (readonly UnderstandingLayer[])[]
  /** 這個宿主四層都在 ⟹ 用宣告的名字；否則名字要從 `areas` 導。 */
  readonly complete: boolean
}

/**
 * 把**跨格**收成一格：相鄰而逐格相同的列（欄）合併。
 *
 * ```
 * [[積木],[積木]]          → [[積木]]           一格跨兩列
 * [[流程,積木],[流程,積木]] → [[流程,積木]]      兩格各跨兩列
 * [[流程],[積木]]          → [[流程],[積木]]    真的是兩格
 * ```
 */
export function normalizeShape(
  areas: readonly (readonly UnderstandingLayer[])[],
): readonly (readonly UnderstandingLayer[])[] {
  const rows = areas.filter((row, r) => r === 0 || row.join(' ') !== areas[r - 1].join(' '))
  const keepCol = rows[0].map((_, c) => c === 0 || rows.some((row) => row[c] !== row[c - 1]))
  return rows.map((row) => row.filter((_, c) => keepCol[c]))
}

/** 一張版面在這個宿主上剩下的格子（整列整欄都沒有的就拿掉）。 */
export function reduceAreas(
  preset: LayoutPresetSpec,
  available: (l: UnderstandingLayer) => boolean,
  focusLayer: UnderstandingLayer,
): readonly (readonly UnderstandingLayer[])[] {
  const a = preset.areas.map((row) => row.map((v) => (v === '*' ? focusLayer : v)))
  const keepCol = a[0].map((_, c) => a.some((row) => available(row[c])))
  const keepRow = a.map((row) => row.some((v) => available(v)))
  return a.filter((_, r) => keepRow[r]).map((row) => row.filter((_, c) => keepCol[c]))
}

/**
 * 這個宿主提供得出來的版面清單——**塌成同形狀的只留第一張**。
 *
 * ⚠️ 順序照宣告，所以「留第一張」＝ 留下宣告裡比較前面（比較簡單）的那一個。
 */
export function hostLayoutOptions(
  available: (l: UnderstandingLayer) => boolean,
  focusLayer: UnderstandingLayer = 'element',
): readonly HostLayoutOption[] {
  const complete = LAYER_ORDER.every((l) => available(l))
  const seen = new Set<string>()
  const out: HostLayoutOption[] = []
  for (const p of LAYOUT_PRESETS) {
    const areas = reduceAreas(p, available, focusLayer)
    // 🔴 **一格都不剩的版面不是一個選項**（2026-09-01 實測）。
    //
    //    在一個只畫流程的視窗裡，「對照」（程式碼｜積木／主控台｜積木）
    //    一層都不在——縮減之後是一張**空矩陣**。而它不只是「不好用」：
    //    `applyLayout` 拿 `areas[0]` 去鋪軌道，於是**開機就炸**，
    //    面板一片空白而 console 只有一行 `undefined (reading 'map')`。
    //
    // > **一個「把不要的拿掉」的化簡，要能回答「全部都不要」那一格
    // > ——而它的答案通常不是「空的」，是「這件事不存在」。**
    if (areas.length === 0 || areas[0].length === 0) continue
    const shape = normalizeShape(areas)
    // ⚠️ 簽章要含形狀，不只含層——「並排」與「上下」的層一樣而形狀不同。
    // 🔴 而它問的是 `shape` 不是 `areas`：跨格與單格**畫面上是同一件事**。
    const sig = shape.map((r) => r.join(' ')).join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({ id: p.id, nameKey: p.nameKey, areas, shape, complete })
  }
  return out
}
