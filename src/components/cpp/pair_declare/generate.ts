/** `cpp:pair_declare` 的 **generate** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pair_declare', (node, ctx) => {
      const type1 = (node.properties.type1 as string) ?? 'int'
      const type2 = (node.properties.type2 as string) ?? 'int'
      const name = (node.properties.name as string) ?? 'p'
      // `pair<int,string> p = make_pair(42, "hi")` —— 初始值是一整個運算式。
      // ⚠️ 它原本**兩邊對稱地被丟掉**（辨識掉、產生也掉），所以來回轉換比對
      // 一直是綠的——一個對稱的資料遺失，比不對稱的難發現。
      const source = (node.children.source ?? [])[0]
      if (source) {
        return `${indent(ctx)}pair<${type1}, ${type2}> ${name} = ${generateExpression(source, ctx)};\n`
      }
      return `${indent(ctx)}pair<${type1}, ${type2}> ${name};\n`
    })
}
