/** 執行期錯誤，包含 i18n key 和插值參數 */
export class RuntimeError extends Error {
  readonly i18nKey: string
  readonly params: Record<string, string>
  readonly nodeId: string | null

  constructor(i18nKey: string, params: Record<string, string> = {}, nodeId: string | null = null) {
    const fallback = i18nKey + (Object.keys(params).length > 0 ? ': ' + JSON.stringify(params) : '')
    super(fallback)
    this.name = 'RuntimeError'
    this.i18nKey = i18nKey
    this.params = params
    this.nodeId = nodeId
  }
}

/** i18n key 常數 */
export const RUNTIME_ERRORS = {
  UNDECLARED_VAR: 'RUNTIME_ERR_UNDECLARED_VAR',
  DIVISION_BY_ZERO: 'RUNTIME_ERR_DIVISION_BY_ZERO',
  MAX_STEPS_EXCEEDED: 'RUNTIME_ERR_MAX_STEPS',
  TYPE_MISMATCH: 'RUNTIME_ERR_TYPE_MISMATCH',
  INDEX_OUT_OF_RANGE: 'RUNTIME_ERR_INDEX_OUT_OF_RANGE',
  UNDEFINED_FUNCTION: 'RUNTIME_ERR_UNDEFINED_FUNC',
  BREAK_OUTSIDE_LOOP: 'RUNTIME_ERR_BREAK_OUTSIDE_LOOP',
  CONTINUE_OUTSIDE_LOOP: 'RUNTIME_ERR_CONTINUE_OUTSIDE_LOOP',
  DUPLICATE_DECLARATION: 'RUNTIME_ERR_DUPLICATE_DECLARATION',
  ABORTED: 'RUNTIME_ERR_ABORTED',
  UNKNOWN_CONCEPT: 'RUNTIME_ERR_UNKNOWN_CONCEPT',
} as const
