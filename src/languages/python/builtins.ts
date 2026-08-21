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
// 🔴 「鍵原本長什麼樣」只有一份——見那個模組的檔頭。
import { dictKeys } from './dict'
// 🔴 「冒號後面那一段」只有一份——格式化文字與 `.format(...)` 共用。
import { applyFormatSpec } from './format-spec'

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
 * 🔴 **它是必要的，不是可選的**（2026-08-22 改）。曾經是可選，於是十一個
 * 元件的執行器把**裸的 `ctx`** 遞進來——`max(d, key=…)` 當場丟
 * 「這裡叫不動函式」，而使用者寫的是完全正確的 Python。
 *
 * > **一個可選的欄位，會讓「忘了給」與「刻意不給」長得一模一樣
 * > ——而型別檢查對前者本來是有話要說的。**
 */
export interface builtinCtx {
  toNumber(v: RuntimeValue): number
  call: (fn: RuntimeValue, args: RuntimeValue[]) => Promise<RuntimeValue>
}

/** 從引數裡撈出一個關鍵字引數（`param_named` 把它包成 `['__kw__名字', 值]`）。 */
export function kwArg(args: RuntimeValue[], name: string): RuntimeValue | null {
  for (const a of args) {
    if (a?.type !== 'array') continue
    const pair = a.value as RuntimeValue[]
    if (pair.length === 2 && String(pair[0]?.value) === `__kw__${name}`) return pair[1]
  }
  return null
}
const keyArg = (args: RuntimeValue[]): RuntimeValue | null => kwArg(args, 'key')

/**
 * 照 `key=` 排序——**拿不到就丟錯，不要靜靜用預設比較**。
 */
async function sortWith(items: RuntimeValue[], args: RuntimeValue[], c: builtinCtx): Promise<RuntimeValue[]> {
  // 🔴 `reverse=True` 與 `key=` 是**兩個各自獨立**的關鍵字引數，
  //    而它們常一起出現（`sorted(xs, key=len, reverse=True)`）。
  //    漏掉 `reverse` 的症狀是**順序剛好相反**——有輸出、不報錯。
  const rev = kwArg(args, 'reverse')
  const dir = rev && rev.value === true ? -1 : 1
  const key = keyArg(args)
  if (!key) return [...items].sort((x, y) => dir * compare(x, y))
  // 🟢 **先算好每一格的鍵，再排**——比較器必須同步，而求值是非同步的。
  const keyed: { k: RuntimeValue; v: RuntimeValue }[] = []
  for (const v of items) keyed.push({ k: await c.call(key, [v]), v })
  return keyed.sort((x, y) => dir * compare(x.k, y.k)).map((x) => x.v)
}

/**
 * 兩個值誰大——**排序與 `max`／`min` 共用這一份**。
 *
 * 🔴 **字串比字典序**：`max("a", "b")` 是 `"b"`，而 `toNumber` 對字串給 `NaN`
 * ——`NaN > NaN` 恆假，於是它**永遠回傳第一個**。看起來像有答案，而那是巧合。
 */
