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
  /** 宣告容器的那顆元件記下名字的元素型別（450：map 的值型別——\`m[k] = 2.7\` 放進整數的 map 要截斷，而 Cella 不給那一句型別） */
  noteElementType(name: string, type: string): void
  /** 這個名字宣告時的元素型別；同一個名字宣告過兩種（不同函式裡的同名區域變數）就不知道——undefined */
  elementTypeOf(name: string): string | undefined
  /**
   * 一顆節點寫成**指定的目標**（`=`、`+=`、`++`、`cin >>` 的左邊；450）。`readsFirst`：先讀再改（`+=`、`++`）。
   * 回傳的 `before` 是要先跑的一句（不含縮排）——map 的元素先讀再改，C++ 會先補上預設值、Python 的 dict 會丟 KeyError。
   * 膠囊沒登記目標寫法的，照運算式寫
   */
  target(n: SemanticNode | undefined, readsFirst: boolean): { before?: string; text: string }
  /** 這個名字是頂層宣告的全域變數嗎（451：函式裡重新指定它，Python 要先寫 `global`） */
  isGlobal(name: string): boolean
  /** 這顆節點宣告了它會寫的子節點（`r.writes`）——沒宣告的回空 */
  writtenBy(n: SemanticNode): readonly SemanticNode[]
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

/**
 * C++ 字面量的寫法（語義樹存的是原始碼的寫法，含跳脫序列）→ 它的值（453：`'\n'` 原本被跳脫兩次，Python 印出字面的 `\n`）。
 * 拿不準的（`\x`／八進位 ≥ 0x80 是位元組、Python 的 str 是碼點；`\u` 一類）回 undefined，呼叫端照實保留。
 */
export function cEscapedValue(src: string): string | undefined {
  const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '?': '?', a: '\x07', b: '\b', f: '\f', v: '\v' }
  let bad = false
  const out = src.replace(/\\(x[0-9a-fA-F]+|[0-7]{1,3}|.)/g, (_m, e: string) => {
    const code = e[0] === 'x' ? parseInt(e.slice(1), 16) : /^[0-7]+$/.test(e) ? parseInt(e, 8) : undefined
    if (code !== undefined) { if (code >= 0x80) bad = true; return String.fromCharCode(code) }
    if (e in map) return map[e]
    bad = true
    return e
  })
  return bad ? undefined : out
}

export type ExprFn = (n: SemanticNode, py: ToPythonContext) => string
export type StmtFn = (n: SemanticNode, py: ToPythonContext, depth: number) => string[]
export type TargetFn = (n: SemanticNode, py: ToPythonContext, readsFirst: boolean) => { before?: string; text: string }

/**
 * 膠囊登記**自己**的印法——不寫自己的身分（收集器依膠囊所在的目錄對回 component.json 的身分；就近性護欄：身分不多擴散一個檔）
 */
export interface ToPythonRegistrar {
  expr(fn: ExprFn): void
  stmt(fn: StmtFn): void
  /** 這顆元件當指定目標時的寫法（450：map 的元素、pair 的成員）——沒登記的照運算式寫 */
  target(fn: TargetFn): void
  /** 這顆元件產生 bool（比較、邏輯）——不靠 Cella 的型別表（它對 C++ 的比較回報 int，見 research R8） */
  yieldsBool(): void
  /**
   * 這顆元件定義一個型別別名（453：`#define ll long long`）——回 `{ name, type }`，不是別名就回 undefined。
   * 引擎換之前先把每一顆節點的型別文字展開（`ll` → `long long`），於是讀型別的膠囊（整數截斷、起始值）照原本的判準走
   */
  typeAlias(fn: TypeAliasFn): void
  /** 這顆元件會寫哪幾個子節點（453：`cin >> a` 的 values 是寫、`cout << a` 的 values 是讀——形狀一樣，只有元件自己知道） */
  writes(fn: (n: SemanticNode) => readonly SemanticNode[]): void
}

export type TypeAliasFn = (n: SemanticNode) => { name: string; type: string } | undefined

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
  if (!isSimple(l) || !isSimple(r)) return null
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

/**
 * 一個有序的關聯容器（Cella 的型別字串）在 Python 用哪一種寫（450）：`map<K, V>` → dict、`set<K>` → set，走訪時包 `sorted(…)`
 * （C++ 照鍵由小到大走；Python 的 dict 照放進去的順序、set 沒有順序）。
 * - 鍵只收整數與字串：std::string 的比較是 unsigned char 逐位元組＝UTF-8 的碼位順序，與 Python 的字串比較相同；
 *   char 有正負號（大於 127 的字元兩邊順序不同）、浮點有 NaN（sorted 會亂序）——都不收。
 * - 值只收放進去就不會被改的純量（數字、字串）；bool 不收（C++ 印 0／1、Python 印 True／False，而讀 map 的那顆不知道自己是 bool）。
 * - unordered_*、multi* 不收（走訪順序與重複鍵兩邊不同）。對不上 → undefined
 */
export type KeyedKind = { kind: 'map'; key: string; value: string } | { kind: 'set'; key: string }
const KEY = '(int|long|long long|short|string)'
const MAP_VALUE = '(int|long|long long|short|double|string)'
const bare = (t: string | undefined): string =>
  (t ?? '').replace(/^const\s+/, '').replace(/\s*[&*]$/, '').replace(/std::/g, '').replace(/\s+/g, ' ').trim()
