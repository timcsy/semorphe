/** `cpp:func_def` 的 **generate** 路——從共用檔原封剪過來（批次第四十二批：樹根與進入點）。 */
import type { StylePreset } from '../../../core/types'
import { openBraceFor, formatParams } from '../../../languages/cpp/lang/generators/statements'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = openBraceFor(style)
  g.set('cpp:func_def', (node, ctx) => {
      const name = node.properties.name ?? 'f'
      const returnType = node.properties.return_type ?? 'void'
      const paramChildren = node.slots.params ?? []
      // 參數串（預設值、陣列參數的 `[]` 寫在名字後面）與建構子、方法共用同一支（第 331 刀併成一份）
      const paramStr = formatParams(paramChildren)
      const body = node.slots.body ?? []
      const header = `${indent(ctx)}${returnType} ${name}(${paramStr})${openBrace(ctx)}\n`
      trackOwnText(ctx, header)
      let code = header
      code += generateBody(body, indented(ctx))
      code += `${indent(ctx)}}\n`
      return code
    })
}
