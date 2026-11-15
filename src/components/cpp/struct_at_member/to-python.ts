/**
 * 這顆元件寫成 Python（450、465）：pair 換成 tuple ⟹ `.first` → `[0]`、`.second` → `[1]`。其餘的 struct 還沒有對應。
 * 走訪 map 拿到的那一對（`std::pair<const K, V>`，450）、自己宣告的 pair 與 pair 陣列的元素（465）都是 tuple。
 *
 * 當指定目標（465）：tuple 不能改 ⟹ 寫成**重建整個 tuple**（`p.first = 7` → `p = (7, p[1])`、`a[i].second++` → `a[i] = (a[i][0], a[i][1] + 1)`）。
 * tuple 不能改反而讓「複製」不必處理：`q = p`、傳值、範圍 for 的 `auto x` 都是各自一個值，改 x 只換掉 x——同 C++ 的複製。
 * 也因此**參考**不能這樣寫（`for (auto& x : a) x.first = 1` 重建 x 改不到 a）⟹ 目標只收兩種、型別都問宣告那一顆記下的（不問 Cella——它不分參考）：
 *   ① 一個名字，宣告成 pair（不是參考）  ② 陣列的一格 `a[i]`，陣列宣告成 pair 陣列、索引沒有呼叫（寫兩次也一樣）
 */
import type { ToPythonRegistrar, ToPythonContext, Target } from '../../../languages/cpp/to-python/contract'
import type { SemanticNode } from '../../../core/types'
import { atom, pairElements } from '../../../languages/cpp/to-python/contract'

const PAIR = /^(const\s+)?(std::)?pair\s*</

const leafName = (x: SemanticNode | undefined): string | undefined =>
  x && typeof x.properties?.name === 'string' && Object.values(x.slots ?? {}).every((k) => !k?.length) ? x.properties.name : undefined

/** 目標的 pair 型別——只收上面那兩種形狀（問形狀：名字的葉子；有 obj 與 index 兩個槽、obj 是名字的葉子） */
function ownPairType(obj: SemanticNode | undefined, py: ToPythonContext): string | undefined {
  const name = leafName(obj)
  if (name !== undefined) {
    const t = py.varTypeOf(name)
    return t && !t.includes('&') && pairElements(t) ? t : undefined
  }
  const keys = Object.keys(obj?.slots ?? {}).filter((k) => obj!.slots[k]?.length)
  const arr = keys.length === 2 && keys.includes('obj') && keys.includes('index') ? leafName(obj!.slots.obj[0]) : undefined
  if (arr === undefined) return undefined
  const t = py.elementTypeOf(py.name(arr))
  return t && pairElements(t) ? t : undefined
}

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    const obj = n.slots.obj?.[0]
    const m = String(n.properties.member ?? '')
    const t = py.typeOf(obj) ?? ownPairType(obj, py)
    if (!PAIR.test(t ?? '') || (m !== 'first' && m !== 'second')) return py.keep(n, 'outside-subset', `${t ?? '結構'} 的成員還沒有對應`)
    return `${atom(py.expr(obj))}[${m === 'first' ? 0 : 1}]`
  })
  r.target((n, py): Target => {
    const obj = n.slots.obj?.[0]
    const m = String(n.properties.member ?? '')
    const t = ownPairType(obj, py)
    const el = pairElements(t)
    if (!el || (m !== 'first' && m !== 'second')) return { text: py.keep(n, 'outside-subset', `改 ${py.typeOf(obj) ?? '結構'} 的成員還沒有對應`) }
    const o = py.expr(obj)
    // 陣列的一格要寫兩次（讀另一格、寫回整格）——索引裡有呼叫的不收（呼叫兩次與一次不同）
    if (o.includes('(') || o.includes('…')) return { text: py.keep(n, 'outside-subset', '改 pair 陣列一格的成員，而索引是一段有呼叫的運算式') }
    const k = m === 'first' ? 0 : 1
    const other = `${atom(o)}[${1 - k}]`
    return { text: `${atom(o)}[${k}]`, type: el[k], assign: (v) => `${o} = ${k === 0 ? `(${v}, ${other})` : `(${other}, ${v})`}` }
  })
}
