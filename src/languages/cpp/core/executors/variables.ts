/**
 * variables 的語言專屬執行路——10 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../../interpreter/executors/variables'

export function registerVariablesCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {


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
      ctx.scope.declare(name, { type: 'int', value: 0 })
    }
  })

  // typedef and using alias are type declarations — no runtime effect

  register('cpp_typedef', async () => {})

  register('cpp_using_alias', async () => {})

  register('cpp_ref_declare', execVarDeclare)

  // Static: persists across calls (simplified: same as var_declare in interpreter)

  register('cpp_static_declare', execVarDeclare)

  // Static member: declaration only, noop

  register('cpp_static_member', async () => {})
}
