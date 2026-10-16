/** `python:literal_string` 的 **generate** 路——`"hi"`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { quoteBody } from './body'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // 🔴 積木上打的字不經過 lift，裸的 `"` 要補跳脫——見 `body.ts`
  g.set('python:literal_string', (node, _ctx) => `"${quoteBody(String(node.properties.value ?? ''))}"`)
}
