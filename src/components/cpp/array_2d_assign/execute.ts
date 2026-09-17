/** `cpp:array_2d_assign` 的 **execute** 路——從共用檔原封剪過來（批次第十批：assignment_expression 的分支）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_2d_assign', async (node, ctx) => {
      const name = String(node.properties.obj)
      const rowNodes = node.slots.row
      const colNodes = node.slots.col
      const valueNodes = node.slots.value
      if (!rowNodes?.length || !colNodes?.length || !valueNodes?.length) return

      const row = ctx.toNumber(await ctx.evaluate(rowNodes[0]))
      const col = ctx.toNumber(await ctx.evaluate(colNodes[0]))
      const val = await ctx.evaluate(valueNodes[0])
      const arr = receiverOf(ctx.scope, name)

      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      const rowArr = arr.value[row]
      if (!rowArr || rowArr.type !== 'array' || !Array.isArray(rowArr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(row) })
      }
      /**
       * 🔴 **列內也要範圍檢查**（2026-09-17，模糊測試抓到的）。
       *
       * 一維那顆早就在檢查了，而這裡沒有——於是 `g[0][1] = 5` 在一個**空的**
       * 列上寫第 1 格，JS 幫忙把陣列補長，而**第 0 格是一個洞**。
       *
       * ```
       * vector<map<int,int>> g(2);
       * g[0][1] = 5;          ← 這裡留下洞
       * g[0].count(1);        ← 這裡才爆，而且是 JS 的 TypeError：
       *                          Cannot read properties of undefined (reading 'type')
       * ```
       *
       * > **一個沒有範圍檢查的寫入，它的症狀不會出現在寫入那一行
       * > ——會出現在下一個走訪那個容器的人身上，而且是另一種語言的錯誤。**
       *
       * ⚠️ 而那個洞是**真的洞**（JS 的稀疏陣列），不是一個預設值：
       *    任何一個「每一格都是 RuntimeValue」的假設都會在它上面碎掉。
       */
      if (col < 0 || col >= rowArr.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(col) })
      }
      rowArr.value[col] = val
    })
}
