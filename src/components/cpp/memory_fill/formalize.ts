/** `cpp:memory_fill` 的 **formalize** 路（spec 202：`memset(...)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式庫的函式：Cella 依名字解析；沒有模型的由支援清單擋（判 unknown，不是假錯）
  r.expr('cpp:memory_fill', (n, f) => f.k('eCall', { n: n.id, f: 'memset', args: [f.exprOf(n, 'ptr'), f.exprOf(n, 'value'), f.exprOf(n, 'size')] }))
  r.stmt('cpp:memory_fill', (n, f) => f.exprStmt(n))
}
