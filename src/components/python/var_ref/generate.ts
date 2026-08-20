/** `python:var_ref` 的 **generate** 路——名字原樣輸出。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_ref', (node) => String(node.properties.name ?? ''))
}
