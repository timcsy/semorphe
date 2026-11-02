/** `cpp:cstring_find_char` 的 **formalize** 路（spec 202）——`strchr(s, c)`，照 generate 送函式呼叫；回的是指向陣列中間的指標（Cella 的記憶體模型表示得了）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式庫的函式：Cella 依名字解析；沒有模型的由 Cella 判 unknown（不在這側猜）
  r.expr('cpp:cstring_find_char', (n, f) => f.k('eCall', { n: n.id, f: 'strchr', args: [f.exprOf(n, 'str'), f.exprOf(n, 'ch')] }))
}
