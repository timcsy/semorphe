/**
 * `cpp:vector_declare` 的 **generate** 路
 *
 * 從 `src/languages/cpp/std/vector/generators.ts` **原封搬過來**——搬移不重寫。
 * 註解一起搬，因為那兩段註解各自記著一個真的發生過的缺陷。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:vector_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'vec'
    // 初始化列表要一起產回去。**少了它的話，來回轉換會靜靜地把
    // `vector<int> v = {3,1,4}` 變成 `vector<int> v;`**——那是合法程式，
    // 只是不是使用者寫的那一段。
    const values = node.children.values ?? []
    if (values.length > 0) {
      const items = values.map((v) => generateExpression(v, ctx)).join(', ')
      return `${indent(ctx)}vector<${type}> ${name} = {${items}};\n`
    }
    // 初始值是一整個運算式（`= f()`）——與上面同一個病，同一個處方
    const source = (node.children.source ?? [])[0]
    if (source) {
      return `${indent(ctx)}vector<${type}> ${name} = ${generateExpression(source, ctx)};\n`
    }
    return `${indent(ctx)}vector<${type}> ${name};\n`
  })
}
