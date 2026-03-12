import type { Lifter } from '../../../../core/lift/lifter'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import type { SemanticNode } from '../../../../core/types'
import { createNode } from '../../../../core/semantic-tree'

const UNARY_FUNCS = new Set([
  'abs', 'fabs', 'sqrt', 'cbrt',
  'ceil', 'floor', 'round', 'trunc',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'exp', 'log', 'log2', 'log10',
])

const BINARY_FUNCS = new Set([
  'fmod', 'hypot', 'atan2', 'fmin', 'fmax',
])

/**
 * Try to lift a call_expression as a cmath function.
 * Returns a SemanticNode if the function name matches, null otherwise.
 * Called from the central call_expression dispatcher (lifters/io.ts).
 */
export function tryCmathLift(
  funcName: string,
  argsNode: AstNode | null,
  ctx: LiftContext,
): SemanticNode | null {
  const liftArgs = () =>
    argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is SemanticNode => n !== null)
      : []

  // pow — dedicated concept (also handled by astPattern, but this is the hand-written path)
  if (funcName === 'pow') {
    const args = liftArgs()
    return createNode('cpp:math_pow', {}, {
      base: args[0] ? [args[0]] : [],
      exponent: args[1] ? [args[1]] : [],
    })
  }

  // Unary math functions
  if (UNARY_FUNCS.has(funcName)) {
    const args = liftArgs()
    // Normalize fabs → abs
    const normalizedFunc = funcName === 'fabs' ? 'abs' : funcName
    return createNode('cpp:math_unary', { func: normalizedFunc }, {
      value: args[0] ? [args[0]] : [],
    })
  }

  // Binary math functions
  if (BINARY_FUNCS.has(funcName)) {
    const args = liftArgs()
    return createNode('cpp:math_binary', { func: funcName }, {
      arg1: args[0] ? [args[0]] : [],
      arg2: args[1] ? [args[1]] : [],
    })
  }

  return null
}

export function registerLifters(_lifter: Lifter): void {
  // cmath lifting is handled by tryCmathLift(), called from the
  // central call_expression dispatcher in lifters/io.ts.
  // We don't register a separate call_expression lifter here to avoid
  // overwriting the existing dispatcher.
}
