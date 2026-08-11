/**
 * 指標的執行路——語言核心的第五面牆。
 *
 * 指標不屬於任何標準函式庫標頭，所以歸語言核心，與 `core/generators/`、
 * `core/lifters/` 並列。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

export function registerPointerExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:address_of', async (node, ctx) => {
    const varNodes = node.children.var ?? []
    if (varNodes.length > 0) {
      const varName = String(varNodes[0].properties.name ?? '')
      if (varName) {
        ctx.pointerTargets.set(varName, ctx.scope.findOwner(varName) ?? ctx.scope)
        return { type: 'pointer' as any, value: varName }
      }
    }
    return { type: 'int', value: 0 }
  })

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

  register('cpp:pointer_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'ptr')
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = await ctx.evaluate(inits[0])
      ctx.scope.declare(name, val)
    } else {
      ctx.scope.declare(name, { type: 'pointer' as any, value: null })
    }
  })





  register('cpp:malloc', async (node) => {
    // ⚠️ 退路是 `int*` 不是 `int`——`type` 在這顆元件裡是**轉型型別**（指標），
    // 產生器寫的是 `(${type})malloc(…)`。兩邊曾經不一致，而積木下拉當時給的
    // 是元素型別，於是使用者選 `int` 會產出 `(int)malloc(…)`，不合法的 C++。
    return { type: 'pointer' as any, value: `heap_${node.properties.type ?? 'int*'}` }
  })




}
