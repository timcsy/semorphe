import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp:strlen', (node, ctx) => {
    const str = generateExpression((node.children.str ?? [])[0], ctx)
    return `strlen(${str})`
  })

  g.set('cpp:strcmp', (node, ctx) => {
    const s1 = generateExpression((node.children.s1 ?? [])[0], ctx)
    const s2 = generateExpression((node.children.s2 ?? [])[0], ctx)
    return `strcmp(${s1}, ${s2})`
  })

  g.set('cpp:strcpy', (node, ctx) => {
    const dest = generateExpression((node.children.dest ?? [])[0], ctx)
    const src = generateExpression((node.children.src ?? [])[0], ctx)
    return `${indent(ctx)}strcpy(${dest}, ${src});\n`
  })

  g.set('cpp:strcat', (node, ctx) => {
    const dest = generateExpression((node.children.dest ?? [])[0], ctx)
    const src = generateExpression((node.children.src ?? [])[0], ctx)
    return `${indent(ctx)}strcat(${dest}, ${src});\n`
  })

  g.set('cpp:strncpy', (node, ctx) => {
    const dest = generateExpression((node.children.dest ?? [])[0], ctx)
    const src = generateExpression((node.children.src ?? [])[0], ctx)
    const n = generateExpression((node.children.n ?? [])[0], ctx)
    return `${indent(ctx)}strncpy(${dest}, ${src}, ${n});\n`
  })

  g.set('cpp:strncmp', (node, ctx) => {
    const s1 = generateExpression((node.children.s1 ?? [])[0], ctx)
    const s2 = generateExpression((node.children.s2 ?? [])[0], ctx)
    const n = generateExpression((node.children.n ?? [])[0], ctx)
    return `strncmp(${s1}, ${s2}, ${n})`
  })

  g.set('cpp:strchr', (node, ctx) => {
    const str = generateExpression((node.children.str ?? [])[0], ctx)
    const ch = generateExpression((node.children.ch ?? [])[0], ctx)
    return `strchr(${str}, ${ch})`
  })

  g.set('cpp:strstr', (node, ctx) => {
    const haystack = generateExpression((node.children.haystack ?? [])[0], ctx)
    const needle = generateExpression((node.children.needle ?? [])[0], ctx)
    return `strstr(${haystack}, ${needle})`
  })

  g.set('cpp:memset', (node, ctx) => {
    const ptr = generateExpression((node.children.ptr ?? [])[0], ctx)
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    const size = generateExpression((node.children.size ?? [])[0], ctx)
    return `${indent(ctx)}memset(${ptr}, ${value}, ${size});\n`
  })

  g.set('cpp:memcpy', (node, ctx) => {
    const dest = generateExpression((node.children.dest ?? [])[0], ctx)
    const src = generateExpression((node.children.src ?? [])[0], ctx)
    const size = generateExpression((node.children.size ?? [])[0], ctx)
    return `${indent(ctx)}memcpy(${dest}, ${src}, ${size});\n`
  })
}
