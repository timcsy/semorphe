/**
 * Python 的**內建函式與方法**——語言套件的資料，核心不認識任何一個名字。
 *
 * ## 為什麼是一張表，而不是一顆一顆元件
 *
 * 兩件事要分開：
 *
 * | | 誰負責 | 為什麼 |
 * |---|---|---|
 * | **跑得動** | 這張表 | AI 生的 Python 會用到任何一個內建函式，而**一顆一顆做永遠追不上** |
 * | **有積木可拖** | 元件（膠囊） | 教學上要看得到、拖得動的那幾顆 |
 *
 * 🔴 **先做「跑得動」**：2026-08-21 的量測顯示 15 段語料有 12 段跑不動，
 * 而其中 6 段的原因就是這裡——`nums.append`／`str`／`s.upper`／`max`／`enumerate`。
 * 那 6 段在 lift 與來回轉換上**完全正確**，通用桶那一欄看起來只是個潔癖問題
 * ——配上執行那一軸才看得出它是六段程式跑不動的原因。
 *
 * ⚠️ 之後替其中幾顆做專屬元件時，**這張表不必拿掉**：lift 那一側優先走元件，
 * 而使用者手寫的、我們沒做元件的那些仍然跑得動。
 *
 * ## ⚠️ 認不得的名字**丟錯**
 *
 * 不在這張表也不是使用者定義的函式 → `UNDEFINED_FUNCTION`。
 * 靜默回 `None` 的話，`print(len(x))` 會印出空白而看不出哪裡錯。
 */
import type { RuntimeValue, ObjectFields } from '../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../interpreter/errors'
// 「印出來長什麼樣」只有一份——`print` 與格式化文字用的是同一個。
import { pythonDisplay as pyStr } from './value-display'

/**
 * 求值用的最小介面。
 *
 * 🔴 `call` 是**排序的 `key=`** 要的：`xs.sort(key=lambda x: x[1])`
 * 需要對每一格呼叫那個函式。**沒有它的症狀是 key 被靜靜忽略**
 * ——排序仍然發生、仍然有輸出，而**順序是錯的**（實測：該是「乙」而印出「甲」）。
 *
 * > **一個被忽略的參數不會讓程式停下來，它只會讓答案不一樣。**
 *
 * ⚠️ 它是**非同步**的（求值一個 lambda 的本體要走直譯器），
 * 而比較器必須同步——所以排序是「**先把每一格的鍵算好，再排**」。
 *
 * ⚠️ 它是可選的：不是每個呼叫端都拿得到直譯器。拿不到而使用者給了 `key=` 時
 * **要出聲**，不得靜靜用預設比較。
 */
export interface builtinCtx {
  toNumber(v: RuntimeValue): number
  call?: (fn: RuntimeValue, args: RuntimeValue[]) => Promise<RuntimeValue>
}

/** 從引數裡撈出 `key=`（`param_named` 把它包成 `['__kw__key', 值]`）。 */
function keyArg(args: RuntimeValue[]): RuntimeValue | null {
  for (const a of args) {
    if (a?.type !== 'array') continue
    const pair = a.value as RuntimeValue[]
    if (pair.length === 2 && String(pair[0]?.value) === '__kw__key') return pair[1]
  }
  return null
}

/**
 * 照 `key=` 排序——**拿不到就丟錯，不要靜靜用預設比較**。
 */
async function sortWith(items: RuntimeValue[], args: RuntimeValue[], c: builtinCtx): Promise<RuntimeValue[]> {
  const key = keyArg(args)
  if (!key) return [...items].sort((x, y) => c.toNumber(x) - c.toNumber(y))
  if (!c.call) {
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': 'key=（這裡叫不動函式）' })
  }
  // 🟢 **先算好每一格的鍵，再排**——比較器必須同步，而求值是非同步的。
  const keyed: { k: number; v: RuntimeValue }[] = []
  for (const v of items) keyed.push({ k: c.toNumber(await c.call(key, [v])), v })
  return keyed.sort((x, y) => x.k - y.k).map((x) => x.v)
}

