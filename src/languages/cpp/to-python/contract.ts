/**
 * **C++ 元件寫成 Python 的契約**（spec 219，research R7）——每顆元件在自己的膠囊裡寫 `to-python.ts`，匯出 `registerToPython`。
 * 引擎（`../cpp-to-python.ts`）依身分查表；表外的身分記成「子集以外」。
 */
import type { SemanticNode } from '../../../core/types'
import type { KeepKind } from '../../../core/language-conversion'

export interface ToPythonContext {
  /** 一顆運算式節點寫成 Python 運算式文字（表外的身分會記保留、回傳佔位） */
  expr(n: SemanticNode | undefined): string
  /** 一串敘述寫成 Python 的行（每行已含縮排）；空的本體寫成 `pass` */
  block(nodes: readonly SemanticNode[] | undefined, depth: number): string[]
  /** 記一筆保留原因（整支程式因此不換），回傳一個佔位文字讓呼叫端照常往下走 */
  keep(n: SemanticNode, kind: KeepKind, detail: string): string
  /** Cella 給的運算式型別（換目標之前那支程式的；拿不到是 undefined） */
  typeOf(n: SemanticNode | undefined): string | undefined
  /** 縮排 */
  indent(depth: number): string
  /** 正在寫 `main` 的本體嗎（攤平到頂層：`return 0` 不寫、其他 return 保留） */
  readonly inMain: boolean
  /** 把 `main` 的本體寫在頂層（depth 0），期間 `inMain` 為真 */
  blockAsMain(nodes: readonly SemanticNode[] | undefined): string[]
  /** 這顆函式是骨架宣告的進入點嗎（問骨架宣告，不寫死 `main`——第八十六條之二） */
  isEntryFunction(name: string): boolean
  /** C++ 的名字在 Python 裡的寫法：撞到 Python 的保留字（`from`、`in`、`is`…）就加底線（364：河內塔的參數叫 from，換出來的程式不合法） */
  name(s: string): string
  /** 這個名字是程式自己定義的函式嗎（標準函式庫的呼叫第一版不換） */
  isUserFunction(name: string): boolean
  /** 這顆節點產生 bool 嗎（元件自己宣告的，`r.yieldsBool`）——印的時候 C++ 印 0／1、Python 印 True／False */
  yieldsBool(n: SemanticNode | undefined): boolean
  /** 程式需要引入某個 Python 模組（`math`）——引擎在檔頭補上 `import …`，回傳模組名 */
  useImport(module: string): string
  /** 程式需要「跨行讀一個詞」的小工具（同 cin 的讀法）——引擎在檔頭補上 */
  useTokenReader(): string
  /** 程式需要 C++ 的取餘數（向零截斷）：回傳補在開頭的小函式名——兩邊有運算式時用它，才不會算兩次 */
  useTruncMod(): string
  /** 宣告 string 的那顆元件記下名字（身分留在膠囊裡，引擎不必認得它） */
  noteDeclaredString(name: string): void
  /** 這個名字在前面宣告成 string 嗎 */
  isDeclaredString(name: string): boolean
}

/** 加括號的判準兩個方向共用（住在核心）——膠囊照舊從這裡拿 */
export { paren } from '../../../core/language-conversion'

/** 這個值是 C++ 的 char 嗎（Cella 的型別表；`const char`、`char &` 也算）——Python 用長度 1 的字串表示它（364） */
export function isChar(t: string | undefined): boolean {
  return (t ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '').trim() === 'char'
}

/** 放進整數變數的值：C++ 會把浮點隱含截斷成整數、Python 不會 ⟹ 值是浮點時包 int()（向零截斷，同 C++；364） */
export function intValue(target: string | undefined, valueType: string | undefined, e: string): string {
  const t = (target ?? '').replace(/^const\s+/, '').trim()
  const v = (valueType ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '').trim()
  return /^(int|long|long long|short)$/.test(t) && /^(double|float|long double)$/.test(v) ? `int(${e})` : e
}

/** Python 字串字面量（JSON 的雙引號跳脫在 Python 裡同樣成立） */
export const pyStr = (s: string): string => JSON.stringify(s)

export type ExprFn = (n: SemanticNode, py: ToPythonContext) => string
export type StmtFn = (n: SemanticNode, py: ToPythonContext, depth: number) => string[]

/**
 * 膠囊登記**自己**的印法——不寫自己的身分（收集器依膠囊所在的目錄對回 component.json 的身分；就近性護欄：身分不多擴散一個檔）
 */
