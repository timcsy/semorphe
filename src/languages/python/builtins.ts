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
// 「印出來長什麼樣」只有一份——`print` 與格式化文字用的是同一個。
import { pythonDisplay as pyStr } from './value-display'

/** 求值用的最小介面——內建函式只需要「把值變成數字」這一件事。 */
export interface builtinCtx {
  toNumber(v: RuntimeValue): number
}

const num = (v: number): RuntimeValue => ({ type: Number.isInteger(v) ? 'int' : 'double', value: v })
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
export const PYTHON_BUILTIN_FUNCTIONS: Record<string, (args: RuntimeValue[], ctx: builtinCtx) => RuntimeValue> = {
  len: (a) => num(lengthOf(a[0])),
  str: (a) => str(pyStr(a[0])),
  int: (a, c) => num(Math.trunc(c.toNumber(a[0]))),
  float: (a, c) => ({ type: 'double', value: c.toNumber(a[0]) }),
  bool: (a, c) => bool(a[0]?.type === 'string' ? String(a[0].value).length > 0 : c.toNumber(a[0]) !== 0),
  abs: (a, c) => num(Math.abs(c.toNumber(a[0]))),
  round: (a, c) => num(a.length > 1 ? Number(c.toNumber(a[0]).toFixed(c.toNumber(a[1]))) : Math.round(c.toNumber(a[0]))),
  // ⚠️ `max`／`min`／`sum` 吃**一個序列**或**多個引數**，兩種都要。
  max: (a, c) => (a.length === 1 ? asList(a[0]) : a).reduce((m, x) => (c.toNumber(x) > c.toNumber(m) ? x : m)),
  min: (a, c) => (a.length === 1 ? asList(a[0]) : a).reduce((m, x) => (c.toNumber(x) < c.toNumber(m) ? x : m)),
  sum: (a, c) => num(asList(a[0]).reduce((t, x) => t + c.toNumber(x), 0)),
  sorted: (a, c) => arr([...asList(a[0])].sort((x, y) => c.toNumber(x) - c.toNumber(y))),
  reversed: (a) => arr([...asList(a[0])].reverse()),
  list: (a) => arr(a.length > 0 ? [...asList(a[0])] : []),
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
export const PYTHON_BUILTIN_METHODS: Record<string, (self: RuntimeValue, args: RuntimeValue[], ctx: builtinCtx) => RuntimeValue> = {
  // 串列（就地改動）
  append: (s, a) => { (s.value as RuntimeValue[]).push(a[0]); return { type: 'void', value: null } },
  pop: (s) => (s.value as RuntimeValue[]).pop() ?? { type: 'void', value: null },
  sort: (s, _a, c) => { (s.value as RuntimeValue[]).sort((x, y) => c.toNumber(x) - c.toNumber(y)); return { type: 'void', value: null } },
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
  // 共用
  count: (s, a, c) => num(asList(s).filter((x) => c.toNumber(x) === c.toNumber(a[0])).length),
  index: (s, a) => num(asList(s).findIndex((x) => pyStr(x) === pyStr(a[0]))),
}
