/** `cpp:enum` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:enum', (node, ctx) => {
      const name = String(node.properties.name ?? 'MyEnum')
      const values = node.properties.values ?? ''
      const alias = String(node.properties.typedef_alias ?? '')
      // 有作用域的列舉與底層型別（360）：舊的樹沒有這兩格 ⟹ 一般的 enum
      const scoped = String(node.properties.scoped ?? 'none')
      const base = String(node.properties.base ?? '').trim()
      // scoped 只會是 none／class／struct（lift 與積木下拉都只給這三個）⟹ 照寫；有作用域的寫法只會來自原本就是 C++ 的程式碼
      const kw = scoped && scoped !== 'none' ? `enum ${scoped}` : 'enum'
      const head = `${kw} ${name ? `${name}${base ? ` : ${base}` : ''} ` : base ? `: ${base} ` : ''}{ ${values} }`
      return alias ? `${indent(ctx)}typedef ${head} ${alias};\n` : `${indent(ctx)}${head};\n`
    })
}
