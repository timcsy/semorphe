import type { ConceptExecutor } from '../executor-registry'
import { defaultValue } from '../types'

export function registerVariableExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  const execVarDeclare: ConceptExecutor = async (node, ctx) => {
    // Multi-variable declaration: int a, b, c;
    const declarators = node.children.declarators
    if (declarators && declarators.length > 0) {
      for (const decl of declarators) {
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

  register('var_declare', execVarDeclare)
  register('var_declare_expr', execVarDeclare)

  // const/constexpr/auto declarations behave like var_declare in the interpreter
  register('cpp_const_declare', execVarDeclare)
  register('cpp_constexpr_declare', execVarDeclare)
  register('cpp_auto_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const init = node.children.initializer
    if (init && init.length > 0) {
      const val = await ctx.evaluate(init[0])
      ctx.scope.declare(name, val)
    } else {
      ctx.scope.declare(name, 0)
    }
  })

  // typedef and using alias are type declarations — no runtime effect
  register('cpp_typedef', async () => {})
  register('cpp_using_alias', async () => {})

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
}