function compare(x: RuntimeValue, y: RuntimeValue): number {
  if (x?.type === 'string' && y?.type === 'string') {
    const a = String(x.value), b = String(y.value)
    return a < b ? -1 : a > b ? 1 : 0
  }
  return NaN2Zero(x) - NaN2Zero(y)
}
function NaN2Zero(v: RuntimeValue): number {
  const n = numberOf(v)
  return Number.isNaN(n) ? 0 : n
}
/** ⚠️ 這裡不能用 `c.toNumber`——比較器必須同步，而它拿不到 ctx。 */
function numberOf(v: RuntimeValue): number {
  if (v?.type === 'bool') return v.value ? 1 : 0
  return Number(v?.value)
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
/**
 * 一格 tuple。`enumerate`／`zip`／`d.items()` 產的是**這個**，不是串列
 * ——差別只在印出來（`(0, 9)` 對 `[0, 9]`），而使用者一眼看得到。
 */
const tup = (v: RuntimeValue[]): RuntimeValue => ({ type: 'array', value: v, seqKind: 'tuple' })

/**
 * 只留位置引數。
 *
 * 🔴 **`max(d, key=f)` 的 `key=` 也在 `args` 裡**（包成 `['__kw__key', 值]`），
 * 而 `max` 用 `a.length === 1` 判斷「吃序列還是吃多個引數」
 * ——於是它把那個關鍵字包裹**當成一個要比大小的候選人**，
 * 比出 NaN，回傳第一個（也就是那個字典本身）。
 *
 * > **一個關鍵字引數混在位置引數裡，會讓「有幾個引數」這個問題的答案是錯的。**
 */
export function positional(a: RuntimeValue[]): RuntimeValue[] {
  return a.filter((x) => {
    if (x?.type !== 'array') return true
    const pair = x.value as RuntimeValue[]
    return !(pair.length === 2 && String(pair[0]?.value ?? '').startsWith('__kw__'))
  })
}

/**
 * `max`／`min`——**含 `key=`**。
 *
 * ⚠️ `max(d, key=lambda k: d[k])` 走的是**鍵**（`asList` 對字典給鍵），
 * 而回傳的是**原本那一格**，不是算出來的鍵值。
 */
async function extreme(a: RuntimeValue[], c: builtinCtx, sign: 1 | -1): Promise<RuntimeValue> {
  const pos = positional(a)
  const items = pos.length === 1 ? asList(pos[0]) : pos
  if (items.length === 0) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': 'max()／min() 拿到空的序列' })
  const key = keyArg(a)
  let best = items[0]
  let bestK = key ? await c.call(key, [best]) : best
  for (const x of items.slice(1)) {
    const k = key ? await c.call(key, [x]) : x
    if (sign * compare(k, bestK) > 0) { best = x; bestK = k }
  }
  return best
}
const bool = (v: boolean): RuntimeValue => ({ type: 'bool', value: v })


/**
 * 一個值的真假——**Python 的規則**（容器看空不空，不是轉成數字）。
 *
 * 🔴 與 `bool()` 是同一份：兩份的話 `any([])` 與 `bool([])` 會先後錯。
 */
function truthy(v: RuntimeValue): boolean {
  if (v === undefined || v.type === 'void' || v.value === null) return false
  if (v.type === 'bool') return v.value === true
  if (v.type === 'string') return String(v.value).length > 0
  if (v.type === 'array') return (v.value as RuntimeValue[]).length > 0
  if (v.type === 'object') return (v.value as ObjectFields).size > 0
  return Number(v.value) !== 0
}

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
  : v.type === 'object' ? dictKeys(v)
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
  bool: (a) => bool(truthy(a[0])),
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
  max: (a, c) => extreme(a, c, 1),
  min: (a, c) => extreme(a, c, -1),
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
  enumerate: (a) => arr(asList(a[0]).map((x, i) => tup([num(i), x]))),
  // ⚠️ `divmod` 回的是 **tuple**（`(3, 2)`），不是串列
  divmod: (a, c) => {
    const x = c.toNumber(a[0]), y = c.toNumber(a[1])
    if (y === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO, {})
    return tup([num(Math.floor(x / y)), num(x - Math.floor(x / y) * y)])
  },
  /**
   * 🔴 `map`／`filter` 在 Python 3 回的是**惰性的**，而這裡回串列。
   * ⚠️ 那是一個**已知的簡化**：教學語料裡它們幾乎一律被 `list(...)` 或
   * 迴圈立刻吃掉，而**惰性看得見的地方**（無限序列、副作用的順序）
   * 不在初學課裡。寫在這裡是為了讓它是已知的，不是沒有人記得的巧合。
   */
  // ⚠️ **一格一格【依序】呼叫，不可以 `Promise.all`**：呼叫時會換掉直譯器的
  //    作用域再換回來，並行的話每一格會看到別格的參數
  //    ——症狀是 `map(lambda x: x*2, [1,2,3,4])` 給 `[8, 8, 8, 8]`（全部是最後一格）。
  map: async (a, c) => {
    const out: RuntimeValue[] = []
    for (const x of asList(a[1])) out.push(await c.call(a[0], [x]))
    return arr(out)
  },
  filter: async (a, c) => {
    const out: RuntimeValue[] = []
    for (const x of asList(a[1])) if (truthy(await c.call(a[0], [x]))) out.push(x)
    return arr(out)
  },
  any: (a) => bool(asList(a[0]).some(truthy)),
  all: (a) => bool(asList(a[0]).every(truthy)),
  chr: (a, c) => str(String.fromCharCode(c.toNumber(a[0]))),
  ord: (a) => num(String(a[0]?.value ?? '').charCodeAt(0)),
  pow: (a, c) => num(Math.pow(c.toNumber(a[0]), c.toNumber(a[1]))),
  zip: (a) => {
    const ls = a.map(asList)
    const n = Math.min(...ls.map((l) => l.length))
    return arr(Array.from({ length: n }, (_, i) => tup(ls.map((l) => l[i]))))
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
  /**
   * 🔴 **不帶引數的 `split()` 不只是「用空白切」**——它還會**丟掉頭尾的空段**：
   * `"  a b  ".split()` 是 `['a', 'b']`，而用 `/\s+/` 直接切會多出兩個空字串。
   * ⚠️ 而帶引數的**不會**丟：`"  a b  ".split(" ")` 有五格。**兩者不同。**
   */
  split: (s, a) => {
    const text = String(s.value)
    if (a.length === 0) return arr(text.split(/\s+/).filter((x) => x !== '').map(str))
    return arr(text.split(String(a[0].value)).map(str))
  },
  join: (s, a) => str(asList(a[0]).map((x) => pyStr(x)).join(String(s.value))),
  replace: (s, a) => str(String(s.value).split(String(a[0].value)).join(String(a[1].value))),
  startswith: (s, a) => bool(String(s.value).startsWith(String(a[0].value))),
  endswith: (s, a) => bool(String(s.value).endsWith(String(a[0].value))),
  // 字典
  // ── 串列的其他就地改動
  insert: (s, a, c) => {
    (s.value as RuntimeValue[]).splice(c.toNumber(a[0]), 0, a[1])
    return { type: 'void', value: null }
  },
  /** ⚠️ `remove` 拿掉的是**第一個相等的值**，不是某一格——與 `pop` 不同。 */
  remove: (s, a) => {
    const xs = s.value as RuntimeValue[]
    const i = xs.findIndex((x) => pyStr(x) === pyStr(a[0]))
    if (i < 0) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `remove：${pyStr(a[0])} 不在裡面` })
    xs.splice(i, 1)
    return { type: 'void', value: null }
  },
  extend: (s, a) => { (s.value as RuntimeValue[]).push(...asList(a[0])); return { type: 'void', value: null } },
  /** ⚠️ 字典與串列都有 `clear`——就地清空。 */
  clear: (s) => {
    if (s.type === 'object') (s.value as ObjectFields).clear()
    else (s.value as RuntimeValue[]).length = 0
    return { type: 'void', value: null }
  },
  /** 字典的合併——**就地改動接收者**。 */
  update: (s, a) => {
    const m = s.value as ObjectFields
    if (a[0]?.type === 'object') {
      const ks = dictKeys(a[0])
      let i = 0
      for (const [k, v] of a[0].value as ObjectFields) {
        m.set(k, v)
        // ⚠️ 合併進來的鍵**原本長什麼樣**也要跟著搬，否則它們印出來會多引號
        if (!s.keyValues) s.keyValues = new Map()
        s.keyValues.set(k, ks[i++])
      }
    }
    return { type: 'void', value: null }
  },
  // ── 字串的查詢
  /** 🔴 找不到回 **-1**，不是丟錯——那正是它與 `index` 的差別。 */
  find: (s, a) => num(String(s.value).indexOf(String(a[0]?.value ?? ''))),
  isdigit: (s) => bool(/^[0-9]+$/.test(String(s.value))),
  isalpha: (s) => bool(/^[A-Za-z]+$/.test(String(s.value))),
  title: (s) => str(String(s.value).replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())),
  keys: (s) => arr(dictKeys(s)),
  values: (s) => arr([...(s.value as ObjectFields).values()]),
  items: (s) => arr([...(s.value as ObjectFields).values()].map((v, i) => tup([dictKeys(s)[i], v]))),
  get: (s, a) => (s.value as ObjectFields).get(String(a[0].value)) ?? a[1] ?? { type: 'void', value: null },
  // 🔴 **`.format()` 與 `%` 是格式化文字之外的另外兩種寫法**——AI 生的
  //    Python 兩種都會出現，而它們與 f-string 是同一件事的三個語法。
  /**
   * 🔴 **三種佔位子都要**：`{}`（依序）、`{0}`（指定第幾個）、`{name}`（具名）。
   * 只認 `{}` 的症狀是後兩種**原樣印出來**——`"{0}{1}{0}".format("a","b")`
   * 印出 `{0}{1}{0}`：不報錯、有輸出，而那是使用者寫的模板本身。
   *
   * ⚠️ 冒號後面那一段走 `format-spec.ts`——與格式化文字**同一份**。
   */
  format: (s, a) => {
    const named = new Map<string, RuntimeValue>()
    const positional: RuntimeValue[] = []
    for (const x of a) {
      const kw = x?.type === 'array' ? (x.value as RuntimeValue[]) : null
      const tag = kw && kw.length === 2 ? String(kw[0]?.value ?? '') : ''
      if (tag.startsWith('__kw__')) named.set(tag.slice(6), kw![1])
      else positional.push(x)
    }
    let auto = 0
    return str(String(s.value).replace(/\{([^{}]*)\}/g, (_, inner: string) => {
      const [ref, spec] = inner.includes(':') ? [inner.slice(0, inner.indexOf(':')), inner.slice(inner.indexOf(':') + 1)] : [inner, '']
      const v = ref === '' ? positional[auto++]
        : /^\d+$/.test(ref) ? positional[Number(ref)]
        : named.get(ref)
      if (v === undefined) {
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `format：找不到 {${ref}}` })
      }
      return applyFormatSpec(v, spec)
    }))
  },
  // 共用
  /**
   * 🔴 **字串的 `count` 數的是【那一小段】出現幾次，不是逐格比對**
   * ——`"Hello123".count("l")` 是 2。而它原本用 `toNumber` 比，
   * 字母全部變成 0、目標也變成 0，於是**每一個字母都算命中**（給 5）。
   *
   * > **一個把兩邊都轉成同一個「轉不出來」的值再比較的判準，會全部命中。**
   */
  count: (s, a) => {
    const needle = pyStr(a[0])
    if (s.type === 'string') return num(String(s.value).split(needle).length - 1)
    return num(asList(s).filter((x) => pyStr(x) === needle).length)
  },
  /**
   * ⚠️ **找不到要丟錯**（Python 的 `index` 是 `ValueError`）——
   * 回 `-1` 的是 `find`，而那正是兩者的差別。
   */
  index: (s, a) => {
    const needle = pyStr(a[0])
    const i = s.type === 'string' ? String(s.value).indexOf(needle) : asList(s).findIndex((x) => pyStr(x) === needle)
    if (i < 0) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `${needle} is not in list` })
    return num(i)
  },
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
