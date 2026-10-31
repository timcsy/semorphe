/** `cpp:eeprom_write` 的 **formalize** 路：`EEPROM.write(idx, val)`，接收者是 eConst "EEPROM"（cella 2026-10-31）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:eeprom_write', (n, f) =>
    f.k('eMCall', { n: n.id, obj: f.k('eConst', { n: `${n.id}/obj`, name: 'EEPROM' }), arrow: false, f: 'write', args: [f.exprOf(n, 'address'), f.exprOf(n, 'value')] }))
  r.stmt('cpp:eeprom_write', (n, f) => f.exprStmt(n))
}
