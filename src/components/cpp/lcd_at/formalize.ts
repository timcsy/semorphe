/** `cpp:lcd_at` 的 **formalize** 路：LiquidCrystal_I2C 的 `setCursor(col, row)`（cella 2026-10-31）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:lcd_at', (n, f) => f.mcall(n, 'setCursor', ['col', 'row']))
  r.stmt('cpp:lcd_at', (n, f) => f.exprStmt(n))
}
