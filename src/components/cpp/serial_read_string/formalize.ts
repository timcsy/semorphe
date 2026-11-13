/** `cpp:serial_read_string` 的 **formalize** 路（435）——照 generate 送 eMCall，與「從序列埠讀一個位元組」那一顆同形狀。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:serial_read_string', (n, f) => f.mcall(n, 'readStringUntil', ['until']))
  // 當敘述用（讀了丟掉，清緩衝的寫法）：運算式敘述
  r.stmt('cpp:serial_read_string', (n, f) => f.exprStmt(n))
}
