import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'
import { extractPrintf, extractScanf } from '../std/cstdio/lifters'
import { tryCmathLift } from '../std/cmath/lifters'

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

    // C++ named casts: static_cast<T>(expr), dynamic_cast<T>(expr), etc.
    if (funcNode?.type === 'template_function') {
      const castName = funcNode.namedChildren.find(c => c.type === 'identifier')?.text
      const templateArgs = funcNode.namedChildren.find(c => c.type === 'template_argument_list')
      const targetType = templateArgs ? templateArgs.text.slice(1, -1) : 'int' // strip < >
      const castConcepts: Record<string, string> = {
        'static_cast': 'cpp_static_cast',
        'dynamic_cast': 'cpp_dynamic_cast',
        'reinterpret_cast': 'cpp_reinterpret_cast',
        'const_cast': 'cpp_const_cast',
      }
      if (castName && castConcepts[castName]) {
        const argNodes = argsNode?.namedChildren ?? []
        const value = argNodes.length > 0 ? ctx.lift(argNodes[0]) : null
        return createNode(castConcepts[castName], { target_type: targetType }, {
          value: value ? [value] : [],
        })
      }
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })
}
