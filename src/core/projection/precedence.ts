/**
 * **運算式的括號演算法**——語言中立，住在核心。
 *
 * ## 為什麼在這裡
 *
 * 這段邏輯原本只有一份，住在 `languages/cpp/core/generators/expressions.ts`
 * ——而**那個檔自己的註解就說了它不屬於 C++**：
 *
 * > 「`precedence`／`genChild` 是**共用的排版演算法**……而那不屬於任何一顆元件。」
 *
 * 🔴 它不屬於任何一顆元件是對的，而它也不屬於任何一個**語言**：
 * 「子運算式的優先級比我低就加括號」在每一個中綴語言都成立。
 * **各語言不同的是【數字】，而數字是元件自己宣告的。**
 *
 * ⚠️ C++ 那份**還沒搬過來**（9 個檔在 import 它，而搬移要另開一刀）。
 * 兩份的差別只有一個：那份問 C++ 的過渡表，這份只問膠囊的宣告。
 * **已膠囊化的元件兩份答案相同。**
 */
import type { SemanticNode } from '../types'
import { componentTraits } from '../component/traits'
import { generateExpression } from './code-generator'
import type { NodeGenerator } from './code-generator'

interface PrecedenceByOperator {
  default: number
  rules: { ops: string[]; p: number }[]
}

/**
 * 這個節點的優先級——固定的（`traits.precedence`）或隨運算子而變的
 * （`traits.precedenceByOperator`）。
 *
 * 回 `100` 的意思是「**不需要括號**」（字面值、變數參照…），**不是「不知道」**。
 */
export function precedence(node: SemanticNode | undefined): number {
  if (!node) return 100
  const t = componentTraits(node.componentId)
  if (t?.precedence !== undefined) return t.precedence as number
  const byOperator = t?.precedenceByOperator as PrecedenceByOperator | undefined
  if (!byOperator) return 100
  const op = String(node.properties?.operator ?? '')
  for (const r of byOperator.rules) if (r.ops.includes(op)) return r.p
  return byOperator.default
}

/** 子運算式的優先級比父低時包括號。 */
export function genChild(
  child: SemanticNode | undefined,
  parentPrec: number,
  ctx: Parameters<NodeGenerator>[1],
): string {
  if (!child) return ''
  const expr = generateExpression(child, ctx)
  return precedence(child) < parentPrec ? `(${expr})` : expr
}
