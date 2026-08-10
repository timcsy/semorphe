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





  // enum is a type declaration — no runtime effect


}
