/** `cpp:memory_copy` 的 **formalize** 路（spec 202：`memcpy(...)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式庫的函式：Cella 依名字解析；沒有模型的由支援清單擋（判 unknown，不是假錯）
  r.expr('cpp:memory_copy', (n, f) => f.k('eCall', { n: n.id, f: 'memcpy', args: [f.exprOf(n, 'dest'), f.exprOf(n, 'src'), f.exprOf(n, 'size')] }))
  r.stmt('cpp:memory_copy', (n, f) => f.exprStmt(n))
}
