/**
 * `cpp:container_iter` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * ⚠️ 兩個方法名（`begin`／`end`）對**同一顆身分**，差別進 `which` 屬性。
 * 那是「哪一端變成參數」這條命名規則的直接後果——與 `container_peek`
 * 用同一個理由：兩者的**紀律相同**（取得一個位置），差的只是哪一端。
 *
 * 用分支而不是 `registerMethodConcept`，因為那張純資料表產不出 `which`
 * ——它只放得下「名字 → 身分」。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/container_iter', (obj, method, argChildren): SemanticNode | null => {
    if (method !== 'begin' && method !== 'end') return null
    // `v.begin(x)` 不是這顆——迭代器取得不吃引數。**判不出來就說不是我。**
    if (argChildren.length > 0) return null
    return createNode('cpp:container_iter', { obj, which: method })
  })
}
