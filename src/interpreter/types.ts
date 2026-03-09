import type { SemanticNode } from '../core/types'

/** 執行期型別 */
export type RuntimeType = 'int' | 'float' | 'double' | 'char' | 'string' | 'bool' | 'void' | 'array' | 'pointer'

/** 執行期值 */
export interface RuntimeValue {
  type: RuntimeType
  value: number | string | boolean | null | RuntimeValue[]
}

/** 函式定義 */
export interface FunctionDef {
  name: string
  params: { type: string; name: string }[]
  returnType: string
  body: SemanticNode[]
}

/** 呼叫框架 */
export interface CallFrame {
  functionName: string
  returnValue: RuntimeValue | null
}

/** 執行狀態 */
export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

/** 執行速度 */
export type ExecutionSpeed = 'slow' | 'medium' | 'fast'

/** 步進回呼資訊 */
export interface StepInfo {
  node: SemanticNode
  blockId: string | null
  sourceRange: { start: number; end: number } | null
  outputLength: number
  scopeSnapshot: { name: string; type: string; value: string }[]
}

/** 建立預設 RuntimeValue */
export function defaultValue(type: string): RuntimeValue {
  switch (type) {
    case 'int': return { type: 'int', value: 0 }
    case 'float': return { type: 'float', value: 0.0 }
    case 'double': return { type: 'double', value: 0.0 }
    case 'char': return { type: 'char', value: '' }
    case 'string': return { type: 'string', value: '' }
    case 'bool': return { type: 'bool', value: false }
    case 'void': return { type: 'void', value: null }
    default: return { type: 'int', value: 0 }
  }
}

/** 將字串轉為指定型別的 RuntimeValue */
export function parseInputValue(input: string, targetType: string): RuntimeValue | null {
  switch (targetType) {
    case 'int': {
      const n = parseInt(input, 10)
      return isNaN(n) ? null : { type: 'int', value: n }
    }
    case 'float':
    case 'double': {
      const f = parseFloat(input)
      return isNaN(f) ? null : { type: targetType as RuntimeType, value: f }
    }
    case 'char':
      return { type: 'char', value: input.charAt(0) || '' }
    case 'string':
      return { type: 'string', value: input }
    case 'bool':
      return { type: 'bool', value: input === 'true' || input === '1' }
    default:
      return { type: 'string', value: input }
  }
}

/** RuntimeValue 轉字串顯示 */
export function valueToString(val: RuntimeValue): string {
  if (val.type === 'void') return 'void'
  if (val.type === 'bool') return val.value ? 'true' : 'false'
  if (val.type === 'array') return '[array]'
  return String(val.value ?? '')
}
