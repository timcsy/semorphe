import type { SemanticNode } from '../core/types'

/** 執行期型別 */
export type RuntimeType = 'int' | 'float' | 'double' | 'char' | 'string' | 'bool' | 'void' | 'array' | 'pointer' | 'object' | 'function' | 'function'

/**
 * 一個結構／類別的實例：欄位名 → 值。
 *
 * 用 `Map` 而不是普通物件，因為欄位名可能與 `Object.prototype` 的成員撞名
 * （`toString`、`constructor`…）——那種撞名會讓「讀一個不存在的欄位」
 * **靜默成功**，而這正是本專案有專門教訓的那種靜默降級。
 */
export type ObjectFields = Map<string, RuntimeValue>

/**
 * 一個可以晚點再呼叫的東西（lambda）。
 *
 * `closure` 是**定義時**的作用域——少了它，捕捉來的變數在呼叫時已經不在了。
 * 這是 lambda 與一般函式唯一的結構差別：函式在全域表裡查，lambda 帶著它
 * 出生的環境走。
 */
export interface Callable {
  params: { name: string; type: string }[]
  body: SemanticNode[]
  /** `&` 參照捕捉（看得到之後的改動）／`=` 值捕捉（定義當下的快照） */
  capture: '&' | '=' | ''
  closure: unknown
  /** `=` 捕捉時的快照。`&` 時是 undefined */
  snapshot?: Map<string, RuntimeValue>
}

/** 執行期值 */
export interface RuntimeValue {
  type: RuntimeType
  value: number | string | boolean | null | RuntimeValue[] | ObjectFields | Callable
  /** `type === 'object'` 時，它是哪一個結構／類別 */
  structName?: string
  tag?: string
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
  nodeId: string
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
  if (val.type === 'object') {
    // 直接印一個物件在 C++ 不合法（要多載 operator<<）。**出聲，不要靜默印空字串**
    return `⟨${val.structName ?? 'object'}⟩`
  }

  if (val.type === 'void') return 'void'
  if (val.type === 'bool') return val.value ? 'true' : 'false'
  if (val.type === 'array') {
    // C 字串（字元陣列）印出來應該是字串，不是 `[array]`。
    //
    // `char s[8]; strcpy(s, "hi"); cout << s;` 原本印 `[array]`——那讓五個
    // cstring 函式**看起來**是壞的，其實壞的是這裡。逐字元讀到結尾的 \0。
    const arr = val.value as RuntimeValue[] | undefined
    if (Array.isArray(arr) && arr.every((c) => c?.type === 'char')) {
      const out: string[] = []
      for (const c of arr) {
        const s = String(c.value ?? '')
        if (s === '' || s === '\0') break
        out.push(s)
      }
      return out.join('')
    }
    return '[array]'
  }
  return String(val.value ?? '')
}
