/** `cpp:math_max` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式庫的函式：Cella 依名字解析（`using namespace std;` 下不帶前綴的也對到內建，四之十）；沒有模型的由支援清單擋
  // `max({a, b, c})` 只填了 a：送一個引數（同 generate.ts 的「不得補第二個」）——第 213 刀前空著的 b 被送成 eHole，
  // Cella 於是判 unknown「a braced list where the type it initializes is not known」（cella 照同一支程式重現時發現）
  r.expr('cpp:math_max', (n, f) => f.k('eCall', { n: n.id, f: 'max', args: f.one(n, 'a') && !f.one(n, 'b') ? [f.exprOf(n, 'a')] : [f.exprOf(n, 'a'), f.exprOf(n, 'b')] }))
}
