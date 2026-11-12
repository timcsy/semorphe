/**
 * **目標是一個樣式**時三個地方共用的小工具（`for` 第 420 刀、序列指派第 421 刀、推導式第 422 刀）。
 *
 * Python 的文法說目標是 target list：名字、元組、展開（`*rest`），指派還多了索引與屬性。
 * 這幾處都把它收成一個運算式（元組／變數／展開／索引／屬性積木組起來），住在各自的 `pattern` 接點。
 *
 * 住在 `tuple_make` 是因為「最外層的元組不帶括號」是這顆積木的排版規則；其餘的身分只拿來辨認葉子。
 */
import type { GeneratorContext } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import type { SemanticNode } from '../../../core/types'

const short = (n: SemanticNode): string => n.componentId.split(':')[1] ?? ''

/** 一個樣式，每一個葉子都滿足 `leaf`；元組不能是空的、展開只能是 `*x`。 */
function isPattern(n: SemanticNode, leaf: (id: string) => boolean): boolean {
  const id = short(n)
  if (leaf(id)) return true
  if (id === 'splat') return n.properties.kind === 'list' && (n.slots.value ?? []).length === 1 && isPattern(n.slots.value[0], leaf)
  if (id === 'tuple_make') return (n.slots.items ?? []).length > 0 && (n.slots.items ?? []).every((x) => isPattern(x, leaf))
  return false
}

/** 迴圈與推導式的目標：每一個葉子都綁一個新名字（下標與屬性不收——不綁新名字，變數下拉沒地方放）。 */
export const isNamePattern = (n: SemanticNode): boolean => isPattern(n, (id) => id === 'var_ref')

/**
 * 指派的目標：葉子是【左值】——名字、索引（`a[i]`）、屬性（`o.x`）。
 * 切片（`a[1:3]`）不收：Cella 的切片指定還在路上，收了也只會是 unknown。
 */
export const isLvaluePattern = (n: SemanticNode): boolean =>
  isPattern(n, (id) => id === 'var_ref' || id === 'container_at' || id === 'member_at')

/** 樣式裡的第一個名字——`obj` 仍填它（轉 C++ 那一路還讀它）。 */
export function firstName(n: SemanticNode): string | undefined {
  if (short(n) === 'var_ref') return String(n.properties.name ?? '')
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) { const f = firstName(k); if (f) return f }
  return undefined
}

/**
 * 產碼：最外層的元組【預設不帶括號】（`for i, (a, b) in …`、`a, b = 1, 2`）——只有原文寫了括號才帶；一格的要留逗號。
 * ⚠️ 與運算式位置的元組相反（那邊預設帶、原文沒有才省）：積木那一路不存排版註記，而不帶的才是學生寫的樣子。
 */
export function targetPatternText(p: SemanticNode, ctx: GeneratorContext): string {
  if (short(p) !== 'tuple_make' || p.metadata?.layoutHints?.bareTuple === false) return generateExpression(p, ctx)
  const items = (p.slots.items ?? []).map((x) => generateExpression(x, ctx))
  return items.length === 1 ? `${items[0]},` : items.join(', ')
}
