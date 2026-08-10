/** `cpp:break` 的 **generate** 路——從共用檔原封剪過來（批次第十二批：lift 是一整筆 pattern）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:break', (_node, ctx) => `${indent(ctx)}break;\n`)
}
