import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // Expression concepts — return expression string (no indent, no newline)
  g.set('cpp_string_length', (node) => {
    const obj = node.properties.obj ?? 'str'
    return `${obj}.length()`
  })

  g.set('cpp_string_substr', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const posNodes = node.children.pos ?? []
    const lenNodes = node.children.len ?? []
    const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
    const len = lenNodes.length > 0 ? generateExpression(lenNodes[0], ctx) : ''
    return len ? `${obj}.substr(${pos}, ${len})` : `${obj}.substr(${pos})`
  })

  g.set('cpp_string_find', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const argNodes = node.children.arg ?? []
    const arg = argNodes.length > 0 ? generateExpression(argNodes[0], ctx) : '""'
    return `${obj}.find(${arg})`
  })

  g.set('cpp_string_c_str', (node) => {
    const obj = node.properties.obj ?? 'str'
    return `${obj}.c_str()`
  })

  g.set('cpp_string_empty', (node) => {
    const obj = node.properties.obj ?? 'str'
    return `${obj}.empty()`
  })

  g.set('cpp_to_string', (node, ctx) => {
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '0'
    return `to_string(${val})`
  })

  g.set('cpp_stoi', (node, ctx) => {
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
    return `stoi(${val})`
  })

  g.set('cpp_stod', (node, ctx) => {
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
    return `stod(${val})`
  })

  // Statement concepts — return full line with indent and newline
  g.set('cpp_string_declare', (node, ctx) => {
    const name = node.properties.name ?? 'str'
    return `${indent(ctx)}string ${name};\n`
  })

  g.set('cpp_string_append', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const valueNodes = node.children.value ?? []
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
    return `${indent(ctx)}${obj}.append(${val});\n`
  })

  g.set('cpp_getline', (node, ctx) => {
    const name = node.properties.name ?? 'str'
    return `${indent(ctx)}getline(cin, ${name});\n`
  })

  g.set('cpp_string_erase', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const posNodes = node.children.pos ?? []
    const lenNodes = node.children.len ?? []
    const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
    const len = lenNodes.length > 0 ? generateExpression(lenNodes[0], ctx) : '1'
    return `${indent(ctx)}${obj}.erase(${pos}, ${len});\n`
  })

  g.set('cpp_string_insert', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const posNodes = node.children.pos ?? []
    const valueNodes = node.children.value ?? []
    const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
    return `${indent(ctx)}${obj}.insert(${pos}, ${val});\n`
  })

  g.set('cpp_string_replace', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const posNodes = node.children.pos ?? []
    const lenNodes = node.children.len ?? []
    const valueNodes = node.children.value ?? []
    const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
    const len = lenNodes.length > 0 ? generateExpression(lenNodes[0], ctx) : '0'
    const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
    return `${indent(ctx)}${obj}.replace(${pos}, ${len}, ${val});\n`
  })

  g.set('cpp_string_push_back', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    const charNodes = node.children.char ?? []
    const ch = charNodes.length > 0 ? generateExpression(charNodes[0], ctx) : "'a'"
    return `${indent(ctx)}${obj}.push_back(${ch});\n`
  })

  g.set('cpp_string_clear', (node, ctx) => {
    const obj = node.properties.obj ?? 'str'
    return `${indent(ctx)}${obj}.clear();\n`
  })
}
