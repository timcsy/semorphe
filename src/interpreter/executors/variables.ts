import type { ConceptExecutor } from '../executor-registry'
import { defaultValue } from '../types'

export const execVarDeclare: ConceptExecutor = async (node, ctx) => {
  // Multi-variable declaration: int a, b, c;
  // var_declare has type, var_declarator children inherit it
  const declarators = node.children.declarators
  if (declarators && declarators.length > 0) {
    const parentType = String(node.properties.type || 'int')
    for (const decl of declarators) {
      // Propagate parent type to declarator if it doesn't have its own
      if (!decl.properties.type) decl.properties.type = parentType
      await ctx.executeNode(decl)
    }
    return
  }

  const name = String(node.properties.name)
  const type = String(node.properties.type || 'int')

  const init = node.children.initializer
  if (init && init.length > 0) {
    let val = await ctx.evaluate(init[0])
    val = ctx.coerceType(val, type)
    ctx.scope.declare(name, val)
  } else {
    ctx.scope.declare(name, defaultValue(type))
  }
}

export function registerVariableExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {

  register('var_declare', execVarDeclare)

  register('var_assign', async (node, ctx) => {
    const name = String(node.properties.name)
    const valueNodes = node.children.value
    if (!valueNodes || valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    ctx.scope.set(name, val)
  })

  register('var_ref', async (node, ctx) => {
    const name = String(node.properties.name)
    return ctx.scope.get(name)
  })

  // Reference: aliases the original variable (simplified: just copies value)
}