const num = (v: number): RuntimeValue => ({ type: Number.isInteger(v) ? 'int' : 'double', value: v })
/**
 * 一定是小數的結果。
 *
 * 🔴 `math.sqrt(16)` 在 Python 是 **`4.0`** 不是 `4`——`math` 的函式回 float，
 * 而 `Number.isInteger(4)` 為真會讓它掉回整數。
 * **不報錯、看起來只是少一個 `.0`**，而它是型別錯了。參照直譯器抓到的。
 */
const dbl = (v: number): RuntimeValue => ({ type: 'double', value: v })
const str = (v: string): RuntimeValue => ({ type: 'string', value: v })
const arr = (v: RuntimeValue[]): RuntimeValue => ({ type: 'array', value: v })
const bool = (v: boolean): RuntimeValue => ({ type: 'bool', value: v })


/** 一個容器有幾格（`len` 與別處共用）。 */
function lengthOf(v: RuntimeValue): number {
  if (v.type === 'string') return String(v.value).length
  if (v.type === 'array') return (v.value as RuntimeValue[]).length
  if (v.type === 'object') return (v.value as ObjectFields).size
  return 0
}

const asList = (v: RuntimeValue): RuntimeValue[] =>
  v.type === 'array' ? (v.value as RuntimeValue[])
  : v.type === 'string' ? [...String(v.value)].map(str)
  : v.type === 'object' ? [...(v.value as ObjectFields).keys()].map(str)
  : []

/** 自由函式：`len(x)`、`max(xs)`… */
export const PYTHON_BUILTIN_FUNCTIONS: Record<string, (args: RuntimeValue[], ctx: builtinCtx) => RuntimeValue | Promise<RuntimeValue>> = {
  len: (a) => num(lengthOf(a[0])),
  str: (a) => str(pyStr(a[0])),
  int: (a, c) => num(Math.trunc(c.toNumber(a[0]))),
  float: (a, c) => ({ type: 'double', value: c.toNumber(a[0]) }),
  /**
   * 🔴 **容器的真假看「空不空」**，不是轉成數字。
   * `bool([1,2,3])` 用 `toNumber` 會得到 NaN → `NaN !== 0` 是 true…
   * 而 `bool([0])` 也是 true——**兩個都碰巧對，而 `bool([])` 錯**。
   * > **一個碰巧對的判準，會在邊界上安靜地翻面。**
   */
  bool: (a, c) => {
    const v = a[0]
    if (v === undefined || v.type === 'void') return bool(false)
    if (v.type === 'string') return bool(String(v.value).length > 0)
    if (v.type === 'array') return bool((v.value as RuntimeValue[]).length > 0)
    if (v.type === 'object') return bool((v.value as ObjectFields).size > 0)
    return bool(c.toNumber(v) !== 0)
  },
  abs: (a, c) => num(Math.abs(c.toNumber(a[0]))),
  /**
   * 🔴 **Python 的 `round` 是「銀行家捨入」**：`round(2.5)` 是 **2** 不是 3
   * ——遇到剛好一半時往**偶數**靠。`Math.round` 一律往上，於是每一個
   * 「.5」都會多一。參照直譯器抓到的。
   */
  round: (a, c) => {
    const x = c.toNumber(a[0])
    if (a.length > 1) return num(Number(x.toFixed(c.toNumber(a[1]))))
    const f = Math.floor(x)
    if (x - f !== 0.5) return num(Math.round(x))
    return num(f % 2 === 0 ? f : f + 1)
  },
  // ⚠️ `max`／`min`／`sum` 吃**一個序列**或**多個引數**，兩種都要。
  max: (a, c) => (a.length === 1 ? asList(a[0]) : a).reduce((m, x) => (c.toNumber(x) > c.toNumber(m) ? x : m)),
  min: (a, c) => (a.length === 1 ? asList(a[0]) : a).reduce((m, x) => (c.toNumber(x) < c.toNumber(m) ? x : m)),
  sum: (a, c) => num(asList(a[0]).reduce((t, x) => t + c.toNumber(x), 0)),
  sorted: async (a, c) => arr(await sortWith(asList(a[0]), a.slice(1), c)),
  reversed: (a) => arr([...asList(a[0])].reverse()),
  list: (a) => arr(a.length > 0 ? [...asList(a[0])] : []),
  // ⚠️ **集合用陣列表示，只是去重**——這個直譯器沒有集合型別。
  //    🔴 那是一個**已知的簡化**：`len(set(xs))`（數不重複的有幾個）是教學語料裡
  //    最常見的用途，而它是對的；集合運算（`|`／`&`）還沒有。
  set: (a) => {
    const seen = new Set<string>()
    const out: RuntimeValue[] = []
    for (const x of a.length > 0 ? asList(a[0]) : []) {
      const k = pyStr(x)
      if (!seen.has(k)) { seen.add(k); out.push(x) }
    }
    return arr(out)
  },
  // `range` 在迴圈裡由迴圈自己處理；當成值用時給一個串列
  range: (a, c) => {
    const n = a.map((x) => c.toNumber(x))
    const [s, e, st] = n.length === 1 ? [0, n[0], 1] : n.length === 2 ? [n[0], n[1], 1] : n
    const out: RuntimeValue[] = []
    for (let v = s; (st ?? 1) > 0 ? v < e : v > e; v += st ?? 1) out.push(num(v))
    return arr(out)
  },
  enumerate: (a) => arr(asList(a[0]).map((x, i) => arr([num(i), x]))),
  zip: (a) => {
    const ls = a.map(asList)
    const n = Math.min(...ls.map((l) => l.length))
    return arr(Array.from({ length: n }, (_, i) => arr(ls.map((l) => l[i]))))
  },
}

