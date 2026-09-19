/** `cpp:array_2d_declare` 的 **execute** 路——從共用檔原封剪過來（批次第十七批：宣告子分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_2d_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      const type = String(node.properties.type || 'int')
      /**
       * 🔴 **維度求值，不再把一串文字丟給 `Number`**（2026-09-19）。
       *
       * `Number('x*2')` 是 `NaN`，而 `for (let i = 0; i < NaN; i++)` 一次都不跑
       * ——於是那個陣列**零列**，而錯誤出現在下一行的 `d2[i][j]`。
       *
       * > **一個錯誤訊息指著最後一個碰到它的人，而不是造成它的人。**
       */
      const dim = async (slot: string): Promise<number> => {
        const n = (node.slots[slot] ?? [])[0]
        if (!n) return 0
        const v = await ctx.evaluate(n)
        const x = Math.trunc(ctx.toNumber(v))
        return Number.isFinite(x) && x > 0 ? x : 0
      }
      const rows = await dim('rows')
      const cols = await dim('cols')

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
      const init = node.slots.values ?? []
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
