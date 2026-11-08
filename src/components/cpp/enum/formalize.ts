/**
 * `cpp:enum` 的 **formalize** 路（spec 202）——檔案範圍的 `enum E { A = 3, B, C };` 送 `iEnum`。契約見 `core/formalize-contract.ts`。
 *
 * 形狀照 cella 的 `cpp_to_tree.py`：`iEnum {n, name, cs: [enumC {x, name, v}]}`——`x` 是列舉常數的宣告節點
 * （用到它的 `eVar` 指向同一個 `x`），`v` 只在原文寫了值時有（沒寫的由 Cella 照 [dcl.enum]p2 從前一個 +1）。
 *
 * ⚠️ 語義樹把成員存成一段原文（`values`）。這裡只認 `名字` 與 `名字 = 整數字面`（可帶負號）；
 * 值是其他運算式（`B = A + 1`）拆成運算式交給 Cella 算（`const-expr.ts`，344）；拆不了的照實標 unknown。`enum class`／底層型別還沒有對應（unknown）。
 * 🟢 第 238 刀：區塊裡的列舉送 `sType{d: tdEnum{…}}`、列舉名當型別送 `tEnum`（cella 2026-11-03 給的形狀）。
 */
import type { FormalizeRegistrar, FormalizeContext, CellaJson } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'
import { constExpr } from './const-expr'

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

/** 列舉在 Cella 那邊的名字：有 Tag 用 Tag，`typedef enum { … } Kind;` 用別名（2026-11-08，同結構那顆） */
const enumName = (n: SemanticNode): string => String(n.properties?.name ?? '') || String(n.properties?.typedef_alias ?? '')

/** `enum class`／`enum struct`（360；舊的樹沒有這一格 ⟹ 一般的 enum） */
const isScoped = (n: SemanticNode): boolean => n.properties?.scoped === 'class' || n.properties?.scoped === 'struct'

function valueOf(e: Enumerator, n: SemanticNode, f: FormalizeContext): CellaJson | null | undefined {
  if (e.value === null) return null
  const m = /^(-)?\s*(\d+)$/.exec(e.value)
  const id = `${enumeratorId(n, e.name)}/v`
  // 不是整數字面（`1 << 2`、`A + 1`、`'a'`）：拆成運算式交給 Cella 算（344；cella 2026-11-08——enumC.v 本來就是運算式）
  if (!m) return constExpr(e.value, id, f)
  const num = f.k('eNum', { n: m[1] ? `${id}/abs` : id, v: Number(m[2]) })
  return m[1] ? f.k('eUn', { n: id, op: f.k('opNeg'), a: num }) : num
}

export function registerFormalize(r: FormalizeRegistrar): void {
  /** 成員；翻不了時回一個 miss（呼叫端原樣交出去） */
  const members = (n: SemanticNode, f: FormalizeContext): CellaJson[] | { miss: CellaJson } => {
    const es = enumerators(n)
    if (!es) return { miss: f.miss(n, '列舉的成員認不出來') }
    const cs: CellaJson[] = []
    for (const e of es) {
      const v = valueOf(e, n, f)
      if (v === undefined) return { miss: f.miss(n, `列舉常數 ${e.name} 的值「${e.value}」拆不成認得的常數運算式（三元、sizeof、轉型、呼叫還沒有對應）`) }
      cs.push(f.k('enumC', { x: enumeratorId(n, e.name), name: e.name, v }))
    }
    return cs
  }
  r.item('cpp:enum', (n, f) => {
    const cs = members(n, f)
    if ('miss' in cs) return [cs.miss]
    // 有作用域的列舉（360）：iEnumClass {n, name, base: 型別 | null, cs}（Cella 0.1.202611082230 起；cella 談定的形狀）
    if (isScoped(n)) {
      const base = String(n.properties?.base ?? '').trim()
      return [f.k('iEnumClass', { n: n.id, name: enumName(n), base: base ? f.type(base, n) : null, cs })]
    }
    return [f.k('iEnum', { n: n.id, name: enumName(n), cs })]
  })
  // 區塊裡的列舉（`int main(){ enum Level {…}; }`）：敘述 sType 包 tdEnum（cella 2026-11-03；區域的 struct／union／typedef 也是同一個 sType）
  r.stmt('cpp:enum', (n, f) => {
    // 區塊裡的 enum class：Cella 還沒有對應的敘述形狀（cella 列的還沒做：命名空間裡、類別裡的）⟹ 照實 unknown，不送成一般的 enum
    if (isScoped(n)) return [f.miss(n, '區塊裡的 `enum class` 還沒有對應')]
    const cs = members(n, f)
    return 'miss' in cs ? [cs.miss] : [f.k('sType', { n: `${n.id}/stmt`, d: f.k('tdEnum', { n: n.id, name: enumName(n), cs }) })]
  })
  r.definesEnum('cpp:enum', (n) => enumName(n))
  // `typedef enum Tag { … } Kind;`：兩個名字都能當型別——別名當型別巨集展開成 `enum Tag`（同結構那顆）
  r.definesMacro('cpp:enum', (n) => {
    const alias = String(n.properties?.typedef_alias ?? '')
    const tag = String(n.properties?.name ?? '')
    return alias && tag && alias !== tag ? { name: alias, value: `enum ${tag}` } : null
  })
  // 作用域：每個列舉常數是一個宣告（`int c = GREEN;` 的 GREEN 指到它）
  // `enum class` 的常數不洩漏到外層：登記成帶限定的名字（`Color::Red`）——參照送 eName "Color::Red"；裸寫 `Red` 指不到，由 Cella 判 undeclared（360）
  r.scope('cpp:enum', (n, w) => {
    const prefix = isScoped(n) ? `${enumName(n)}::` : ''
    for (const e of enumerators(n) ?? []) w.declare(`${prefix}${e.name}`, enumeratorId(n, e.name))
  })
}
