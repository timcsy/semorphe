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

/**
 * **一個函式被當成值拿在手上**——只記名字，不記實作。
 *
 * ```python
 * sorted(words, key=len)     # ← 這個 len
 * ```
 *
 * ⚠️ 記名字而不是記實作，是因為**同一個名字在呼叫的當下該查誰**是有順序的
 * （使用者定義的蓋掉內建的），而那個順序只該有一份——住在呼叫的地方。
 */
export interface FuncRef {
  ref: 'user' | 'builtin'
  name: string
}

/** 執行期值 */
export interface RuntimeValue {
  type: RuntimeType
  /**
   * 🔴 **這一串是 tuple 不是串列**——只影響「印出來長什麼樣」。
   *
   * ```
   * print(list(enumerate([9])))   真 Python  [(0, 9)]   我們曾經  [[0, 9]]
   * ```
   *
   * ⚠️ 刻意**不開一個新的 `RuntimeType`**：不可變是語言層的約束，而這個直譯器
   * 還沒有那一層；每一處 `type === 'array'` 的判斷都仍然該對 tuple 成立。
   * 開新型別的話，那幾十處會**一處一處地**在 tuple 上安靜失效。
   *
   * > **一個只在顯示上不同的東西，不該用型別去表示它。**
   */
  seqKind?: 'tuple'
  value: number | string | boolean | null | RuntimeValue[] | ObjectFields | Callable | FuncRef
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
  /**
   * 容器的**元素型別**——`vector<pair<int,int>>` 的 `pair<int,int>`。
   *
   * ⚠️ 為什麼跟著值走：`v.push_back({2,1})` 的 `{2,1}` 要變成什麼，
   * **取決於容器裝的是什麼**，而那個資訊只在宣告那一行。執行 `push_back`
   * 時手上只有變數名——所以型別必須跟著容器的值一起帶。
   */
  elemType?: string
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
