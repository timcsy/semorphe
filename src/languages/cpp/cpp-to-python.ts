/**
 * **C++ → Python**（跨語言互轉第二對，spec 219）：把 C++ 的語意樹寫成 Python 原始碼。
 *
 * - 每顆元件的印法住在它的膠囊（`src/components/cpp/<名>/to-python.ts`，research R7）；這裡只負責走樹、查表、記保留原因。
 * - **整支換或不換**（契約 C1）：有任何一處保留 ⟹ `code` 是 null，原因列出來（Python 程式裡不能留一行 C++）。
 * - 換得對不對由 Cella 判：護欄 `tests/integration/cpp-to-python-verdict.test.ts` 對兩邊的判決、輸出、assumes（契約 C3）。
 */
import type { SemanticNode } from '../../core/types'
import type { KeepKind, LanguageConversion } from '../../core/language-conversion'
import { skeletonsOfLanguage, entryFunctionOf } from '../../core/skeleton'
import type { ToPythonContext } from './to-python/contract'
import { collectToPython, type ToPythonTables } from './to-python/registry'

let TABLES: ToPythonTables | null = null

/** Python 的保留字與內建常數——C++ 的名字撞到就加底線 */
const PY_KEYWORDS = new Set(['math', 'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'class', 'def', 'del', 'elif', 'except', 'finally', 'from', 'global', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'with', 'yield', 'print', 'input', 'len', 'range', 'int', 'float', 'str', 'list', 'chr', 'ord', 'format', 'next_token', 'has_token', '_tokens', 'sorted', 'dict', 'set'])

/** 同 `cin >>` 的讀法：一次讀一個以空白分開的詞，這一行讀完才讀下一行 */
const TOKEN_READER = [
  '_tokens = []',
  'def next_token():',
  '    while len(_tokens) == 0:',
  '        _tokens.extend(input().split())',
  '    return _tokens.pop(0)',
]
/**
 * 「還有沒有下一個詞」（459，`while (cin >> x)`）：讀到檔尾（input() 丟 EOFError）回 False，不吞掉別的例外。
 * ⚠️ 詞不是那個型別（int 讀到 `abc`）時 C++ 存 0 並結束迴圈，Python 的 int(…) 丟 ValueError——同 `cin >> x` 那一句的既有限制（照輸入判，不是靜默）
 */
const TOKEN_PROBE = [
  'def has_token():',
  '    while len(_tokens) == 0:',
  '        try:',
  '            line = input()',
  '        except EOFError:',
  '            return False',
  '        _tokens.extend(line.split())',
  '    return True',
]
/** C++ 的 %：商向零截斷（[expr.mul]p4）。寫成函式，兩邊的運算式各只算一次 */
const TRUNC_MOD = ['def trunc_mod(a, b):', '    return a - int(a / b) * b']
/** 64 位元整數的除法與取餘數（456）：只用整數運算——商向零截斷（C++ 的 [expr.mul]p4），餘數照 a == (a / b) * b + a % b */
const TRUNC_DIV = ['def trunc_div(a, b):', '    q = abs(a) // abs(b)', '    return q if (a < 0) == (b < 0) else -q']
const TRUNC_MOD64 = ['def trunc_mod64(a, b):', '    return a - trunc_div(a, b) * b']
const tables = (): ToPythonTables => (TABLES ??= collectToPython())

const lineOf = (n: SemanticNode): number | undefined =>
  (n.metadata as { sourceRange?: { startLine?: number } } | undefined)?.sourceRange?.startLine

/**
 * 型別別名（`#define ll long long`，膠囊以 `r.typeAlias` 宣告）在每一顆節點的型別文字上展開（453）——
 * 讀型別的膠囊（整數截斷、起始值、參數的傳遞方式）於是照展開後的型別判；節點的 id 不變（Cella 的型別表以 id 查）
 */
function expandTypeAliases(tree: SemanticNode, t: ToPythonTables): SemanticNode {
  const aliases = new Map<string, string>()
  const collect = (n: SemanticNode): void => {
    const a = t.typeAlias.get(n.componentId)?.(n)
    if (a) aliases.set(a.name, a.type)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(collect)
  }
  collect(tree)
  if (aliases.size === 0) return tree
  const expand = (s: string): string => {
    for (let i = 0; i < 8; i++) {
      const next = s.replace(/[A-Za-z_]\w*/g, (w) => aliases.get(w) ?? w)
      if (next === s) return s
      s = next
    }
    return s
  }
  const clone = (n: SemanticNode): SemanticNode => ({
    ...n,
    properties: Object.fromEntries(Object.entries(n.properties ?? {}).map(([k, v]) => [k, /type/i.test(k) && typeof v === 'string' ? expand(v) : v])),
    slots: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, kids]) => [k, kids.map(clone)])),
  })
  return clone(tree)
}

