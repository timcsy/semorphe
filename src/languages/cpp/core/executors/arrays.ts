/**
 * arrays 的語言專屬執行路——4 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { defaultValue } from '../../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

export function registerArraysCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:array_2d_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    const rows = Number(node.properties.rows || 0)
    const cols = Number(node.properties.cols || 0)

    const elements: import('../../../../interpreter/types').RuntimeValue[] = []
    for (let i = 0; i < rows; i++) {
      const row: import('../../../../interpreter/types').RuntimeValue[] = []
      for (let j = 0; j < cols; j++) {
        row.push(defaultValue(type))
      }
      elements.push({ type: 'array', value: row })
    }
    ctx.scope.declare(name, { type: 'array', value: elements })
  })

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



  // enum is a type declaration — no runtime effect


}
