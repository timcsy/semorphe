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
import { dictKeys, dictKeyOf } from './dict'
// 🔴 「冒號後面那一段」只有一份——格式化文字與 `.format(...)` 共用。
import { applyFormatSpec } from './format-spec'
// 🔴 「兩個值誰大」只有一份——比較運算子、串接比較、排序共用（見那個模組的檔頭）。
import { compareForSort as compare } from './compare'

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
  /**
   * ⚠️ **與 `str` 的差別只有一個**：字串會帶引號（`repr("a")` ＝ `'a'`）。
   * 而那正是 `pythonDisplay` 的「在容器裡」那個旗標——**同一份規則，兩個入口**。
   * （2026-08-23 補：模糊測試的隔離出題者用了它，而它不在表裡。）
   */
  repr: (a) => str(pyStr(a[0], true)),
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
    // 🔴 **給了位數就是小數**（2026-08-23 修）：`round(10.0, 2)` 真的 Python 印
    //    `10.0`，而回整數型別會印成 `10`——**型別看得見地錯**。
    //    ⚠️ 沒給位數時回的才是整數（那是 Python 自己的規則）。
    if (a.length > 1) return dbl(Number(x.toFixed(c.toNumber(a[1]))))
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
    // ⚠️ `seqKind` 讓 `print(set(xs))` 印出 `{1, 2}` 而不是 `[1, 2]`
    return { ...arr(out), seqKind: 'set' as const }
  },
  // `range` 在迴圈裡由迴圈自己處理；當成值用時給一個串列
  range: (a, c) => {
    const n = a.map((x) => c.toNumber(x))
    const [s, e, st] = n.length === 1 ? [0, n[0], 1] : n.length === 2 ? [n[0], n[1], 1] : n
    const out: RuntimeValue[] = []
    for (let v = s; (st ?? 1) > 0 ? v < e : v > e; v += st ?? 1) out.push(num(v))
    return arr(out)
  },
  /**
   * 🔴 **第二個引數是起始的序號**（`enumerate(xs, 1)`／`enumerate(xs, start=1)`）
   * ——列印編號時最常見的寫法。忽略它的症狀是**每一個編號都少一**：
   * 不報錯、有輸出，而學生看到的清單從 0 開始。
   */
  enumerate: (a) => {
    const startArg = kwArg(a, 'start') ?? positional(a)[1]
    const start = startArg === undefined ? 0 : Number(startArg.value)
    return arr(asList(positional(a)[0]).map((x, i) => tup([num(start + i), x])))
  },
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
  /**
   * ⚠️ **可以吃好幾串**（2026-08-23 補）：`map(f, "abcd", [1,2,3])` 一格一格配對，
   * **停在最短的那一串**。原本只讀 `a[1]`，於是第二個參數永遠是 `None`
   * ——不報錯、有輸出、而每一格都錯。
   */
  map: async (a, c) => {
    const lists = a.slice(1).map((x) => asList(x))
    const n = lists.length === 0 ? 0 : Math.min(...lists.map((l) => l.length))
    const out: RuntimeValue[] = []
    for (let i = 0; i < n; i++) out.push(await c.call(a[0], lists.map((l) => l[i])))
    return arr(out)
  },
  /**
   * ⚠️ **第一個引數是 `None` 時＝「留下為真的」**（2026-08-23 補）：
   * `filter(None, xs)` 是 Python 的慣用寫法，而原本它會走到「這個東西叫不動」。
   */
  filter: async (a, c) => {
    const pred = a[0]
    const isNone = !pred || pred.type === 'void' || pred.value === null
    const out: RuntimeValue[] = []
    for (const x of asList(a[1])) {
      if (isNone ? truthy(x) : truthy(await c.call(pred, [x]))) out.push(x)
    }
    return arr(out)
  },
  /**
   * 🔴 **`bool` 要排在 `int` 之前判**——Python 的 `True` **是**一個整數
   * （`isinstance(True, int)` 是 `True`），而學生寫的 `elif isinstance(x, bool)`
   * 期待它與整數分得開。這裡照實回答，順序由使用者的 `if` 鏈決定。
   *
   * ⚠️ 認不得的型別名**丟錯**，不要回 `False`：`False` 與「這個型別我不認得」
   * 在畫面上長得一模一樣。
   */
  isinstance: (a) => {
    const v = a[0]
    // ⚠️ **第二個引數是一個名字，而 `int`／`str` 這些名字求值出來是【函式值】**
    //    （Python 的型別本身可以呼叫）——所以這裡讀的是它指到的名字。
    const t = a[1]
    const want = t?.type === 'function' && t.value && typeof t.value === 'object' && 'name' in t.value
      ? String((t.value as { name: string }).name)
      : String(t?.value ?? '')
    const is = (t: string): boolean => {
      switch (t) {
        case 'int': return v?.type === 'int' || v?.type === 'bool' || v?.type === 'char'
        case 'float': return v?.type === 'double' || v?.type === 'float'
        case 'str': return v?.type === 'string'
        case 'bool': return v?.type === 'bool'
        case 'list': case 'tuple': return v?.type === 'array'
        case 'dict': return v?.type === 'object'
        default: return false
      }
    }
    // 使用者自己的類別：第二個引數是一個**類別名**，而實例帶著它
    if (!['int', 'float', 'str', 'bool', 'list', 'tuple', 'dict'].includes(want)) {
      if (v?.type === 'object' && v.structName) return bool(v.structName === want)
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `isinstance：不認得型別 ${want}` })
    }
    return bool(is(want))
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
  /**
   * 🔴 **位置那個引數本來被整個忽略**（2026-08-23 修）：`xs.pop(0)` 拿走的是
   * **最後一格**，不是第一格——不報錯、有回值、而**答案是錯的**。
   *
   * ⚠️ 它活到今天的理由是「沒有一段語料寫 `xs.pop(0)`」：那個寫法在
   * 通用桶裡（掉進一般呼叫），而通用桶只被數過數量，沒有被對過答案。
   *
   * > **一個掉進通用桶的呼叫仍然會被執行——而那份執行沒有人在對答案。**
   */
  pop: (s, a, c) => {
    // 🔴 **字典也有 `.pop`**，而它按鍵拿走（可帶預設值）——2026-08-23 由模糊測試抓到：
    //    只當串列處理的話會炸在 `xs.splice is not a function`（一個 JS 的錯誤訊息，
    //    而使用者寫的是 Python）。
    if (s.type === 'object') {
      const fields = s.value as ObjectFields
      const key = dictKeyOf(a[0])
      const got = fields.get(key)
      if (got !== undefined) { fields.delete(key); s.keyValues?.delete(key); return got }
      if (a.length > 1) return a[1]
      throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': String(a[0]?.value ?? '') })
    }
    const xs = s.value as RuntimeValue[]
    if (a.length === 0) return xs.pop() ?? { type: 'void', value: null }
    const raw = c.toNumber(a[0])
    const i = raw < 0 ? xs.length + raw : raw   // `xs.pop(-1)` ＝ 最後一格
    if (!Number.isInteger(i) || i < 0 || i >= xs.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(raw) })
    }
    return xs.splice(i, 1)[0]
  },
  // ⚠️ `key=` 是一個**關鍵字引數**，而它帶著一個可呼叫的東西。
  //    這裡只認得「有沒有給」——怎麼呼叫它由呼叫端接（見 `sortWith`）。
  // 就地排序——`key=` 見 `sortWith`
  sort: async (s, a, c) => {
    const sorted = await sortWith(s.value as RuntimeValue[], a, c)
    ;(s.value as RuntimeValue[]).splice(0, sorted.length, ...sorted)
    return { type: 'void', value: null }
  },
  reverse: (s) => { (s.value as RuntimeValue[]).reverse(); return { type: 'void', value: null } },
  /**
   * **集合的加入**（2026-08-23 補）——⚠️ 已經有的不再加一次。
   *
   * 🔴 **串列上要出聲**：Python 的串列沒有 `.add`，而使用者要的是 `.append`
   * ——那句話直接寫在錯誤訊息裡，因為它就是修法。
   */
  add: (s, a) => {
    const xs = s.value as RuntimeValue[]
    if (s.seqKind !== 'set') {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': '串列沒有 add——加到末端請用 append' })
    }
    const k = pyStr(a[0])
    if (!xs.some((x) => pyStr(x) === k)) xs.push(a[0])
    return { type: 'void', value: null }
  },
  /** 集合的移除——⚠️ **沒有那個值也不出錯**（那正是它與 `remove` 的差別）。 */
  discard: (s, a) => {
    const xs = s.value as RuntimeValue[]
    const k = pyStr(a[0])
    const i = xs.findIndex((x) => pyStr(x) === k)
    if (i >= 0) xs.splice(i, 1)
    return { type: 'void', value: null }
  },
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
  /** 前面補零到指定長度——`str(7).zfill(3)` 是 `"007"`。 */
  /**
   * 🔴 **符號留在最前面**（2026-08-23 修）：`"-7".zfill(5)` 真的 Python 給 `-0007`，
   * 而直接 `padStart` 給的是 `000-7`——**不報錯、有輸出、而看得見地錯**。
   * ⚠️ 這一條是模糊測試的隔離出題者寫出來的：既有語料**沒有一段補零帶負號**。
   */
  zfill: (s, a, c) => {
    const raw = String(s.value)
    const width = c.toNumber(a[0])
    const sign = raw.startsWith('-') || raw.startsWith('+') ? raw[0] : ''
    const body = sign ? raw.slice(1) : raw
    if (raw.length >= width) return str(raw)
    return str(sign + body.padStart(width - sign.length, '0'))
  },
  /** ⚠️ 補的字元可以指定，**預設是空白**——與 `zfill` 不同。 */
  ljust: (s, a, c) => str(String(s.value).padEnd(c.toNumber(a[0]), a[1] ? String(a[1].value) : ' ')),
  rjust: (s, a, c) => str(String(s.value).padStart(c.toNumber(a[0]), a[1] ? String(a[1].value) : ' ')),
  isalpha: (s) => bool(/^[A-Za-z]+$/.test(String(s.value))),
  title: (s) => str(String(s.value).replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())),
  keys: (s) => arr(dictKeys(s)),
  values: (s) => arr([...(s.value as ObjectFields).values()]),
  items: (s) => arr([...(s.value as ObjectFields).values()].map((v, i) => tup([dictKeys(s)[i], v]))),
  get: (s, a) => (s.value as ObjectFields).get(String(a[0].value)) ?? a[1] ?? { type: 'void', value: null },
  /**
   * ⚠️ **取不到就【放進去】再回傳**——與 `get` 的差別在它會改那張表。
   * `groups.setdefault(k, []).append(x)` 是分組的慣用寫法（2026-08-23 補）。
   * 🔴 **鍵原本長什麼樣要一起記**（見 `dict.ts` 的檔頭），否則 `{1: …}` 會印成 `{'1': …}`。
   */
  setdefault: (s, a) => {
    const fields = s.value as ObjectFields
    const key = dictKeyOf(a[0])
    const got = fields.get(key)
    if (got !== undefined) return got
    const fallback = a[1] ?? { type: 'void' as const, value: null }
    fields.set(key, fallback)
    if (s.keyValues) s.keyValues.set(key, a[0])
    return fallback
  },
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

