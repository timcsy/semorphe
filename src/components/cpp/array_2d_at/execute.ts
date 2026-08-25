/** `cpp:array_2d_at` 的 **execute** 路——從共用檔原封剪過來（批次第十四批：subscript_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { defaultValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
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

/**
 * **我可以被寫回**——二維的一格（`a[i][j] += 1`）。
 *
 * ⚠️ 兩個索引都在**解析的當下**求一次值，之後不再求。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:array_2d_at', async (node, ctx: ExecutionContext) => {
    const name = String(node.properties.obj)
    const rowNodes = node.children.row ?? []
    const colNodes = node.children.col ?? []
    if (!rowNodes.length || !colNodes.length) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name}（缺一個索引）` })
    }
    const row = Math.trunc(ctx.toNumber(await ctx.evaluate(rowNodes[0])))
    const col = Math.trunc(ctx.toNumber(await ctx.evaluate(colNodes[0])))
    const arr = ctx.scope.get(name)
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    const rowArr = (arr.value as RuntimeValue[])[row]
    if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
    }
    const cells = rowArr.value as RuntimeValue[]
    if (col < 0 || col >= cells.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(col) })
    }
    return { read: () => cells[col], write: (v) => { cells[col] = v as RuntimeValue } }
  })
}
