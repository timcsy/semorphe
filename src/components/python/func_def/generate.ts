/** `python:func_def` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateBody } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:func_def', (node, ctx) => {
    const name = String(node.properties.name ?? 'f')
    // ⚠️ **參數是結構節點不是字串**（spec 169）——每一顆帶一個 `name`。
    // 🔴 帶預設值的參數多一格（2026-08-21）——`greeting="hi"`。
    const params = (node.children.params ?? [])
      .map((p) => {
        const n = String(p.properties.name ?? '')
        // 🔴 星號是**標記**不是名字的一部分——見 lift 那一側的理由
        const star = p.properties.variadic === 'list' ? '*' : ''
        const t = String(p.properties.type ?? '')
        const d = String(p.properties.default ?? '')
        if (!n) return ''
        // ⚠️ 帶型別註記時預設值兩邊有空格（`b: str = "x"`），沒有型別時沒有（`b="x"`）
        //    ——那是 PEP 8，而使用者寫的就是那樣。
        const head = t ? `${n}: ${t}` : `${star}${n}`
        return d ? (t ? `${head} = ${d}` : `${head}=${d}`) : head
      })
      .filter(Boolean)
    const body = node.children.body ?? []
    const inner = indented(ctx)
    const bodyCode = body.length > 0 ? generateBody(body, inner) : `${indent(inner)}pass\n`
    const returns = String(node.properties.returns ?? '')
    return `${indent(ctx)}def ${name}(${params.join(', ')})${returns ? ` -> ${returns}` : ''}:\n${bodyCode}`
  })
}
