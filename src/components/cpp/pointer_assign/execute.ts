/**
 * `cpp:pointer_assign` 的 **execute** 路——`*p = v`
 *
 * ## ⚠️ 它原本在型別不符時**靜默 return**
 *
 * 舊版只有一個 `if (ptrVal.type === 'pointer' && …)`，**沒有 else**：
 * `*x = 5` 在 `x` 不是指標時什麼都不做，而畫面上與「寫成功了」一模一樣。
 *
 * 那與同族的 `pointer_deref` 相反——那一顆早就改成丟錯了，它的註解逐字：
 * 「**不是指標卻被解參考——出聲，不要回 0**」。
 *
 * > **同一族的兩顆元件，一顆會出聲一顆不會——而它們錯的是同一件事。**
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:pointer_assign', async (node, ctx) => {
    const ptrName = String(node.properties.obj)
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const ptrVal = ctx.scope.get(ptrName)

    // 符號式指標：`int x; int* p = &x; *p = 7`
    if (ptrVal.type === ('pointer' as any) && typeof ptrVal.value === 'string') {
      const targetName = ptrVal.value as string
      const targetScope = ctx.pointerTargets.get(targetName)
      if (targetScope) targetScope.set(targetName, val)
      else ctx.scope.set(targetName, val)
      return
    }

    // 實體式指標：`int* a = new int; *a = 15`
    // ——`cpp:new` 配的儲存體是一個陣列，`*a` 是它的第 0 格。
    if (ptrVal.type === 'array' && Array.isArray(ptrVal.value)) {
      // ⚠️ `offset` 是 `&arr[i]` 留下的位置（見 `cpp:address_of`）。未設 = 0。
      const at = ptrVal.offset ?? 0
      if (at < 0 || at >= ptrVal.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(at) })
      }
      // ⚠️ 就地改，不是換一個新陣列——`int* b = a; *b = 9;` 之後 `*a` 必須也是 9。
      ;(ptrVal.value as unknown[])[at] = val
      return
    }

    // ⚠️ 出聲。見檔頭：靜默 return 讓「寫失敗」與「寫成功」在畫面上相同。
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'pointer' })
  })
}
