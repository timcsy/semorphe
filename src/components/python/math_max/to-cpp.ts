/** 這顆元件寫成 C++（spec 225）。 */
import type { ToCppRegistrar, ToCppContext } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'
import { keyLambda } from '../../../languages/python/python-to-cpp'

export function registerToCpp(r: ToCppRegistrar): void {
  r.expr((n, cpp) => extreme(n, cpp, 'max'))
}
/** max／min：一個清單 → *max_element；兩個以上的值且同型別 → max({…}) */
export function extreme(n: SemanticNode, cpp: ToCppContext, f: 'max' | 'min'): string {
  const vs = n.slots.values ?? []
  const lam = keyLambda(n)
  if (lam) return byKey(n, lam, cpp, f)
  if (vs.length === 1) {
    const t = cpp.pyType(vs[0])
    if (!t || !/^list\[(int|float)\]$/.test(t)) return cpp.keep(n, 'type-uncertain', `${f} 的對象型別（${t ?? '?'}）`)
    cpp.useInclude('algorithm')
    return `*${f}_element(${cpp.expr(vs[0])}.begin(), ${cpp.expr(vs[0])}.end())`
  }
  const ts = new Set(vs.map((v) => cpp.pyType(v)))
  if (ts.size !== 1 || !['int', 'float'].includes([...ts][0] ?? '')) return cpp.keep(n, 'type-uncertain', `${f} 的參數型別不一致`)
  cpp.useInclude('algorithm')
  return `${f}({${vs.map((v) => cpp.expr(v)).join(', ')}})`
}

/**
 * max(d, key=lambda k: …)（442）：照放入的順序走過字典的鍵，留下 key 最大（最小）的那個——平手取先放進去的（Python 的規則）。
 * 字典要有旁邊那一串鍵（引擎的 `dictKeys`）；空的字典 Python 丟 ValueError，C++ 也丟。
 * 先在那一句前面算好（`hoist`），所以只收「整句只算一次」的位置
 */
function byKey(n: SemanticNode, lam: SemanticNode, cpp: ToCppContext, f: 'max' | 'min'): string {
  const d = n.slots.values?.[0]
  const dt = cpp.pyType(d)
  const keys = d?.componentId.endsWith(':var_ref') ? cpp.dictKeys(String(d.properties?.name ?? '')) : undefined
  const kt = cpp.cppType(/^dict\[(.+?), /.exec(dt ?? '')?.[1])
  const body = lam.slots.body?.[0]
  const bt = cpp.pyType(body)
  if (!keys || !kt) return cpp.keep(n, 'outside-subset', `${f}(…, key=…) 只換照放入順序走訪的字典`)
  if (bt !== 'int' && bt !== 'float') return cpp.keep(n, 'type-uncertain', `${f} 的 key 算出來的型別（${bt ?? '?'}）`)
  if (!cpp.canHoist(n)) return cpp.keep(n, 'outside-subset', `${f}(…, key=…) 要先在前面算好，這個位置不行`)
  const p = cpp.name(String(lam.slots.params?.[0]?.properties?.name ?? ''))
  const vt = cpp.cppType(bt)!
  const cmp = f === 'max' ? '>' : '<'
  cpp.useInclude('stdexcept')
  return cpp.hoist(n, f, (b) => [
    `if (${cpp.name(keys)}.size() == 0) {`,
    `    throw invalid_argument("ValueError");`,
    '}',
    `${kt} ${b} = ${cpp.name(keys)}[0];`,
    `${vt} ${b}_key = 0;`,
    `bool ${b}_seen = false;`,
    `for (${kt} ${p} : ${cpp.name(keys)}) {`,
    `    ${vt} ${b}_k = ${cpp.expr(body)};`,
    `    if (!${b}_seen || ${b}_k ${cmp} ${b}_key) {`,
    `        ${b} = ${p};`,
    `        ${b}_key = ${b}_k;`,
    `        ${b}_seen = true;`,
    '    }',
    '}',
  ])
}
