import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_stringstream_declare', (node, ctx) => {
    const name = (node.properties.name as string) ?? 'ss'
    return `${indent(ctx)}stringstream ${name};\n`
  })
}
