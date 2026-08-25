/** `cpp:pointer_deref` 的 **execute** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('cpp:pointer_deref', async (node, ctx) => {
      const ptrNodes = node.children.ptr ?? []
      if (ptrNodes.length > 0) {
        const ptrVal = await ctx.evaluate(ptrNodes[0])
        if (ptrVal.type === ('pointer' as any) && typeof ptrVal.value === 'string') {
          const targetName = ptrVal.value
          const targetScope = ctx.pointerTargets.get(targetName)
          if (targetScope) return targetScope.get(targetName)
          return ctx.scope.get(targetName)
        }
        // `int* a = new int;` —— `cpp:new` 配的是**一塊真的儲存體**，
        // 而在這個直譯器裡一塊連續的儲存體就是 `array`（見 `cpp:new` 的執行器）。
        // `*a` 就是它的第 0 格。
        //
        // ⚠️ 兩種指標並存是刻意的：`&x` 那種是**符號式**的（指向一個變數名，
        // 走 `pointerTargets`），`new`／`malloc` 那種是**實體式**的（有自己的格子）。
        // 合成一種要一個真的堆與位址模型，而那是另一個題目。
        if (ptrVal.type === 'array' && Array.isArray(ptrVal.value)) {
          // ⚠️ `offset` 是 `&arr[i]` 留下的位置（見 `cpp:address_of`）。未設 = 0。
          const at = ptrVal.offset ?? 0
          if (at < 0 || at >= ptrVal.value.length) {
            throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(at) })
          }
          return ptrVal.value[at]
        }
        // ⚠️ **不是指標卻被解參考——出聲，不要回 0。**
        //
        // 這裡原本 `return { type: 'int', value: 0 }`，與 spec 109 的 `s.size()`
        // 同一族：**辨識的錯躲在執行的回退後面**。`*x` 在 `x` 不是指標時
        // 印出 0，與「指向的值真的是 0」在畫面上一模一樣。
        //
        // ⚠️ 第三十三條護欄**看不見它**——它是尾端的**無條件** return，
        // 而那條護欄只抓「檢查失敗後」的回退。
        // > **一條護欄的能力邊界，就是它抓不到的缺陷活下來的地方。**
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'pointer' })
      }
      // ptr 子節點缺失＝語義樹壞掉，與別處的缺子節點退路同形（防禦性）。
      return { type: 'int', value: 0 }
    })
}

/**
 * **我可以被寫回**——`*p = 1`／`*p += 1`。
 *
 * ⚠️ **兩種指標並存**（見上面執行器的說明）：符號式的走 `pointerTargets`，
 * 實體式的（`new`／`malloc` 配的）是一塊 `array`，`*p` 是它的第 `offset` 格。
 * 兩種都要寫得回去，而**寫回的位置在解析當下定住**。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:pointer_deref', async (node, ctx: ExecutionContext) => {
    const ptrNodes = node.children.ptr ?? []
    if (ptrNodes.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個解參考沒有指標' })
    }
    const ptrVal = await ctx.evaluate(ptrNodes[0])
    if (ptrVal.type === ('pointer' as never) && typeof ptrVal.value === 'string') {
      const targetName = ptrVal.value
      const owner = ctx.pointerTargets.get(targetName) ?? ctx.scope
      return {
        read: () => owner.get(targetName),
        write: (v) => { owner.set(targetName, v as RuntimeValue) },
      }
    }
    if (ptrVal.type === 'array' && Array.isArray(ptrVal.value)) {
      const cells = ptrVal.value as RuntimeValue[]
      const at = ptrVal.offset ?? 0
      if (at < 0 || at >= cells.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(at) })
      }
      return { read: () => cells[at], write: (v) => { cells[at] = v as RuntimeValue } }
    }
    // ⚠️ **不是指標卻被解參考——出聲**（與求值那一側同一個判斷）
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'pointer' })
  })
}
