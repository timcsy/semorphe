/** `cpp:range_remap` 的 **formalize** 路：Arduino core 的 `long map(long, long, long, long, long)`，一般函式呼叫（cella 2026-10-31）。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:range_remap', (n, f) => f.call(n, 'map', ['value', 'from_low', 'from_high', 'to_low', 'to_high']))
}
