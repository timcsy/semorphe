import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_ifstream_declare', (node) => {
    const name = (node.properties.name as string) ?? 'fin'
    const file = (node.properties.file as string) ?? 'input.txt'
    return `std::ifstream ${name}("${file}");`
  })

  g.set('cpp_ofstream_declare', (node) => {
    const name = (node.properties.name as string) ?? 'fout'
    const file = (node.properties.file as string) ?? 'output.txt'
    return `std::ofstream ${name}("${file}");`
  })
}
