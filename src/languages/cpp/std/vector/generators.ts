import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts — return expression string (no indent, no newline)
  g.set('cpp:vector_size', (node) => {
    const vector = node.properties.obj ?? 'vec'
    return `${vector}.size()`
  })

  g.set('cpp:vector_back', (node) => {
    const vector = node.properties.obj ?? 'vec'
    return `${vector}.back()`
  })

  // Statement concepts — return full line with indent and newline
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

  g.set('cpp:vector_pop_back', (node, ctx) => {
    const vector = node.properties.obj ?? 'vec'
    return `${indent(ctx)}${vector}.pop_back();\n`
  })
}
