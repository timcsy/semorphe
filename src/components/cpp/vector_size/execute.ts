/** `cpp:vector_size` 的 **execute** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /**
     * `v.size()`
     *
     * ⚠️ **原本非陣列一律回 0**，而那讓兩件事無法區分：
     * 「這個容器是空的」與「**這根本不是容器**」。
     *
     * 而它掩蓋掉的是一個**辨識**缺陷：`s.size()` 在字串上也被辨識成
     * `cpp:vector_size`，拿到字串 → 回 0 → `for (i=0; i<s.size(); i++)`
     * **一次都不跑**、字串原樣輸出、沒有任何訊號。19 筆誤差裡的 5 筆是這個。
     *
     * 現在分三路：**容器算長度、字串算字元數、其餘出聲。**
     * 字串那一路是 `.size()` 與 `.length()` 在 C++ 裡本來就同義——
     * 在這裡收掉，比在辨識層多寫一條判別更靠近真相（同一個概念，兩種寫法）。
     */
    register('cpp:vector_size', async (node, ctx) => {
      const name = String(node.properties.obj)
      const v = ctx.scope.get(name)
      if (v.type === 'array' && Array.isArray(v.value)) return { type: 'int', value: v.value.length }
      if (v.type === 'string') return { type: 'int', value: String(v.value).length }
      // **出聲，不要回 0。** 空容器的 0 與「不是容器」的 0 分不出來時，
      // 上游的辨識缺陷就沒有任何地方會叫。
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `${name}（型別 ${v.type}）沒有 size()`,
      })
    })
}
