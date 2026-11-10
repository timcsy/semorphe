/** `python:string_upper` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { genReceiver } from '../../../core/projection/precedence'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_upper', (node, ctx) => {
    const o = genReceiver((node.slots.obj ?? [])[0], ctx)
    
    return `${o}.upper()`
  })
}