export interface ToPythonRegistrar {
  expr(fn: ExprFn): void
  stmt(fn: StmtFn): void
  /** 這顆元件產生 bool（比較、邏輯）——不靠 Cella 的型別表（它對 C++ 的比較回報 int，見 research R8） */
  yieldsBool(): void
}

export type RegisterToPython = (r: ToPythonRegistrar) => void

/**
 * 32 位元以內的有號整數——浮點的商與 `math.fmod` 在 2^53 以內精確，所以 `int(a / b)`、`int(math.fmod(a, b))` 與 C++ 逐位相同。
 * ⚠️ `long`（LP64 是 64 位元）與 `long long` 不算：值可以超過 2^53（spec 224：除法原本也收 long long，9007199254740993 / 1 換出來會錯）
 */
export function isNarrowInt(t: string | undefined): boolean {
  return /^(?:int|short|signed|signed int|short int)$/.test(t ?? '')
}

/**
 * C++ 的取餘數照它自己的定義寫成 Python（[expr.mul]p4：`a == (a / b) * b + a % b`，商向零截斷）：`a - int(a / b) * b`。
 * ⚠️ 兩邊各出現兩次——有副作用的運算式（呼叫、`i++`）會被算兩次、意思就變了 ⟹ 只收變數與字面量，其餘回 null（呼叫端保留）。
 * （`math.fmod` 更短，而 Cella 的 Python 家族還不支援它——判決證明不了的寫法不用。2026-11-09 已請 cella 補）
 */
export function truncatedRemainder(l: SemanticNode | undefined, r: SemanticNode | undefined, py: ToPythonContext): string | null {
  const simple = (x: SemanticNode | undefined): boolean => !!x && Object.values(x.slots ?? {}).every((k) => k.length === 0)
    && (typeof x.properties?.name === 'string' || typeof x.properties?.value === 'string')
  if (!simple(l) || !simple(r)) return null
  const a = py.expr(l), b = py.expr(r)
  return `${a} - int(${a} / ${b}) * ${b}`
}


/**
 * 一個容器型別（Cella 的型別字串，例如 `std::priority_queue<int, std::vector<int>, std::greater<int>>`）在 Python 用哪一種寫（448）：
 * stack → list（尾端進出）、queue → collections.deque（前端出）、priority_queue → heapq 的 list（max 版本存負數）。
 * 元素只收「放進去就不會被改」的純量（數字、字元、字串）；priority_queue 只收整數（存負數要精確，浮點的 -0.0／NaN 會亂序）。對不上 → undefined
 */
export type AdapterKind = 'stack' | 'queue' | 'minheap' | 'maxheap'
export function adapterKind(t: string | undefined): AdapterKind | undefined {
  const s = (t ?? '').replace(/^const\s+/, '').replace(/\s*[&*]$/, '').replace(/std::/g, '').replace(/\s+/g, ' ').trim()
  const scalar = '(?:int|long|long long|short|double|char|string|bool)'
  const integer = '(?:int|long|long long|short)'
  if (new RegExp(`^stack ?< ?${scalar} ?>$`).test(s)) return 'stack'
  if (new RegExp(`^queue ?< ?${scalar} ?>$`).test(s)) return 'queue'
  if (new RegExp(`^priority_queue ?< ?${integer} ?>$`).test(s)) return 'maxheap'
  if (new RegExp(`^priority_queue ?< ?${integer} ?, ?vector ?< ?${integer} ?> ?, ?less ?< ?${integer} ?> ?>$`).test(s)) return 'maxheap'
  if (new RegExp(`^priority_queue ?< ?(${integer}) ?, ?vector ?< ?\\1 ?> ?, ?greater ?< ?\\1 ?> ?>$`).test(s)) return 'minheap'
  return undefined
}

/**
 * 一段 Python 運算式文字是不是「原子」（名字、屬性、下標、單層呼叫、非負數字）——不是就加括號（448）。
 * 用在一元負號與 `**` 的旁邊：`-` 接在 `-3` 前面寫成 `--3`、`**` 比一元負號綁得緊（`-2 ** 2` 是 -4）
 */
const ATOM = /^(?:[A-Za-z_][\w.]*(?:\[[^\]]*\]|\([^()]*\))*|\d+(?:\.\d+)?)$/
export const atom = (e: string): string => ATOM.test(e) ? e : `(${e})`
