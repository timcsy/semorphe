/** `cpp:array_2d_declare` 的 **execute** 路——從共用檔原封剪過來（批次第十七批：宣告子分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:array_2d_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      const type = String(node.properties.type || 'int')
      const rows = Number(node.properties.rows || 0)
      const cols = Number(node.properties.cols || 0)

      const elements: import('../../../interpreter/types').RuntimeValue[] = []
      for (let i = 0; i < rows; i++) {
        const row: import('../../../interpreter/types').RuntimeValue[] = []
        for (let j = 0; j < cols; j++) {
          row.push(defaultValue(type))
        }
        elements.push({ type: 'array', value: row })
      }

      // 初始值：`int a[2][3] = {{1,2,3},{4,5,6}}`——每一項是一層 `{…}`。
      // ⚠️ **逐格填而不是整列換掉**：`{{1,2}}` 只給了兩格，
      // 其餘的必須保持型別預設值（C++ 的規則），整列換掉會讓第三格消失。
      const init = node.children.values ?? []
      for (let i = 0; i < init.length && i < elements.length; i++) {
        const rowVal = await evalInitializer(init[i], type, ctx)
        const row = elements[i].value as import('../../../interpreter/types').RuntimeValue[]
        if (rowVal.type === 'array' && Array.isArray(rowVal.value)) {
          for (let j = 0; j < rowVal.value.length && j < row.length; j++) row[j] = rowVal.value[j]
        }
      }

      ctx.scope.declare(name, { type: 'array', value: elements })
    })
}
