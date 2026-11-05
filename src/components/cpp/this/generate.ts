/** `cpp:this` 的 **generate** 路——關鍵字本身。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:this', () => 'this')
}
