/** `cpp:string_size` 的 **generate** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Expression components — return expression string (no indent, no newline)
    g.set('cpp:string_size', (node) => {
      const obj = node.properties.obj ?? 'str'
      return `${obj}.length()`
    })
}
