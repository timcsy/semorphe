/** `cpp:increment` 的 **generate** 路——從共用檔原封剪過來（批次第三十四批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:increment', (node, ctx) => {
      // ⚠️ **這三個大寫退路不是死的——不要刪。** 我刪過一次，來回轉換當場紅。
      //
      // 大寫是**積木欄位名**，而 `cpp_increment` 的 `renderMapping` 沒有 `fields`
      // 對應，所以抽取器產出的就是大寫鍵。真正的修法是把對應宣告出來，
      // 而那要連同「`properties` 會驅動 `deriveRenderMapping`」一起處理——
      // 見 specs/102-param-spec/research.md 決定 6。
      const name = (node.properties.name ?? node.properties.NAME ?? 'i') as string
      const op = (node.properties.operator ?? node.properties.OP ?? '++') as string
      const pos = (node.properties.position ?? node.properties.POSITION ?? 'postfix') as string
      // Array element increment: arr[i]++
      const indexNodes = node.children.index ?? []
      if (indexNodes.length > 0) {
        const idx = generateExpression(indexNodes[0], ctx)
        const expr = pos === 'prefix' ? `${op}${name}[${idx}]` : `${name}[${idx}]${op}`
        if (ctx.isExpression) return expr
        return `${indent(ctx)}${expr};\n`
      }
      const expr = pos === 'prefix' ? `${op}${name}` : `${name}${op}`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    })
}
