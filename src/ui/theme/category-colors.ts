import type { DegradationCause, ConfidenceLevel } from '../../core/types'

// ─── 集中的類別顏色映射 ───

/**
 * ⚠️ **不要標成 `Record<string, string>`**——那讓**任何字串**都是合法的鍵，
 * 於是 `CATEGORY_COLORS.containers`（正確的鍵是 `cpp_containers`）
 * **tsc 一聲不吭**，而執行期是 `undefined` → `setColour(undefined)` 拋錯
 * → **整個 flyout 渲染到那一顆就中斷**。
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
  // C++ 專屬類別
  cpp_basic: '#59C059',
  cpp_io: '#5CB1D6',
  cpp_pointers: '#9966FF',
  cpp_structs: '#CF63CF',
  cpp_strings: '#0FBD8C',
  cpp_containers: '#4C97FF',
  cpp_algorithms: '#4C97FF',
  cpp_math: '#5C81A6',
  cpp_special: '#888888',
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
