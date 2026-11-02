/** `cpp:cstring_append` 的 **formalize** 路（spec 202：`strcat(...)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式庫的函式：Cella 依名字解析；沒有模型的由支援清單擋（判 unknown，不是假錯）
  r.expr('cpp:cstring_append', (n, f) => f.k('eCall', { n: n.id, f: 'strcat', args: [f.exprOf(n, 'dest'), f.exprOf(n, 'src')] }))
  r.stmt('cpp:cstring_append', (n, f) => f.exprStmt(n))
}
