/** `cpp:array_2d_at` 的 **execute** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_2d_at', async (node, ctx) => {
      const name = String(node.properties.obj)
      const rowNodes = node.children.row
      const colNodes = node.children.col
      if (!rowNodes?.length || !colNodes?.length) return defaultValue('int')

      const row = ctx.toNumber(await ctx.evaluate(rowNodes[0]))
      const col = ctx.toNumber(await ctx.evaluate(colNodes[0]))
      const arr = ctx.scope.get(name)

      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      const rowArr = arr.value[row]
      if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
      }
      return rowArr.value[col] ?? defaultValue('int')
    })
}
