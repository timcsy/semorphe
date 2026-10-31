/** `cpp:math_pow` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 函式庫的函式：Cella 依名字解析（`using namespace std;` 下不帶前綴的也對到內建，四之十）；沒有模型的由支援清單擋
  r.expr('cpp:math_pow', (n, f) => f.k('eCall', { n: n.id, f: 'pow', args: [f.exprOf(n, 'base'), f.exprOf(n, 'exponent')] }))
}
