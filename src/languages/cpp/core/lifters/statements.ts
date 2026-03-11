import type { Lifter } from '../../../../core/lift/lifter'
import { createNode } from '../../../../core/semantic-tree'

export function registerStatementLifters(lifter: Lifter): void {
  // translation_unit — handled by JSON pattern (cpp_translation_unit)
  // compound_statement — handled by JSON pattern (cpp_compound_stmt)
  // if_statement — handled by JSON pattern (cpp_if_statement)
  // while_statement — handled by JSON pattern (cpp_while_statement)

  lifter.register('for_statement', (node, ctx) => {
    // Try to detect counting for-loop pattern: for (int i = from; i < to; i++)
    const initNode = node.childForFieldName('initializer')
    const condNode = node.childForFieldName('condition')
    const updateNode = node.childForFieldName('update')
    const bodyNode = node.childForFieldName('body')

    // Check if it's a simple counting loop
    if (isCountingFor(initNode, condNode, updateNode)) {
      const varName = extractForVarName(initNode)
      const fromNode = extractForFrom(initNode, ctx)
      const toNode = extractForTo(condNode, ctx)
      const inclusive = extractForInclusive(condNode)
      const body = extractBody(bodyNode, ctx)

      return createNode('count_loop', { var_name: varName, inclusive }, {
        from: fromNode ? [fromNode] : [],
        to: toNode ? [toNode] : [],
        body,
      })
    }

    // General three-part for loop
    const body = extractBody(bodyNode, ctx)

    // c_for_loop's INIT/COND/UPDATE are expression inputs, but for-loop parts
    // may lift to statement concepts (var_declare, cpp_compound_assign, etc.)
    // Wrap non-expression concepts as cpp_raw_expression with the source text
    const initSem = wrapForExpr(initNode, ctx)
    const condSem = wrapForExpr(condNode, ctx)
    const updateSem = wrapForExpr(updateNode, ctx)

    return createNode('cpp_for_loop', {}, {
      init: initSem ? [initSem] : [],
      cond: condSem ? [condSem] : [],
      update: updateSem ? [updateSem] : [],
      body,
    })
  })

  // function_definition now handled by liftStrategy "cpp:liftFunctionDef"

  // break_statement, continue_statement — handled by JSON patterns (cpp_break, cpp_continue)

  // switch statement
  lifter.register('switch_statement', (node, ctx) => {
    const condNode = node.childForFieldName('condition')
    const bodyNode = node.childForFieldName('body')

    const cond = condNode ? ctx.lift(condNode) : null
    // Body is a compound_statement containing case_statements
    const caseNodes = bodyNode?.namedChildren.filter(
      c => c.type === 'case_statement'
    ) ?? []
    const cases = caseNodes.map(c => liftCaseStatement(c, ctx)).filter(Boolean) as import('../../../../core/types').SemanticNode[]

    return createNode('cpp_switch', {}, {
      expr: cond ? [cond] : [],
      cases,
    })
  })

  // do_statement — handled by JSON pattern (cpp_do_while)
  // condition_clause — handled by JSON unwrap pattern (cpp_unwrap_condition_clause)
}

function extractBody(node: import('../../../../core/lift/types').AstNode | null, ctx: import('../../../../core/lift/types').LiftContext): import('../../../../core/types').SemanticNode[] {
  if (!node) return []
  const lifted = ctx.lift(node)
  if (!lifted) return []
  // If it's a compound statement, unwrap the body
  if (lifted.concept === '_compound') {
    return lifted.children.body ?? []
  }
  return [lifted]
}

/**
 * Lift a case_statement into cpp_case or cpp_default.
 * tree-sitter: case_statement has a `value` field for regular cases, none for default.
 * Body statements are the remaining named children after the value.
 */
function liftCaseStatement(
  node: import('../../../../core/lift/types').AstNode,
  ctx: import('../../../../core/lift/types').LiftContext,
): import('../../../../core/types').SemanticNode | null {
  const valueNode = node.childForFieldName('value')
  const isDefault = !valueNode

  // Body = all named children except the value
  const bodyChildren = node.namedChildren.filter(c => c !== valueNode)
  const body = ctx.liftChildren(bodyChildren)

  if (isDefault) {
    return createNode('cpp_default', {}, { body })
  }

  const value = ctx.lift(valueNode!)
  return createNode('cpp_case', {}, {
    value: value ? [value] : [],
    body,
  })
}

