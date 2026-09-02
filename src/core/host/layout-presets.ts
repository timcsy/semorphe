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

/**
 * 🪦 `'grid'`（十字）**退場**（spec 171，2026-09-02）。
 *
 * 它是**唯一需要編輯區有第二列**的版面——而那個需求只存在於「主控台是編輯區
 * 的一格」的那段期間。主控台搬去底下之後，三張版面全是純欄。
 *
 * 🔴 而它的理念（使用者 2026-08-31：「四格，每一層一格」「**沒有任何一層是
 * 特別的**」）**由「上面三欄平等」承接**——程式碼、流程、積木誰都不特別，
 * 而主控台**不參加這個比較**，因為它不是一種投影。
 *
 * > **「沒有任何一層是特別的」這句話，在發現其中一個根本不是那種東西之後，
 * > 要說的是【它不參加這個比較】，而不是【硬給它一格】。**
 *
 * 見 `history/202`。
 */
export type LayoutPresetId = 'focus' | 'compare' | 'three-column'

/**
 * 一格裡放什麼。`'*'` ＝**使用者現在看的那一層**，只有 `focus` 用得到。
 *
 * ⚠️ 用佔位而不是特例分支——讓「專注」仍然只是一份宣告。
 */
/**
 * 🔴 **編輯區只有三層**（spec 171）——主控台不在這裡。
 *
 * ⚠️ 型別上就排除掉，不是靠註解請人不要寫：
 * **「主控台是編輯區的一格」這件事現在【寫不出來】。**
 */
export type EditorLayer = Exclude<UnderstandingLayer, 'state'>

export type LayoutSlot = EditorLayer | '*'

export interface LayoutPresetSpec {
  readonly id: LayoutPresetId
  /** 給人看的名字的 i18n 鍵——⚠️ **不得把 id 印上畫面**（第七十八條同一個原則）。 */
  readonly nameKey: string
  /**
   * **這張版面由左到右有哪幾欄**（一欄一格）。
   *
   * 🪦 **2026-09-02（spec 171）：它曾經是一張二維的格子表**，因為十字要
   * 「四層各一格」而主控台是其中一格。主控台搬去底下（宿主的 panel 區）之後，
   * 編輯區**只有一列**——型別上仍然是 `[列][欄]`（CSS 與示意圖用得到它），
   * 而**第一列就是全部**。`tests/unit/core/host-layout-options.test.ts`
   * 釘著「每一張都只有一列」。
   *
   * 🟢 它與 CSS `grid-template-areas` 同構，而**同一份宣告餵三個消費者**：
   * 套用（設進 CSS）、示意圖（畫格子）、護欄（第八十一條的不變式）。
   */
  readonly areas: readonly (readonly LayoutSlot[])[]
}

/**
 * **三個版面，而每一張都只有一列**（spec 171，2026-09-02）。
 *
 * 🔴 主控台不在這裡——它是編輯區**底下**一條全寬的、開得關得的東西。
 * 它不是一種投影，是執行的輸出（三維錨定，`history/198`）。
 *
 * 🟢 而「每一張都只有一列」不是巧合，是**這一刀的結果**：
 * 唯一需要第二列的是十字，而十字需要第二列**只因為主控台在編輯區裡**。
 *
 * ⟹ 三張版面用「把一格顯示到第幾欄」就排得出來——**三個宿主都做得到**，
 * 不需要任何「一次宣告整張版面」的宿主指令（Theia 沒有那顆）。
 *
 * ⚠️ 每一列由左到右仍然是 `LAYER_ORDER` 的子序列——不重排，因為那個順序是
 * **理解的層次**不是偏好。第八十一條護欄的 I3 盯著它。
 */
export const LAYOUT_PRESETS: readonly LayoutPresetSpec[] = [
  // 專注：一次一層。⚠️ 哪一層由使用者現在看的那個分頁決定，不寫死。
  { id: 'focus', nameKey: 'LAYOUT_PRESET_FOCUS', areas: [['*']] },
  // 對照：程式碼 ＋ 積木——**取用要相鄰**（同一段程式的兩個投影並排）
  { id: 'compare', nameKey: 'LAYOUT_PRESET_COMPARE', areas: [['element', 'space']] },
  // 三欄：再加上關係層（流程）——**認識要面積**
  {
    id: 'three-column', nameKey: 'LAYOUT_PRESET_THREE',
    areas: [['element', 'relation', 'space']],
  },
  // 🪦 **十字（`grid`）退場**（spec 171）。見 `LayoutPresetId` 的說明：
  //    它的理念由「上面三欄平等」承接，而主控台不參加那個比較。
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
  /** 這個宿主四層都在 ⟹ 用宣告的名字；否則名字要從 `areas` 導。 */
  readonly complete: boolean
}

/**
 * 一張版面在這個宿主上剩下的格子（這個宿主沒有的那一欄就拿掉）。
 *
 * 🪦 **2026-09-02（spec 171）**：這裡本來還有「拿掉整列」與 `normalizeShape`
 * （把逐格相同的相鄰列收成一格）。三張版面全是純欄之後，**列只有一列**
 * ——那兩段判斷永遠走同一條分支。
 *
 * > **「兩列逐格相同要算一格」是一個真問題，
 * > 而它只在【有第二列】的世界裡是真的。**
 */
export function reduceAreas(
  preset: LayoutPresetSpec,
  available: (l: UnderstandingLayer) => boolean,
  focusLayer: UnderstandingLayer,
): readonly (readonly UnderstandingLayer[])[] {
  const row = preset.areas[0].map((v) => (v === '*' ? focusLayer : v)).filter(available)
  return row.length === 0 ? [] : [row]
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
    // ⚠️ 簽章要含順序，不只含層——同樣三層，左右排法不同就是兩張版面。
    const sig = areas[0].join(' ')
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({ id: p.id, nameKey: p.nameKey, areas, complete })
  }
  return out
}
