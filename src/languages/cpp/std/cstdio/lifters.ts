import { createNode } from '../../../../core/semantic-tree'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import type { Lifter } from '../../../../core/lift/lifter'

export function registerCstdioLifters(_lifter: Lifter): void {
  // call_expression dispatching is handled by the IO lifter dispatcher
  // (lifters/io.ts) because lifter.register overwrites — cannot split
  // printf/scanf/general func_call into separate registrations.
  // This module exports the extraction functions instead.
}

export function extractPrintf(argsNode: AstNode | null, ctx: LiftContext) {
  if (!argsNode) return createNode('cpp_printf', { format: '' }, { args: [] })
  const args = argsNode.namedChildren
  const formatStr = args[0]?.text?.replace(/^"|"$/g, '') ?? '%d\\n'
  const values = args.slice(1).map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
  return createNode('cpp_printf', { format: formatStr }, { args: values })
}

export function extractScanf(argsNode: AstNode | null, ctx: LiftContext) {
  if (!argsNode) return createNode('cpp_scanf', { format: '%d' }, { args: [createNode('var_ref', { name: 'x' })] })
  const args = argsNode.namedChildren
  const formatStr = args[0]?.text?.replace(/^"|"$/g, '') ?? '%d'
  const values = args.slice(1).map(varArg => {
    if (varArg.type === 'unary_expression' || varArg.type === 'pointer_expression') {
      const inner = varArg.namedChildren[0]
      if (inner?.type === 'subscript_expression') {
        const lifted = ctx.lift(inner)
        if (lifted) return lifted
      }
      const varName = inner?.text ?? 'x'
      return createNode('var_ref', { name: varName })
    }
    const rawText = varArg.text
    const varName = rawText.startsWith('&') ? rawText.slice(1) : rawText
    return createNode('var_ref', { name: varName })
  })
  return createNode('cpp_scanf', { format: formatStr }, { args: values })
}
