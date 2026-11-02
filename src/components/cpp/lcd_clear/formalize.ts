/** `cpp:lcd_clear` 的 **formalize** 路：LiquidCrystal 的 `clear()`（spec 203；cella 的 `arduino.libraries.avr.liquidcrystal` 有模型）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:lcd_clear', (n, f) => f.mcall(n, 'clear', []))
  r.stmt('cpp:lcd_clear', (n, f) => f.exprStmt(n))
}
