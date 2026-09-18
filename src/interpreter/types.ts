import type { SemanticNode } from '../core/types'
import { aggregateShapeOf } from '../core/component/aggregate-nodes'
import { resolveAlias } from './aliases'
/**
 * 🔴 **這四個名字住在 `core/execution.ts`**（2026-09-13 搬的）——
 * 因為講它們的是匯流排與視圖，而直譯器只是它們的**第一個實作**。
 * 搬之前 `core/` 有四個檔反過來 import 這裡，兩個目錄互相依賴。
 * 這裡原樣再匯出，執行期那一側的 import 因此一行都不用改。
 */
export type { ExecutionStatus, ExecutionSpeed, RuntimeType, StepInfo } from '../core/execution'
import type { RuntimeType } from '../core/execution'
import { toSignificant } from './decimal'


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
  /**
   * ⚠️ `'set'` 加入日 2026-08-22：集合的執行期就是**去重的串列**
   * （`in`／`len`／走訪全都照舊），差別只在**印出來是 `{1, 2}`**。
   * 這正是這個欄位存在的理由——一個只在顯示上不同的東西。
   */
  seqKind?: 'tuple' | 'set'
  /**
   * 字典的**鍵原本長什麼樣**（底層的 `Map` 只吃字串）。
   *
   * ```python
   * print({1: 1})     # 真 Python：{1: 1}   少了這張表：{'1': 1}
   * ```
   *
   * ⚠️ 與 `seqKind` 同一個理由：**只影響「看得到的樣子」**，
   * 查詢／寫入／`in` 仍然走字串鍵，所以每一處既有的判斷都不必改。
   */
  keyValues?: Map<string, RuntimeValue>
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
  /**
   * **這個位置是在容器的第幾次刪除【之後】取得的。**
   *
   * 🔴 為什麼需要它（2026-09-18，盲測三支同時指著同一件事）：
   *
   * ```cpp
   * while (it != g.end()) { if (…) { g.erase(it++); } else ++it; }
   * ```
   *
   * `it++` 先把位置往後挪一格，**然後**那一格被抽掉——底下的格子整串左移，
   * 於是手上那個 offset 指到的變成**再下一個**。症狀不是當掉，是
   * **數字偏小**（`pruned=1` 而 g++ 說 2）。
   *
   * > **一個「刪一格」的動作改的不只是容器，還有【別人手上那份位置】
   * > ——而沒有人通知得到他們。**
   *
   * 🟢 通知不到，就讓他們**自己回頭問**：容器記下每一次刪除的位置，
   * 而位置記下自己是在第幾次之後拿到的；讀 offset 時把中間那幾次補算回來。
   *
   * ⚠️ **未設 ＝ 不修正**（而不是「第 0 次」）：沒有蓋章的位置維持原本的行為，
   * 所以漏蓋一處的後果是「那一處沒修好」，不是「那一處被算歪」。
   */
  era?: number
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
  /**
   * **對照表的【值】是什麼型別**（`map<int, vector<int>>` 的 `vector<int>`）。
   *
   * 🔴 `m[k]` 在鍵不存在時會**自動建一格**（C++ 的 `operator[]` 就是這樣），
   * 而在此之前那一格一律補 `int 0`——於是相鄰串列的標準寫法
   * `map<int, vector<int>> g; g[a].push_back(b);` 在第一次存取時
   * 拿到一個數字，而 `push_back` 說「這不是一個容器」。
   *
   * > **一個「沒給就補 0」的預設值，在值不是數字的時候補的是一個錯的形狀**
   * > ——同族的 `elemType` 記過一模一樣的一句。
   */
  valueType?: string
  /**
   * 這個容器**留不留重複的值**——`set` 不留，`multiset` 留。
   *
   * ⚠️ 與 `heapOrder` 同一個理由，而那一條的教訓逐字適用：**比較規則寫在宣告上，
   * 而讀它的 `insert()` 只拿得到變數名**——所以那個資訊必須跟著**值**走。
   *
   * 🔴 而它還有第二個作用：**未設 = 這不是集合那一族**。
   * `insert` 這個方法名今天只有一個主人，所以 `v.insert(...)` 也會走到那裡；
   * 沒有這個欄位時它必須出聲，不得安靜地去重加排序
   * （那正是 2026-09-17 之前 `multiset` 少一半元素的原因）。
   */
  allowsDuplicates?: boolean
  /**
   * 這個容器的條目是**鍵值對**（`map`／`unordered_map`），不是一串值。
   *
   * 🔴 **為什麼需要它**：對應表與集合在執行期**長得一模一樣**
   * （都是 `{ type: 'array' }`），今天唯一分得出來的方式是「翻開條目看它是不是
   * 一對」——而那個判準在 `multiset<pair<int,int>>` 上**會答錯**（語料真的這樣寫）。
   *
   * > **兩種容器如果只能靠「裡面裝什麼」分辨，那麼裝了同一種東西的那天
   * > 就分不出來了——而那一天不會有人通知你。**
   *
   * ⚠️ 空容器上那個判準更是完全失效：兩者都是 `[]`。
   */
  keyed?: boolean
  /**
   * 這個位置是**反向的**（`rbegin()`／`rend()`）——往前走才是「下一個」。
   *
   * 🔴 **為什麼是一個旗標而不是另一種值**：反向位置與正向位置**每一個動作都一樣**
   * （解參考、比較、相減），只有「往哪邊移」相反。開一種新的值，
   * 那五個動作要各自再認它一次。
   *
   * ⚠️ 而少了這個旗標的代價是**靜默的**：`++rit` 會往後走，於是一個從大到小的
   * 走訪安靜地變成從小到大——程式跑完、印出東西、順序是反的。
   */
  reverse?: boolean
  /**
   * 一段文字被當成**可以走訪的東西**時，它的字元格子。
   *
   * 🔴 **為什麼要存起來**：`t.begin()` 與 `t.end()` 必須拿到**同一份**格子，
   * 否則比較那一條會說「兩個位置不在同一個容器裡」——而那個迴圈一次都不跑。
   * 每次呼叫現做一份的話，兩次做出來的是兩個不同的陣列。
   *
   * ⚠️ **延遲產生**：絕大多數文字不會被走訪，而每一個字串都先攤成格子太貴。
   * ⚠️ 而它是**唯讀的投影**：透過那些位置寫回去改不到這段文字本身
   *    ——所以寫入那一路必須出聲（見 `cpp:pointer_assign`）。
   */
  charCells?: RuntimeValue[]
  /** 這個位置指著一段文字的字元投影——**寫不回去**。 */
  readonlyCells?: boolean
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


