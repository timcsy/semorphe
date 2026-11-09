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
const PY_KEYWORDS = new Set(['math', 'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'class', 'def', 'del', 'elif', 'except', 'finally', 'from', 'global', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'with', 'yield', 'print', 'input', 'len', 'range', 'int', 'float', 'str', 'list', 'chr', 'ord', 'format', 'next_token', '_tokens'])

/** 同 `cin >>` 的讀法：一次讀一個以空白分開的詞，這一行讀完才讀下一行 */
const TOKEN_READER = [
  '_tokens = []',
  'def next_token():',
  '    while len(_tokens) == 0:',
  '        _tokens.extend(input().split())',
  '    return _tokens.pop(0)',
]
/** C++ 的 %：商向零截斷（[expr.mul]p4）。寫成函式，兩邊的運算式各只算一次 */
const TRUNC_MOD = ['def trunc_mod(a, b):', '    return a - int(a / b) * b']
const tables = (): ToPythonTables => (TABLES ??= collectToPython())

const lineOf = (n: SemanticNode): number | undefined =>
  (n.metadata as { sourceRange?: { startLine?: number } } | undefined)?.sourceRange?.startLine

export function convertCppToPython(
  tree: SemanticNode, types: Readonly<Record<string, string>> = {}, problems: readonly { kind: string; at?: string }[] = [],
): LanguageConversion {
  const reasons: LanguageConversion['reasons'] = []
  let converted = 0
  const t = tables()
  // 程式自己定義的函式名（問形狀：有 params 槽、有名字的節點）——呼叫它們才換，標準函式庫的第一版不換
  const userFunctions = new Set<string>()
  const declaredStrings = new Set<string>()
  const scan = (n: SemanticNode): void => {
    if (n.slots?.params !== undefined && typeof n.properties?.name === 'string') userFunctions.add(n.properties.name)
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(scan)
  }
  scan(tree)
  let inMain = false
  let needTokens = false
  let needTruncMod = false
  const imports = new Set<string>()
  const py: ToPythonContext = {
    get inMain() { return inMain },
    blockAsMain(nodes) {
      const was = inMain; inMain = true
      try { return (nodes ?? []).flatMap((c) => stmt(c, 0)) } finally { inMain = was }
    },
    isUserFunction: (name) => userFunctions.has(name),
    name: (s) => (PY_KEYWORDS.has(s) ? `${s}_` : s),
    // 只有一個進入點的 C++ 骨架（`main`）——Arduino 的 setup／loop 兩個進入點攤不平，不在這裡
    isEntryFunction: (name) => skeletonsOfLanguage('cpp').some((sk) => sk.entryFunctions.length === 1 && !!entryFunctionOf(sk, name)),
    yieldsBool: (n) => !!n && t.bool.has(n.componentId),
    useTokenReader() { needTokens = true; return 'next_token()' },
    useTruncMod() { needTruncMod = true; return 'trunc_mod' },
    noteDeclaredString: (name) => { declaredStrings.add(name) },
    isDeclaredString: (name) => declaredStrings.has(name),
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
      return fn ? fn(n, py) : py.keep(n, 'outside-subset', `「${n.componentId}」還沒有 Python 的寫法`)
    },
    block(nodes, depth) {
      const lines = (nodes ?? []).flatMap((c) => stmt(c, depth))
      return lines.length > 0 ? lines : [`${py.indent(depth)}pass`]
    },
  }
  const stmt = (n: SemanticNode, depth: number): string[] => {
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
  const head = [...[...imports].sort().map((m) => `import ${m}`), ...(needTokens ? TOKEN_READER : []), ...(needTruncMod ? TRUNC_MOD : [])]
  return { code: `${[...head, ...lines].join('\n')}\n`, converted, kept: 0, reasons }
}
