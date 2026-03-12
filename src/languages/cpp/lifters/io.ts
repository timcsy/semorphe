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

    // cstdlib functions
    const argChildren = argsNode?.namedChildren ?? []
    if (funcName === 'rand') {
      return createNode('cpp_rand', {})
    }
    if (funcName === 'srand') {
      const seed = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_srand', {}, { seed: seed ? [seed] : [] })
    }
    if (funcName === 'abs') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_abs', {}, { value: value ? [value] : [] })
    }
    if (funcName === 'exit') {
      const code = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_exit', {}, { code: code ? [code] : [] })
    }

    // cctype functions
    const cctypeFuncs: Record<string, string> = {
      'isalpha': 'cpp_isalpha', 'isdigit': 'cpp_isdigit',
      'toupper': 'cpp_toupper', 'tolower': 'cpp_tolower',
    }
    if (funcName in cctypeFuncs) {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode(cctypeFuncs[funcName], {}, { value: value ? [value] : [] })
    }

    // swap
    if (funcName === 'swap' || funcName === 'std::swap') {
      const a = argChildren[0]?.text ?? 'a'
      const b = argChildren[1]?.text ?? 'b'
      return createNode('cpp_swap', { a, b })
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })
}
