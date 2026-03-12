import type { Lifter } from '../../../core/lift/lifter'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import { extractPrintf, extractScanf } from '../std/cstdio/lifters'
import { tryCmathLift } from '../std/cmath/lifters'

/** Try to lift a method call (field_expression) into a specific concept */
function tryMethodCallLift(
  funcNode: AstNode,
  argsNode: AstNode | null | undefined,
  ctx: LiftContext,
): ReturnType<typeof createNode> | null {
  if (funcNode.type !== 'field_expression') return null

  const objNode = funcNode.childForFieldName('argument')
  const fieldNode = funcNode.childForFieldName('field')
  if (!objNode || !fieldNode) return null

  const obj = objNode.text
  const method = fieldNode.text
  const argChildren = argsNode?.namedChildren ?? []

  // String method calls
  switch (method) {
    case 'length':
    case 'size':
      return createNode('cpp_string_length', { obj })
    case 'substr': {
      const pos = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const len = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_string_substr', { obj }, {
        pos: pos ? [pos] : [],
        len: len ? [len] : [],
      })
    }
    case 'find': {
      const arg = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_string_find', { obj }, {
        arg: arg ? [arg] : [],
      })
    }
    case 'append': {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_string_append', { obj }, {
        value: value ? [value] : [],
      })
    }
    case 'c_str':
      return createNode('cpp_string_c_str', { obj })
    case 'push_back': {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_vector_push_back', { vector: obj }, {
        value: value ? [value] : [],
      })
    }
  }

  // No-arg method calls → expression
  if (argChildren.length === 0) {
    return createNode('cpp_method_call_expr', { obj, method, args: '' })
  }

  // Generic method call with args as text
  const argsText = argsNode ? argsNode.namedChildren.map(a => a.text).join(', ') : ''
  return createNode('cpp_method_call_expr', { obj, method, args: argsText })
}

export function registerIOLifters(lifter: Lifter): void {
  lifter.register('call_expression', (node, ctx) => {
    const funcNode = node.childForFieldName('function')
    const argsNode = node.childForFieldName('arguments')
    const funcName = funcNode?.text ?? ''

    // printf("...", args) → cstdio module
    if (funcName === 'printf') {
      return extractPrintf(argsNode, ctx)
    }

    // scanf("...", &args) → cstdio module
    if (funcName === 'scanf') {
      return extractScanf(argsNode, ctx)
    }

    // cmath functions (pow, sqrt, sin, cos, etc.)
    const cmathResult = tryCmathLift(funcName, argsNode, ctx)
    if (cmathResult) return cmathResult

    // Method calls: obj.method(args) via field_expression
    if (funcNode && funcNode.type === 'field_expression') {
      const methodResult = tryMethodCallLift(funcNode, argsNode, ctx)
      if (methodResult) return methodResult
    }

    // Free string functions: getline, to_string, stoi, stod
    const argChildren = argsNode?.namedChildren ?? []
    if (funcName === 'getline' && argChildren.length >= 2) {
      const nameNode = argChildren[1]
      return createNode('cpp_getline', { name: nameNode?.text ?? 'str' })
    }
    if (funcName === 'to_string' || funcName === 'std::to_string') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_to_string', {}, { value: value ? [value] : [] })
    }
    if (funcName === 'stoi' || funcName === 'std::stoi') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_stoi', {}, { value: value ? [value] : [] })
    }
    if (funcName === 'stod' || funcName === 'std::stod') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_stod', {}, { value: value ? [value] : [] })
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })
}
