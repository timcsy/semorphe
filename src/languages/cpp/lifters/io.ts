import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'
import type { AstNode, LiftContext } from '../../../core/lift/types'

export function registerIOLifters(lifter: Lifter): void {
  lifter.register('call_expression', (node, ctx) => {
    const funcNode = node.childForFieldName('function')
    const argsNode = node.childForFieldName('arguments')
    const funcName = funcNode?.text ?? ''

    // printf("...", args)
    if (funcName === 'printf') {
      return extractPrintf(argsNode, ctx)
    }

    // scanf("...", &args)
    if (funcName === 'scanf') {
      return extractScanf(argsNode)
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })

  // cout << x << endl  →  this appears as a nested binary_expression with <<
  // But binary_expression is already registered for arithmetic/compare/logic
  // We need to handle the << operator specially for cout
  // tree-sitter parses "cout << x << endl" as nested binary_expression with "<<"
  // We register a post-processor in the lifter for this

  // Handle "expression_statement" wrapping shift expressions (cout/cin)
  // The expression_statement lifter is in declarations.ts, but we need to
  // check for cout/cin patterns in the binary_expression handler

  // Actually, "cout << x" is parsed as binary_expression with operator "<<"
  // We need to intercept this. Let me register a wrapper that checks first.
}

function extractPrintf(argsNode: AstNode | null, ctx: LiftContext) {
  if (!argsNode) return createNode('print', {}, { values: [] })
  const args = argsNode.namedChildren
  // Skip format string, lift remaining args
  const values = args.slice(1).map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
  return createNode('print', {}, { values })
}

function extractScanf(argsNode: AstNode | null) {
  if (!argsNode) return createNode('input', {}, { values: [createNode('var_ref', { name: 'x' })] })
  const args = argsNode.namedChildren
  // Extract ALL variable names from &var args (skip format string at index 0)
  if (args.length >= 2) {
    const values = args.slice(1).map(varArg => {
      // &x → unary_expression with & operator, child is identifier
      const varName = varArg.type === 'unary_expression'
        ? (varArg.namedChildren[0]?.text ?? 'x')
        : varArg.text
      return createNode('var_ref', { name: varName })
    })
    return createNode('input', {}, { values })
  }
  return createNode('input', {}, { values: [createNode('var_ref', { name: 'x' })] })
}
