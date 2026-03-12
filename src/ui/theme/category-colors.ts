import type { DegradationCause, ConfidenceLevel } from '../../core/types'

// ─── 集中的類別顏色映射 ───

export const CATEGORY_COLORS: Record<string, string> = {
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
}

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
