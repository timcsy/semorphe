import type { DegradationCause, ConfidenceLevel } from '../../core/types'

// ─── 集中的類別顏色映射 ───

/**
 * ⚠️ **不要標成 `Record<string, string>`**——那讓**任何字串**都是合法的鍵，
 * 於是打錯一個鍵名 **tsc 一聲不吭**，而執行期是 `undefined`
 * → `setColour(undefined)` 拋錯 → **整個 flyout 渲染到那一顆就中斷**。
 *
 * 2026-08-14 實測：使用者打開「陣列與列表」只看到一顆積木，
 * 而全套測試與 e2e 都是綠的——**e2e 沒有打開工具箱分類**。
 *
 * > **一個索引簽名把「打錯字」變成「執行期才知道」，
 * > 而那正是型別系統本來要擋的東西。**
 *
 * `as const` 讓每個鍵成為字面型別，打錯就是編譯錯誤。
 */
export const CATEGORY_COLORS = {
  data: '#FF8C1A',
  operators: '#59C059',
  control: '#FFAB19',
  functions: '#FF6680',
  io: '#5CB1D6',
  arrays: '#FF661A',

  // ── 這一段的鍵**曾經叫 `cpp_*`**，而它們記的是【語義】不是語言（2026-08-22 正名）
  //
  // 🔴 顏色是**分類的視覺編碼**：學生靠它認「這是同一種東西」。
  //    而字串是綠松色、對應表是藍色這件事，**與那段程式是哪個語言無關**
  //    ——第二個語言用同一個顏色，才是同一條線；各挑各的，等於在兩個語言
  //    之間製造一條假的分界。
  //
  // ⚠️ 名字叫 `cpp_strings` 的時候，第二個語言要嘛借用一個名字裡寫著別人的鍵，
  //    要嘛自己挑一個顏色——**而後者是使用者 2026-08-21 回報過的那件事**。
  //
  // > **一個記著語義的東西，名字裡不該有語言。**
  basic: '#59C059',
  cpp_io: '#5CB1D6',
  pointers: '#9966FF',
  structs: '#CF63CF',
  strings: '#0FBD8C',
  containers: '#4C97FF',
  algorithms: '#4C97FF',
  math: '#5C81A6',
  special: '#888888',
  /**
   * 🔴 **錯誤處理自己一格**（2026-08-22）。
   *
   * 「程式出錯了怎麼辦」與「決定跑哪一段」是兩個不同的意圖，而把它們放在
   * 同一個分類裡，那個分類就有兩個主題。
   *
   * ⚠️ **紅色是這一格唯一說得通的語義**，而降級那組也是紅的
   * （`#FF6B6B` 語法錯誤、`#9E9E9E` 不支援）——所以刻意選**深而濃**的那一種：
   * 學生看到淺珊瑚紅是「這一段系統看不懂」，看到深紅是「這是我寫的錯誤處理」。
   *
   * 🔴 第一版用 `#A5577D`（紫紅），而**打開工具箱一看**它與旁邊的
   * 「類別與物件」洋紅太近，在側邊欄那一排色塊裡分不開。
   * > **顏色的可分辨性只有【並排看】才知道，色碼本身答不出來。**
   */
  errors: '#C0392B',
  /**
   * 硬體（Arduino）。⚠️ **三個硬體分類原本指著 `special`（灰）**，
   * 而它們的積木**全部是這個橘**——於是分類標題是灰的、抽屜裡是橘的。
   * 第五十二條護欄一落地就掃出那 40 筆。
   */
  hardware: '#E67E22',
  /**
   * 字典與序對。⚠️ **Python 這一格不與 C++ 的「對應與集合」同色**：
   * 那邊是 `containers` 藍，而 Python 把**通用的容器操作**放進了藍色那一格
   * （`a[i]`／`d[k]`／`s[i]` 在 Python 是同一顆積木——那顆元件的宣告寫著理由）。
   * 於是「字典」需要自己的顏色。
   */
  maps: '#9966FF',
} as const

// ─── 降級視覺映射 ───

export interface DegradationVisual {
  colour: string | null       // null 表示不覆蓋原色
  borderColour: string | null
  tooltipKey: string
  cssClass: string
}

export const DEGRADATION_VISUALS: Record<DegradationCause, DegradationVisual> = {
  syntax_error: {
    colour: '#FF6B6B',
    borderColour: null,
    tooltipKey: 'DEGRADATION_SYNTAX_ERROR',
    cssClass: 'degraded-syntax-error',
  },
  unsupported: {
    colour: '#9E9E9E',
    borderColour: null,
    tooltipKey: 'DEGRADATION_UNSUPPORTED',
    cssClass: 'degraded-unsupported',
  },
  nonstandard_but_valid: {
    colour: null,
    borderColour: '#4CAF50',
    tooltipKey: 'DEGRADATION_ADVANCED',
    cssClass: 'degraded-advanced',
  },
}

// ─── Confidence 視覺映射 ───

export interface ConfidenceVisual {
  borderStyle: 'solid' | 'dashed' | 'none'
  borderColour: string | null
  opacity: number
  tooltipKey: string | null
}

export const CONFIDENCE_VISUALS: Record<ConfidenceLevel, ConfidenceVisual> = {
  high: {
    borderStyle: 'none',
    borderColour: null,
    opacity: 1,
    tooltipKey: null,
  },
  user_confirmed: {
    borderStyle: 'none',
    borderColour: null,
    opacity: 1,
    tooltipKey: null,
  },
  warning: {
    borderStyle: 'solid',
    borderColour: '#FFC107',
    opacity: 1,
    tooltipKey: 'CONFIDENCE_WARNING',
  },
  inferred: {
    borderStyle: 'dashed',
    borderColour: '#90CAF9',
    opacity: 0.85,
    tooltipKey: 'CONFIDENCE_INFERRED',
  },
  llm_suggested: {
    borderStyle: 'dashed',
    borderColour: '#CE93D8',
    opacity: 0.85,
    tooltipKey: 'CONFIDENCE_INFERRED',
  },
  raw_code: {
    borderStyle: 'none',
    borderColour: null,
    opacity: 1,
    tooltipKey: null,
  },
}