function isCountingFor(
  init: import('../../../../core/lift/types').AstNode | null,
  cond: import('../../../../core/lift/types').AstNode | null,
  update: import('../../../../core/lift/types').AstNode | null,
): boolean {
  if (!init || !cond || !update) return false
  // init should be a declaration like "int i = 0"
  if (init.type !== 'declaration') return false
  // cond should be "i < N"
  if (cond.type !== 'binary_expression') return false
  const condOp = cond.children.find(c => !c.isNamed)?.text
  if (condOp !== '<' && condOp !== '<=') return false
  // update should be "i++", "++i", or "i += 1"
  if (!isCountingUpdate(update)) return false
  // Verify all three parts use the same variable
  const varName = extractForVarName(init)
  const condLeft = cond.childForFieldName('left')?.text
  const updateVar = extractUpdateVar(update)
  if (condLeft !== varName || updateVar !== varName) return false
  return true
}

function extractForVarName(init: import('../../../../core/lift/types').AstNode | null): string {
  if (!init) return 'i'
  const decl = init.namedChildren.find(c => c.type === 'init_declarator')
  if (decl) {
    const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
    return nameNode?.text ?? 'i'
  }
  return 'i'
}

function extractForFrom(init: import('../../../../core/lift/types').AstNode | null, ctx: import('../../../../core/lift/types').LiftContext): import('../../../../core/types').SemanticNode | null {
  if (!init) return null
  const decl = init.namedChildren.find(c => c.type === 'init_declarator')
  if (decl) {
    const valueNode = decl.childForFieldName('value') ?? decl.namedChildren[1]
    if (valueNode) return ctx.lift(valueNode)
  }
  return null
}

function extractForTo(cond: import('../../../../core/lift/types').AstNode | null, ctx: import('../../../../core/lift/types').LiftContext): import('../../../../core/types').SemanticNode | null {
  if (!cond) return null
  const rightNode = cond.childForFieldName('right')
  if (rightNode) return ctx.lift(rightNode)
  return null
}

function extractForInclusive(cond: import('../../../../core/lift/types').AstNode | null): string {
  if (!cond) return 'FALSE'
  const op = cond.children.find(c => !c.isNamed)?.text
  return op === '<=' ? 'TRUE' : 'FALSE'
}

/** Check if update is a counting increment: i++, ++i, or i += 1 */
function isCountingUpdate(update: import('../../../../core/lift/types').AstNode | null): boolean {
  if (!update) return false
  if (update.type === 'update_expression') return true
  // i += 1 — tree-sitter C++ uses assignment_expression for compound assignments
  if (update.type === 'assignment_expression' || update.type === 'augmented_assignment_expression') {
    const op = update.children.find(c => !c.isNamed)?.text
    const right = update.childForFieldName('right')
    return op === '+=' && right?.text === '1'
  }
  return false
}

/** Extract variable name from an update expression (i++, ++i, i += 1) */
function extractUpdateVar(update: import('../../../../core/lift/types').AstNode | null): string | undefined {
  if (!update) return undefined
  if (update.type === 'update_expression') {
    return update.namedChildren[0]?.text
  }
  if (update.type === 'assignment_expression' || update.type === 'augmented_assignment_expression') {
    return update.childForFieldName('left')?.text
  }
  return undefined
}

// Concepts that can be used in for-loop init/cond/update positions
const FOR_LOOP_CONCEPTS = new Set([
  // expressions
  'number', 'number_literal', 'string', 'string_literal', 'boolean', 'var_ref', 'cpp_raw_expression',
  'arithmetic', 'compare', 'logic', 'logic_not', 'negate',
  'func_call_expr', 'array_access', 'cpp_ternary',
  // statements valid in for-loop parts
  'var_declare', 'var_assign', 'cpp_compound_assign', 'cpp_increment', 'array_assign',
  'cpp_comma_expr', 'cpp_cast',
])

/** Lift a for-loop part (init/cond/update) and wrap non-expression concepts as cpp_raw_expression */
function wrapForExpr(
  node: import('../../../../core/lift/types').AstNode | null,
  ctx: import('../../../../core/lift/types').LiftContext,
): import('../../../../core/types').SemanticNode | null {
  if (!node) return null
  const lifted = ctx.lift(node)
  if (!lifted) return null
  // If the lifted concept is a known expression, keep it
  if (FOR_LOOP_CONCEPTS.has(lifted.concept)) return lifted
  // Otherwise wrap as raw expression text (statements, unresolved, etc.)
  // Strip trailing semicolons — for-loop parts don't need them
  return createNode('cpp_raw_expression', { code: node.text.replace(/;\s*$/, '').trim() })
}