/**
 * **一個模組被綁在一個名字上**——`import math` 綁 `math`，`import math as m` 綁 `m`。
 *
 * 🔴 記的是**指向哪個模組**，不是模組的成員：「`math.sqrt` 該查誰」的順序
 * 只有一份（上面那兩張表），而別名只是換一個入口。抄一份成員進來的話，
 * 表長出新東西時別名那條路會安靜地停在舊的。
 *
 * ⚠️ 型別借用 `object` 而不開新的 `RuntimeType`——理由與 tuple 那條相同
 * （見 `types.ts`）：開新型別會讓幾十處 `type === 'object'` 的判斷一處一處失效。
 */
const MODULE_MARK = '__module__'

export function moduleRefValue(target: string): RuntimeValue {
  return { type: 'object', value: new Map([[MODULE_MARK, { type: 'string', value: target }]]) as ObjectFields }
}

/**
 * 「這個名字是不是一個模組，是的話是哪一個」——`math` → `math`，`m` → `math`，
 * 一個普通變數 → `null`。
 *
 * ⚠️ **沒被 import 過的名字也回它自己**：這維持了加入別名之前的行為
 * （模組成員用整個名字當鍵查表，查不到自然會出聲）。
 */
export function moduleNameOf(name: string, scope: { has(n: string): boolean; get(n: string): RuntimeValue | undefined }): string | null {
  if (!name) return null
  if (!scope.has(name)) return name
  const v = scope.get(name)
  if (v?.type === 'object' && v.value instanceof Map) {
    const t = (v.value as ObjectFields).get(MODULE_MARK)
    if (t) return String(t.value)
  }
  return null
}
