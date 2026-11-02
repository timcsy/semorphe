/**
 * `cpp:enum` 的 **formalize** 路（spec 202）——檔案範圍的 `enum E { A = 3, B, C };` 送 `iEnum`。契約見 `core/formalize-contract.ts`。
 *
 * 形狀照 cella 的 `cpp_to_tree.py`：`iEnum {n, name, cs: [enumC {x, name, v}]}`——`x` 是列舉常數的宣告節點
 * （用到它的 `eVar` 指向同一個 `x`），`v` 只在原文寫了值時有（沒寫的由 Cella 照 [dcl.enum]p2 從前一個 +1）。
 *
 * ⚠️ 語義樹把成員存成一段原文（`values`）。這裡只認 `名字` 與 `名字 = 整數字面`（可帶負號）；
 * 值是其他運算式（`B = A + 1`）照實標 unknown，不猜。`enum class`／底層型別還沒有對應（unknown）。
 * 🟢 第 238 刀：區塊裡的列舉送 `sType{d: tdEnum{…}}`、列舉名當型別送 `tEnum`（cella 2026-11-03 給的形狀）。
 */
import type { FormalizeRegistrar, FormalizeContext, CellaJson } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

interface Enumerator { name: string; value: string | null }

/** `RED = 1, GREEN, BLUE = -9` → 成員；認不得的形狀回 null */
function enumerators(n: SemanticNode): Enumerator[] | null {
  const text = String(n.properties?.values ?? '').trim()
  if (text === '') return []
  const out: Enumerator[] = []
  for (const part of text.split(',').map((s) => s.trim()).filter((s) => s !== '')) {
    const m = /^([A-Za-z_]\w*)(?:\s*=\s*(.+))?$/.exec(part)
    if (!m) return null
    out.push({ name: m[1], value: m[2]?.trim() ?? null })
  }
  return out
}

const enumeratorId = (n: SemanticNode, name: string): string => `${n.id}/${name}`

function valueOf(e: Enumerator, n: SemanticNode, f: FormalizeContext): CellaJson | null | undefined {
  if (e.value === null) return null
  const m = /^(-)?\s*(\d+)$/.exec(e.value)
  if (!m) return undefined
  const id = `${enumeratorId(n, e.name)}/v`
  const num = f.k('eNum', { n: m[1] ? `${id}/abs` : id, v: Number(m[2]) })
  return m[1] ? f.k('eUn', { n: id, op: f.k('opNeg'), a: num }) : num
}

export function registerFormalize(r: FormalizeRegistrar): void {
  /** 成員；翻不了時回一個 miss（呼叫端原樣交出去） */
  const members = (n: SemanticNode, f: FormalizeContext): CellaJson[] | { miss: CellaJson } => {
    if (/^\s*(class|struct)\b/.test(String(n.properties?.name ?? ''))) return { miss: f.miss(n, '`enum class` 還沒有對應') }
    const es = enumerators(n)
    if (!es) return { miss: f.miss(n, '列舉的成員認不出來') }
    const cs: CellaJson[] = []
    for (const e of es) {
      const v = valueOf(e, n, f)
      if (v === undefined) return { miss: f.miss(n, `列舉常數 ${e.name} 的值不是整數字面（運算式還沒有對應）`) }
      cs.push(f.k('enumC', { x: enumeratorId(n, e.name), name: e.name, v }))
    }
    return cs
  }
  r.item('cpp:enum', (n, f) => {
    const cs = members(n, f)
    return 'miss' in cs ? [cs.miss] : [f.k('iEnum', { n: n.id, name: String(n.properties?.name ?? ''), cs })]
  })
  // 區塊裡的列舉（`int main(){ enum Level {…}; }`）：敘述 sType 包 tdEnum（cella 2026-11-03；區域的 struct／union／typedef 也是同一個 sType）
  r.stmt('cpp:enum', (n, f) => {
    const cs = members(n, f)
    return 'miss' in cs ? [cs.miss] : [f.k('sType', { n: `${n.id}/stmt`, d: f.k('tdEnum', { n: n.id, name: String(n.properties?.name ?? ''), cs }) })]
  })
  r.definesEnum('cpp:enum', (n) => String(n.properties?.name ?? ''))
  // 作用域：每個列舉常數是一個宣告（`int c = GREEN;` 的 GREEN 指到它）
  r.scope('cpp:enum', (n, w) => {
    for (const e of enumerators(n) ?? []) w.declare(e.name, enumeratorId(n, e.name))
  })
}