export function keyedKind(t: string | undefined): KeyedKind | undefined {
  const s = bare(t)
  const m = s.match(new RegExp(`^map ?< ?${KEY} ?, ?${MAP_VALUE} ?>$`))
  if (m) return { kind: 'map', key: m[1], value: m[2] }
  const e = s.match(new RegExp(`^set ?< ?${KEY} ?>$`))
  return e ? { kind: 'set', key: e[1] } : undefined
}

/** map 的值型別在 Python 的預設值（C++ 的 `m[k]` 讀一個沒有的鍵，補上值初始化的那一個） */
export function zeroOf(t: string | undefined): string | undefined {
  const s = bare(t)
  return /^(int|long|long long|short)$/.test(s) ? '0' : s === 'double' ? '0.0' : s === 'string' ? '""' : undefined
}

/** 一顆運算式節點沒有副作用、算兩次也一樣嗎（變數、字面量）——同 truncatedRemainder 的判準 */
export function isSimple(x: SemanticNode | undefined): boolean {
  return !!x && Object.values(x.slots ?? {}).every((k) => k.length === 0)
    && (typeof x.properties?.name === 'string' || typeof x.properties?.value === 'string')
}

/** 整數型別的寬度等級（LP64：long 與 long long 同寬） */
const CAST_RANK: Record<string, number> = { short: 1, 'short int': 1, int: 2, signed: 2, 'signed int': 2, long: 3, 'long int': 3, 'long long': 3, 'long long int': 3 }

/**
 * C 風格轉型與 `static_cast` 寫成 Python（453）——只收兩邊意思確定相同的：
 * - 浮點 → 整數：`int(x)`（都向零截斷；超出範圍在 C++ 是未定義行為，Cella 先判出來）
 * - 整數 → 同寬或更寬的整數：照原樣（值不變）
 * - char → 整數：`ord(x)`（Python 的 char 是長度 1 的字串）
 * - 整數、double → double：`float(x)`（2^53 以內精確；long long 照實保留）
 * 其餘（窄化成 int 會繞回、轉成 float 會降精度、轉成 char／bool）照實保留——不猜。
 */
export function castToPython(n: SemanticNode, py: ToPythonContext): string {
  const to = bare(String(n.properties.target_type ?? ''))
  const v = n.slots.value?.[0]
  const from = bare(py.typeOf(v))
  const keep = (): string => py.keep(n, 'outside-subset', `(${to}) 轉型（來源型別 ${from || '不明'}）還沒有對應`)
  if (CAST_RANK[to] !== undefined) {
    if (from === 'double' || from === 'float') return `int(${py.expr(v)})`
    if (from === 'char') return `ord(${py.expr(v)})`
    if (CAST_RANK[from] !== undefined && CAST_RANK[from] <= CAST_RANK[to]) return `(${py.expr(v)})`
    return keep()
  }
  if (to === 'double') {
    if (from === 'double' || from === 'float' || isNarrowInt(from)) return `float(${py.expr(v)})`
    return keep()
  }
  return keep()
}

/** 一個左值的底名（`a`、`a[i]`、`v.at(i)`、`p.x` → a／v／p） */
function baseName(x: SemanticNode | undefined): string | undefined {
  if (!x) return undefined
  if (typeof x.properties?.name === 'string' && Object.keys(x.slots ?? {}).length === 0) return x.properties.name
  if (typeof x.properties?.obj === 'string') return x.properties.obj
  return baseName(x.slots?.obj?.[0] ?? x.slots?.target?.[0])
}

/**
 * 這幾句敘述可能改到 `names` 裡的哪一個嗎（453：計次迴圈換成 range 之前要問上界與迴圈變數會不會被改）——寧可多報：
 * 指定的目標（target 槽）、元件宣告的寫入（`cin >>`）、元素指定（`a[i] = …`）、敘述位置的方法呼叫（`v.push_back(x)`）、
 * 當引數傳給自訂函式（可能是參考參數）、名字是全域而本體呼叫了自訂函式
 */
export function mayWrite(nodes: readonly SemanticNode[], names: ReadonlySet<string>, py: ToPythonContext): boolean {
  const hit = (x: SemanticNode | undefined): boolean => { const b = baseName(x); return b !== undefined && names.has(b) }
  const walk = (x: SemanticNode, isStmt: boolean): boolean => {
    if (hit(x.slots?.target?.[0])) return true
    if (py.writtenBy(x).some(hit)) return true
    if (typeof x.properties?.obj === 'string' && names.has(x.properties.obj) && x.slots?.value !== undefined) return true
    if (isStmt && hit(x.slots?.obj?.[0])) return true
    if (typeof x.properties?.name === 'string' && py.isUserFunction(x.properties.name)) {
      if ([...names].some((v) => py.isGlobal(v))) return true
      if (Object.values(x.slots ?? {}).some((kids) => kids.some(hit))) return true
    }
    return Object.entries(x.slots ?? {}).some(([k, kids]) => kids.some((c) => walk(c, /body$/.test(k))))
  }
  return nodes.some((x) => walk(x, true))
}
