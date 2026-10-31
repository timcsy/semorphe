/** `cpp:eeprom_read` 的 **formalize** 路：`EEPROM.read(idx)`，接收者是標頭的全域物件 eConst "EEPROM"（同 Serial；cella 2026-10-31）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:eeprom_read', (n, f) =>
    f.k('eMCall', { n: n.id, obj: f.k('eConst', { n: `${n.id}/obj`, name: 'EEPROM' }), arrow: false, f: 'read', args: [f.exprOf(n, 'address')] }))
}