export function convertCppToPython(
  input: SemanticNode, types: Readonly<Record<string, string>> = {}, problems: readonly { kind: string; at?: string }[] = [],
): LanguageConversion {
  const reasons: LanguageConversion['reasons'] = []
  let converted = 0
  const t = tables()
  const tree = expandTypeAliases(input, t)
  // 程式自己定義的函式名（問形狀：有 params 槽、有名字的節點）——呼叫它們才換，標準函式庫的第一版不換
  const userFunctions = new Set<string>()
  const declaredStrings = new Set<string>()
  const elementTypes = new Map<string, string | null>()
  const scan = (n: SemanticNode): void => {
    if (n.slots?.params !== undefined && typeof n.properties?.name === 'string') userFunctions.add(n.properties.name)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(scan)
  }
  scan(tree)
  // 頂層宣告的全域變數（451）——問形狀：頂層、有名字有型別、不是函式（沒有 params 槽）；一句宣告多個名字的在 declarators 裡
  const globals = new Set<string>()
  const noteGlobal = (n: SemanticNode): void => {
    if (n.slots?.params !== undefined) return
    if (typeof n.properties?.name === 'string' && n.properties?.type !== undefined) globals.add(n.properties.name)
    for (const d of n.slots?.declarators ?? []) noteGlobal(d)
  }
  for (const n of tree.slots?.body ?? []) noteGlobal(n)
  let inMain = false
  let needTokens = false, needProbe = false
  let needTruncMod = false
  let needTruncDiv = false, needTruncMod64 = false
  const imports = new Set<string>()
  // 運算式裡的 ++／--（457）：每一句敘述一個框，拆出來的前後句先放這裡，敘述寫完再決定收不收
  interface Frame { owner: SemanticNode; before: string[]; after: string[]; nested: boolean }
  const frames: Frame[] = []
  let conditionalDepth = 0
  const occurrences = (x: SemanticNode, name: string): number =>
    (x.properties?.name === name || x.properties?.obj === name ? 1 : 0) + Object.values(x.slots ?? {}).reduce((a, kids) => a + kids.reduce((b, c) => b + occurrences(c, name), 0), 0)
  const callsUserFunction = (x: SemanticNode): boolean =>
    (typeof x.properties?.name === 'string' && userFunctions.has(x.properties.name) && Object.keys(x.slots ?? {}).length > 0) ||
    Object.values(x.slots ?? {}).some((kids) => kids.some(callsUserFunction))
  const py: ToPythonContext = {
    get inMain() { return inMain },
    blockAsMain(nodes) {
      const was = inMain; inMain = true
      try { return (nodes ?? []).flatMap((c) => stmt(c, 0)) } finally { inMain = was }
    },
    isUserFunction: (name) => userFunctions.has(name),
    isGlobal: (name) => globals.has(name),
    writtenBy: (n) => t.writes.get(n.componentId)?.(n) ?? [],
    name: (s) => (PY_KEYWORDS.has(s) ? `${s}_` : s),
    // 只有一個進入點的 C++ 骨架（`main`）——Arduino 的 setup／loop 兩個進入點攤不平，不在這裡
    isEntryFunction: (name) => skeletonsOfLanguage('cpp').some((sk) => sk.entryFunctions.length === 1 && !!entryFunctionOf(sk, name)),
    yieldsBool: (n) => !!n && t.bool.has(n.componentId),
    useTokenReader() { needTokens = true; return 'next_token()' },
    isStreamRead: (n) => !!n && t.streamRead.has(n.componentId),
    useTokenProbe() { needTokens = true; needProbe = true; return 'has_token()' },
    useTruncMod() { needTruncMod = true; return 'trunc_mod' },
    useTruncDiv(kind) { needTruncDiv = true; if (kind === 'mod') { needTruncMod64 = true; return 'trunc_mod64' } return 'trunc_div' },
    noteDeclaredString: (name) => { declaredStrings.add(name) },
    isDeclaredString: (name) => declaredStrings.has(name),
    noteElementType: (name, type) => { elementTypes.set(name, elementTypes.has(name) && elementTypes.get(name) !== type ? null : type) },
    elementTypeOf: (name) => elementTypes.get(name) ?? undefined,
    useImport(m) { imports.add(m); return m },
    indent: (d) => '    '.repeat(d),
    typeOf: (n) => (n ? types[n.id] : undefined),
    keep(n, kind: KeepKind, detail) {
      const line = lineOf(n)
      reasons.push({ nodeId: n.id, ...(line !== undefined ? { line: line + 1 } : {}), kind, detail })
      return '…'
    },
    expr(n) {
      if (!n) return '…'
      const fn = t.expr.get(n.componentId)
      if (!fn) return py.keep(n, 'outside-subset', `「${n.componentId}」還沒有 Python 的寫法`)
      if (!t.conditional.has(n.componentId)) return fn(n, py)
      conditionalDepth++
      try { return fn(n, py) } finally { conditionalDepth-- }
    },
    hoist(n, name, line, when) {
      const f = frames[frames.length - 1]
      const no = (why: string): boolean => { py.keep(n, 'outside-subset', why); return false }
      if (!f) return no('運算式裡的 ++／-- 不在任何一句敘述裡')
      if (conditionalDepth > 0) return no('寫在 &&、||、?: 裡的 ++／--：不一定會算，拆不到敘述的前後')
      if (occurrences(f.owner, name) !== 1) return no(`同一句裡又用到「${name}」——把 ++／-- 拆到前後之後，讀到的值會不同`)
      if (globals.has(name) && callsUserFunction(f.owner)) return no(`「${name}」是全域變數，這一句呼叫的函式可能讀到它——拆到前後之後讀到的值會不同`)
      ;(when === 'before' ? f.before : f.after).push(line)
      return true
    },
    target(n, readsFirst) {
      if (!n) return { text: '…' }
      const fn = t.target.get(n.componentId)
      return fn ? fn(n, py, readsFirst) : { text: py.expr(n) }
    },
    block(nodes, depth) {
      if (frames.length > 0) frames[frames.length - 1].nested = true
      const lines = (nodes ?? []).flatMap((c) => stmt(c, depth))
      // 只有註解的本體也要一個 pass（453：註解換過去之後，`if (x) { // 空 }` 不能只剩一行 #）
      return lines.some((l) => !/^\s*#/.test(l)) ? lines : [...lines, `${py.indent(depth)}pass`]
    },
  }
  const stmt = (n: SemanticNode, depth: number): string[] => {
    const frame: Frame = { owner: n, before: [], after: [], nested: false }
    frames.push(frame)
    let lines: string[]
    try { lines = stmtOnly(n, depth) } finally { frames.pop() }
    if (frame.before.length === 0 && frame.after.length === 0) return lines
    // 有本體的敘述（if、while…）：拆到整句的前後會跑錯——條件每圈都算、拆出來的只跑一次
    if (frame.nested) { py.keep(n, 'outside-subset', '條件或迴圈裡的 ++／--：拆到整句的前後之後，每一圈不會再算一次'); return lines }
    if (frame.after.length > 0 && /^\s*(return|break|continue)\b/.test(lines[lines.length - 1] ?? '')) {
      py.keep(n, 'outside-subset', '這一句之後就離開了——拆到後面的 ++／-- 不會執行'); return lines
    }
    const ind = py.indent(depth)
    return [...frame.before.map((l) => ind + l), ...lines, ...frame.after.map((l) => ind + l)]
  }
  const stmtOnly = (n: SemanticNode, depth: number): string[] => {
    const s = t.stmt.get(n.componentId)
    if (s) { const lines = s(n, py, depth); converted += lines.length > 0 ? 1 : 0; return lines }
    // 運算式當敘述（`f(x);`、`i++;`）：有運算式印法就照印一行
    if (t.expr.has(n.componentId)) { converted++; return [`${py.indent(depth)}${py.expr(n)}`] }
    py.keep(n, 'outside-subset', `「${n.componentId}」還沒有 Python 的寫法`)
    return []
  }
  const lines = stmt(tree, 0)
  // 整數溢位（spec 219 T017）：C++ 是未定義行為、Python 的整數不會溢位——結果不同，不換。判決指回溢位的那一顆
  const byId = new Map<string, SemanticNode>()
  const index = (n: SemanticNode): void => { byId.set(n.id, n); for (const kids of Object.values(n.slots ?? {})) kids.forEach(index) }
  index(tree)
  for (const p of problems) {
    if (p.kind === 'ubOverflow') py.keep(byId.get(p.at ?? '') ?? tree, 'overflow', '這裡在 C++ 會整數溢位（未定義行為）——Python 的整數不會溢位，結果會不同')
  }
  if (reasons.length > 0) return { code: null, converted: 0, kept: reasons.length, reasons }
  // 跨行讀一個詞——同 cin（空白與換行都是分隔；research R4 的修正：課文的輸入一個數一行，「一句讀一行」對不上）
  const head = [...[...imports].sort().map((m) => `import ${m}`), ...(needTokens ? TOKEN_READER : []), ...(needProbe ? TOKEN_PROBE : []), ...(needTruncMod ? TRUNC_MOD : []), ...(needTruncDiv ? TRUNC_DIV : []), ...(needTruncMod64 ? TRUNC_MOD64 : [])]
  return { code: `${[...head, ...lines].join('\n')}\n`, converted, kept: 0, reasons }
}
