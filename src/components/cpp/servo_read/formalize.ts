/** `cpp:servo_read` 的 **formalize** 路：Servo 的 `int read()`（cella 2026-10-31）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:servo_read', (n, f) => f.mcall(n, 'read', []))
}
