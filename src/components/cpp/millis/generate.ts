/** `cpp:millis` 的 **generate** 路——零引數的運算式。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:millis', () => 'millis()')
}