/**
 * 方法：`nums.append(9)`、`s.upper()`…
 *
 * 🔴 **接收者是第一個引數，而有些方法會【改動】它**（`append`／`sort`）。
 * 那是 Python 的語義：串列是可變的。回傳值與改動是兩件事。
 */
export const PYTHON_BUILTIN_METHODS: Record<string, (self: RuntimeValue, args: RuntimeValue[], ctx: builtinCtx) => RuntimeValue | Promise<RuntimeValue>> = {
  // 串列（就地改動）
  append: (s, a) => { (s.value as RuntimeValue[]).push(a[0]); return { type: 'void', value: null } },
  pop: (s) => (s.value as RuntimeValue[]).pop() ?? { type: 'void', value: null },
  // ⚠️ `key=` 是一個**關鍵字引數**，而它帶著一個可呼叫的東西。
  //    這裡只認得「有沒有給」——怎麼呼叫它由呼叫端接（見 `sortWith`）。
  // 就地排序——`key=` 見 `sortWith`
  sort: async (s, a, c) => {
    const sorted = await sortWith(s.value as RuntimeValue[], a, c)
    ;(s.value as RuntimeValue[]).splice(0, sorted.length, ...sorted)
    return { type: 'void', value: null }
  },
  reverse: (s) => { (s.value as RuntimeValue[]).reverse(); return { type: 'void', value: null } },
  // 文字
  upper: (s) => str(String(s.value).toUpperCase()),
  lower: (s) => str(String(s.value).toLowerCase()),
  strip: (s) => str(String(s.value).trim()),
  split: (s, a) => arr(String(s.value).split(a.length > 0 ? String(a[0].value) : /\s+/).map(str)),
  join: (s, a) => str(asList(a[0]).map((x) => pyStr(x)).join(String(s.value))),
  replace: (s, a) => str(String(s.value).split(String(a[0].value)).join(String(a[1].value))),
  startswith: (s, a) => bool(String(s.value).startsWith(String(a[0].value))),
  endswith: (s, a) => bool(String(s.value).endsWith(String(a[0].value))),
  // 字典
  keys: (s) => arr([...(s.value as ObjectFields).keys()].map(str)),
  values: (s) => arr([...(s.value as ObjectFields).values()]),
  items: (s) => arr([...(s.value as ObjectFields).entries()].map(([k, v]) => arr([str(k), v]))),
  get: (s, a) => (s.value as ObjectFields).get(String(a[0].value)) ?? a[1] ?? { type: 'void', value: null },
  // 🔴 **`.format()` 與 `%` 是格式化文字之外的另外兩種寫法**——AI 生的
  //    Python 兩種都會出現，而它們與 f-string 是同一件事的三個語法。
  format: (s, a) => {
    let i = 0
    return str(String(s.value).replace(/\{\}/g, () => pyStr(a[i++] ?? { type: 'void', value: null })))
  },
  // 共用
  count: (s, a, c) => num(asList(s).filter((x) => c.toNumber(x) === c.toNumber(a[0])).length),
  index: (s, a) => num(asList(s).findIndex((x) => pyStr(x) === pyStr(a[0]))),
}