/**
 * **這次執行從外面拿到的東西**——按發生順序。
 *
 * ## 為什麼需要它
 *
 * `concepts/模擬的誠實.md:23`：「**一個每次讀到不同值的模擬器，測不出任何東西。**」
 *
 * 🔴 2026-08-26 讓使用者在暫停時**手填執行期變數**，而那個值直接落進 `scope`
 * ——**同一支程式跑兩次會得到不同答案**。它與 `analogRead` 抖動的差別
 * 只在「要有人按按鈕才會發生」，而那不是一個原則上的差別。
 *
 * ## ⚠️ 記的是「不可重現的那些」，不是全部輸入
 *
 * ```
 * 🔴 要記   awaitInput()           人現在打的字
 * 🔴 要記   setVariableFromHost    人現在改的狀態
 * 🔴 要記   暫停時的決定            繼續還是停止
 * ✅ 不記   io.read()              跑之前就排好的佇列——【它本身就是一份紀錄】
 * ```
 *
 * ⚠️ **順序就是語義**：同一組值換個順序餵進去是另一次執行。
 */
export type ExecutionInput =
  | { kind: 'stdin'; value: string }
  | { kind: 'set-variable'; name: string; value: string }
  | { kind: 'pause-decision'; decision: 'continue' | 'stop' }

