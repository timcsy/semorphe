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

    // std::accumulate / accumulate
    if (funcName === 'accumulate' || funcName === 'std::accumulate') {
      const argChildren = argsNode ? argsNode.namedChildren : []
      const beginText = argChildren[0]?.text ?? 'v.begin()'
      const endText = argChildren[1]?.text ?? 'v.end()'
      const initChild = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_accumulate', { begin: beginText, end: endText }, {
        init: initChild ? [initChild] : [],
      })
    }

    // std::make_pair / make_pair
    if (funcName === 'make_pair' || funcName === 'std::make_pair') {
      const argChildren = argsNode ? argsNode.namedChildren : []
      const firstChild = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const secondChild = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_make_pair', {}, {
        first: firstChild ? [firstChild] : [],
        second: secondChild ? [secondChild] : [],
      })
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })
}