/**
 * 模組成員——**這個直譯器沒有模組系統**，而 `math.pi` 在教學語料裡到處都是。
 *
 * ⚠️ 只有**取值**在這裡；`math.sqrt(16)` 這種呼叫走方法那條路。
 * 🔴 認不得的成員由取成員那顆元件**丟錯**，不回 None。
 */
/**
 * 直譯器一開始就有的名字。
 *
 * 🔴 **`__name__` 是 `"__main__"`**——`if __name__ == "__main__":` 是 AI 生的
 * Python **幾乎必有**的一行，而少了這個名字整段會說「沒有這個變數」。
 * ⚠️ 我們沒有模組系統，所以它永遠是主程式——那與「直接跑這個檔」一致。
 */
export const PYTHON_GLOBALS: Record<string, { type: RuntimeValue['type']; value: string }> = {
  __name__: { type: 'string', value: '__main__' },
}

export const PYTHON_MODULE_MEMBERS: Record<string, Record<string, RuntimeValue>> = {
  math: {
    pi: { type: 'double', value: Math.PI },
    e: { type: 'double', value: Math.E },
    tau: { type: 'double', value: Math.PI * 2 },
    inf: { type: 'double', value: Infinity },
  },
}

/** 模組的方法：`math.sqrt(16)`、`random.randint(1, 6)`。 */
export const PYTHON_MODULE_METHODS: Record<string, (args: RuntimeValue[], ctx: builtinCtx) => RuntimeValue> = {
  'math.sqrt': (a, c) => dbl(Math.sqrt(c.toNumber(a[0]))),
  'math.floor': (a, c) => num(Math.floor(c.toNumber(a[0]))),
  'math.ceil': (a, c) => num(Math.ceil(c.toNumber(a[0]))),
  'math.pow': (a, c) => dbl(c.toNumber(a[0]) ** c.toNumber(a[1])),
  'math.fabs': (a, c) => dbl(Math.abs(c.toNumber(a[0]))),
  // 🔴 **亂數在教學工具裡要可重現**：每次跑出不同答案的話，
  //    「我的程式對不對」這個問題就沒有辦法用輸出回答。
  //    用一個固定種子的線性同餘產生器，而**這件事寫在這裡**不是靜靜地做。
  'random.randint': (a, c) => {
    const lo = c.toNumber(a[0]), hi = c.toNumber(a[1])
    seed = (seed * 1103515245 + 12345) % 2147483648
    return num(lo + (seed % (hi - lo + 1)))
  },
  'random.random': () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return { type: 'double', value: seed / 2147483648 }
  },
}

let seed = 42
