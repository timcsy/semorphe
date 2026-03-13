import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts — return expression string (no indent, no newline)
  g.set('cpp_stack_top', (node) => {
    const obj = node.properties.obj ?? 'stk'
    return `${obj}.top()`
  })

  g.set('cpp_stack_empty', (node) => {
    const obj = node.properties.obj ?? 'stk'
    return `${obj}.empty()`
  })

  // Statement concepts — return full line with indent and newline
  g.set('cpp_stack_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'stk'
    return `${indent(ctx)}stack<${type}> ${name};\n`
  })

  g.set('cpp_stack_push', (node, ctx) => {
    const obj = node.properties.obj ?? 'stk'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `${indent(ctx)}${obj}.push(${val});\n`
  })

  g.set('cpp_stack_pop', (node, ctx) => {
    const obj = node.properties.obj ?? 'stk'
    return `${indent(ctx)}${obj}.pop();\n`
  })
}
