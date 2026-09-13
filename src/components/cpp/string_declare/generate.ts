/** `cpp:string_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十六批：型別名資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement components — return full line with indent and newline
    g.set('cpp:string_declare', (node, ctx) => {
      const name = node.properties.name ?? 'str'
      const initNodes = node.slots.initializer ?? []
      // 🔴 **兩個引數是建構子，不是賦值**（2026-09-10）
      //
      // `string s(n, '0');`（n 個 '0'）在此之前只讀第一個引數，產出
      // `string s = n;`——**編不過，而且意思完全不同**。
      //
      // > **一個只讀 `[0]` 的產生器，在接點裝得下兩個的時候不會出聲。**
      if (initNodes.length >= 2) {
        const args = initNodes.map((a) => generateExpression(a, ctx)).join(', ')
        return `${indent(ctx)}string ${name}(${args});\n`
      }
      if (initNodes.length > 0) {
        const val = generateExpression(initNodes[0], ctx)
        return `${indent(ctx)}string ${name} = ${val};\n`
      }
      return `${indent(ctx)}string ${name};\n`
    })
}
