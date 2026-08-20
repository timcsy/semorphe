/**
 * `cpp:container_iter` 的 **execute** 路
 *
 * 迭代器在這個直譯器裡就是**實體式指標**：一個陣列 ＋ 一個 `offset`
 * ——與 `&arr[i]`／`new int[n]` 完全相同的表示（見 `cpp:address_of`）。
 *
 * > **不為迭代器發明第三種表示。** 指標算術（`it + 1`）、解參考（`*it`）、
 * > 相減（`it - v.begin()`）在那個表示上全都已經能跑。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_iter', async (node, ctx) => {
    const name = String(node.properties.obj)
    const which = String(node.properties.which ?? 'begin')
    const v = ctx.scope.get(name)
    if (v.type !== 'array' || !Array.isArray(v.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是容器` })
    }
    // ⚠️ `end()` 指的是**尾端之後一格**——那是 C++ 的慣例，而且合法：
    // 只有解參考它才是錯的，而那由 `pointer_deref` 檢查。
    return { type: 'array', value: v.value, offset: which === 'end' ? v.value.length : 0 }
  })
}
