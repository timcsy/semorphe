import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {












  g.set('cpp:cstring_find_char', (node, ctx) => {
    const str = generateExpression((node.children.str ?? [])[0], ctx)
    const ch = generateExpression((node.children.ch ?? [])[0], ctx)
    return `strchr(${str}, ${ch})`
  })

  g.set('cpp:cstring_find', (node, ctx) => {
    const haystack = generateExpression((node.children.haystack ?? [])[0], ctx)
    const needle = generateExpression((node.children.needle ?? [])[0], ctx)
    return `strstr(${haystack}, ${needle})`
  })




}
