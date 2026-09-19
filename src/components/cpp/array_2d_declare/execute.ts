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
      /**
       * 🔴 **元素型別是一個【已宣告的結構】時，每一格要是一個結構實例**
       *（2026-09-19）——**一維那顆 2026-09-04 就修過，而這顆漏了同一行**。
       *
       * 症狀：`struct P{int a;}; P g[2][2]; g[1][1].a = 5;` 丟
       * 「接收者不是一個結構（它是 int）」——而 lift 與產碼都是對的。
       *
       * > **同一個病修在一維而沒有修在二維，
       * > 那不是「還沒做到」——是那兩個地方各寫了一次同樣的迴圈。**
       *
       * ⚠️ 判準與一維那顆**一字不差**（`ctx.structs.has(type)`）：
       * `struct P` 與 `P` 都交給 `structs` 自己認，這裡不再剝一次前綴。
       */
      const isStruct = ctx.structs.has(type)
      for (let i = 0; i < rows; i++) {
        const row: import('../../../interpreter/types').RuntimeValue[] = []
        for (let j = 0; j < cols; j++) {
          row.push(isStruct ? ctx.structs.instantiate(type) : defaultValue(type))
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
