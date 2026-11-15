/**
 * 這顆元件寫成 Python（450）：`m[k]`。
 * C++ 讀一個沒有的鍵會**先補上預設值**（之後走訪看得到它）；Python 的 dict 會丟 KeyError
 * ⟹ 讀的時候寫成 `m.setdefault(k, 預設值)`（同樣補上、同樣回傳那一格），當指定目標時寫成 `m[k]`
 */
import type { ToPythonRegistrar, ToPythonContext } from '../../../languages/cpp/to-python/contract'
import type { SemanticNode } from '../../../core/types'
import { zeroOf, isSimple } from '../../../languages/cpp/to-python/contract'

/**
 * 鍵算兩次與一次相同嗎：變數、字面量，或「陣列的一格、索引也是這樣」（469：`cc[A[i]]++`）——問形狀（obj ＋ index 兩個槽），
 * 不點名別顆元件。呼叫、運算都不收（寧可多保留）
 */
function pureKey(x: SemanticNode | undefined): boolean {
  if (isSimple(x)) return true
  const keys = Object.keys(x?.slots ?? {}).filter((k) => x!.slots[k]?.length)
  return keys.length === 2 && keys.includes('obj') && keys.includes('index') && x!.slots.obj.length === 1 && x!.slots.index.length === 1
    && isSimple(x!.slots.obj[0]) && pureKey(x!.slots.index[0])
}

export function registerToPython(r: ToPythonRegistrar): void {
  const parts = (n: SemanticNode, py: ToPythonContext) => ({
    o: py.name(String(n.properties.obj ?? '')), key: n.slots.key?.[0], zero: zeroOf(py.typeOf(n)),
  })
  r.expr((n, py) => {
    const { o, key, zero } = parts(n, py)
    if (zero === undefined) return py.keep(n, 'outside-subset', `值是 ${py.typeOf(n) ?? '不知道型別'} 的 map 還沒有對應`)
    return `${o}.setdefault(${py.expr(key)}, ${zero})`
  })
  r.target((n, py, readsFirst) => {
    const { o, key, zero } = parts(n, py)
    if (!readsFirst) return { text: `${o}[${py.expr(key)}]` }
    if (zero === undefined) return { text: py.keep(n, 'outside-subset', `值是 ${py.typeOf(n) ?? '不知道型別'} 的 map 還沒有對應`) }
    // 先讀再改（`m[k]++`、`m[k] += v`）：先補上預設值、再改 ⟹ 鍵寫兩次，只收算兩次也一樣的鍵
    if (!pureKey(key)) return { text: py.keep(n, 'outside-subset', 'map 的元素先讀再改、而鍵是一段有副作用的運算式') }
    const k = py.expr(key)
    return { before: `${o}.setdefault(${k}, ${zero})`, text: `${o}[${k}]` }
  })
}
