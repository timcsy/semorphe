/** `cpp:time` 的 **generate** 路——`time(0)`：現在的時間（秒）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:time', () => 'time(0)')
}
