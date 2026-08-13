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
  /**
   * `type === 'array'` 當作**指標**用時，指向第幾格。
   *
   * `int* p = &arr[2]` 讓 `p` 與 `arr` **共用同一個 `value` 陣列**（所以寫得回去），
   * 而 `*p` 要讀第 2 格。⚠️ 不能用 `slice` 代替——那是複製，寫回去不會反映。
   *
   * 未設 = 0。⚠️ 這個直譯器有**兩種**指標：符號式（`&x`，value 是變數名字串，
   * 走 `pointerTargets`）與實體式（`new`／`malloc`／陣列退化，value 是格子）。
   * 這個欄位只屬於後者。
   */
  offset?: number
  tag?: string
  /**
   * 優先佇列的**堆序**：`greater<T>` 宣告的是小根堆，預設是大根堆。
   *
   * ⚠️ 沒有這個欄位的話，`priority_queue<int, vector<int>, greater<int>>`
   * 的 `top()` 回傳最大值——**程式跑完、印出一個數字、而它是錯的**。
   * 而比較器寫在宣告上，讀它的 `top()`／`pop()` 只拿得到變數名
   * ——所以那個資訊必須跟著**值**走，不是跟著呼叫端走。
   */
  heapOrder?: 'min' | 'max'
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
    default:
      // **樣板型別的預設值是空容器**，不是 0。
      //
      // 🔴 `class C { vector<int> data; };` 的成員 `data` 原本被建成 `int 0`，
      // 於是 `data.push_back(x)` 丟 `TYPE_MISMATCH: array`——**而那是在
      // 建構之後才炸的，訊息指向 push 而不是宣告**。
      //
      // ⚠️ 判準是「型別名帶尖括號」，不是「型別名叫 vector」——後者會讓
      // 核心認得一個特定語言的容器名（中立性護欄在看）。任何語言的樣板容器
      // 都吃這條。
      if (type.includes('<')) return { type: 'array', value: [] }
      return { type: 'int', value: 0 }
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

  // C++ 的 `cout << (x > 2)` 印出 **1／0**，不是 `true`／`false`
  // ——後者要 `std::boolalpha`。印錯的話每一個印布林的程式輸出都不對，
  // 而它看起來像「只是格式不同」。
  if (val.type === 'bool') return val.value ? '1' : '0'

  // 字元要印成**字元**，不是碼值。`char g = 'B'; cout << g;` 印 `B`。
  // 值可能以數字碼存放（陣列初始化列表、轉型的結果），統一還原。
  if (val.type === 'char') {
    if (typeof val.value === 'number') return String.fromCharCode(val.value)
    return String(val.value)
  }
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

  // C++ 的 `cout` 預設是**六位有效數字**並去掉尾零：
  //   1.0/3  →  0.333333   （不是 0.3333333333333333）
  //   1.0    →  1          （不是 1.000000）
  // JS 的 `String(number)` 給的是完整精度，於是每一個印浮點的程式輸出都不同，
  // 而它看起來像「只是多印了幾位」。
  if ((val.type === 'double' || val.type === 'float') && typeof val.value === 'number') {
    return formatDefaultPrecision(val.value)
  }

  return String(val.value ?? '')
}

/** C++ `cout` 的預設浮點格式：六位有效數字，去尾零。 */
function formatDefaultPrecision(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n) && Math.abs(n) < 1e6) return String(n)
  const s = n.toPrecision(6)
  // toPrecision 可能給科學記號；C++ 在這個量級也會用科學記號，直接沿用
  if (s.includes('e')) return s
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}
