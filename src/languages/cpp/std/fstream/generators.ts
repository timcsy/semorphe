import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_ifstream_declare', (node, ctx) => {
    const name = (node.properties.name as string) ?? 'fin'
    const file = (node.properties.file as string) ?? 'input.txt'
    return `${indent(ctx)}ifstream ${name}("${file}");\n`
  })

  g.set('cpp_ofstream_declare', (node, ctx) => {
    const name = (node.properties.name as string) ?? 'fout'
    const file = (node.properties.file as string) ?? 'output.txt'
    return `${indent(ctx)}ofstream ${name}("${file}");\n`
  })
}