/** 建立預設 RuntimeValue */
export function defaultValue(rawType: string): RuntimeValue {
  /**
   * 🔴 **型別也可能是一個小名**（`#define pii pair<int,int>`，2026-09-16）。
   *
   * 在此之前 `pii A[200007];` 的每一格都是 `int 0`，於是 `A[i].first`
   * 拋「不是一個結構」。實測 218 支學生程式裡 11 支撞在這裡
   * （`#define pii` 出現在 6 支，而它的下游更廣）。
   */
  const type = resolveAlias(rawType)
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
      /**
       * 🔴 **有聚合形狀的樣板型別，預設值是那個形狀的物件**（2026-09-16）。
       *
       * `pair<int,int> A[10];` 在此之前每一格都是**空陣列**，於是
       * `A[0].first = 3` 拋「（不是一個結構）」。而 lift 是對的
       * （`array_declare` ＋ `type: pair<int,int>` ＋ `size`）——
       * 壞的是這一行把「帶尖括號」一律當成容器。
       *
       * ⚠️ 判準是**有沒有登記過聚合形狀**，不是型別名叫什麼
       *    ——`vector<int>` 沒登記，照舊是空容器。
       *
       * > **「帶尖括號」說的是它是一個樣板，不是它是一個容器。**
       */
      {
        const shape = aggregateShapeOf(type)
        if (shape) {
          const fields = new Map<string, RuntimeValue>()
          for (const f of shape) fields.set(f, { type: 'int', value: 0 })
          const bare = type.includes('<') ? type.slice(0, type.indexOf('<')) : type
          return { type: 'object', value: fields, structName: bare }
        }
      }
      if (type.includes('<')) return { type: 'array', value: [] }
      // **指標型別的預設值是空指標**，不是 0。
      //
      // 🔴 `struct Node { Node* next; };` 的成員 `next` 原本連型別名裡的
      // 星號都沒有（星號在**身分**裡——`cpp:pointer_declare`——不在
      // `properties.type` 裡），於是 `instantiate` 以為結構包含自己，
      // 丟出「**結構 Node 直接或間接包含自己——那在 C++ 不合法（要用指標）**」。
      //
      // > **一則叫你去做你已經做了的事的診斷，比沒有診斷更糟
      // > ——它讓人去改一段本來就對的程式碼。**
      //
      // ⚠️ 判準是「型別名以星號結尾」，與上面那條「帶尖括號」同一個層次：
      // 看**寫法**，不看特定語言的型別名（中立性護欄在看）。
      if (type.endsWith('*')) return { type: 'pointer' as RuntimeValue['type'], value: null }
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

/**
 * C++ `cout` 的預設浮點格式：六位有效數字，去尾零。
 *
 * ## 🔴 科學記號那一半錯了兩個地方（2026-09-18 修）
 *
 * `toPrecision(6)` 給的科學記號**不是 C++ 的寫法**，而舊碼「直接沿用」：
 *
 * ```
 *                    g++            我們（舊）
 * 1e9                1e+09          1.00000e+9
 * 123456789.0        1.23457e+08    1.23457e+8
 * 0.000012345        1.2345e-05     1.2345e-5
 * ```
 *
 * 兩個差別：
 *
 * ```
 * ① 尾數要去尾零     1.00000 → 1     （小數那一半早就在做，科學記號那一半沒有）
 * ② 指數補成兩位     e+9 → e+09      （C++ 的最小寬度是 2）
 * ```
 *
 * ⚠️ 而它的母體**不是一支語料**——是**每一支印大數或小數的程式**。
 * 語料量到的那一支（`AP325/7/7_5_TLE.cpp`）只是第一個被看見的。
 *
 * > **一個「直接沿用」的註解，說的是「我沒有比對過」。**
 */
function formatDefaultPrecision(n: number): string {
  /**
   * 🔴 **規則整段搬到 `decimal.ts`**（2026-09-18 第四次修）。
   *
   * 那一支是「十進位的四捨五入，收尾照 C 的規矩」——**逢五取偶**，
   * 而 JS 的 `toFixed`／`toPrecision` 是逢五進位：
   *
   * ```
   *              g++      JS
   * 2.5  → 0 位   2        3
   * 0.25 → 1 位   0.2      0.3
   * 3.5  → 0 位   4        4      ← 這一格兩邊一樣，而那正是它難被發現的原因
   * ```
   *
   * ⚠️ 兩者**只在精確的平手上不同**，而一半的測資會讓那個差別隱形。
   *
   * 🟢 而它搬到那裡還有第二個理由：**`setprecision(n)` 要的是同一條規則，位數是參數**。
   *    留在這裡的話那邊得抄一份，而**兩份會漂移**。
   */
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n) && Math.abs(n) < 1e6) return String(n)
  return toSignificant(n, 6)
}


