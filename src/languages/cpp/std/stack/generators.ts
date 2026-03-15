import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts — return expression string (no indent, no newline)
  g.set('cpp_stack_top', (node) => {
    const obj = node.properties.obj ?? 'stk'
    return `${obj}.top()`
  })

  // Statement concepts — return full line with indent and newline
  g.set('cpp_stack_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'stk'
    return `${indent(ctx)}stack<${type}> ${name};\n`
  })
}
