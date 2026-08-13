/**
 * `cpp:vector_make` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * `vector<int>(3, 7)` 在 AST 裡是一個 `call_expression`，而被呼叫的
 * 「函式」是 `template_type`——所以路由器看到的 `funcName` 就是 `vector<int>`。
 *
 * ⚠️ 第一版用 `registerAstBranch('call_expression', …)`，而**那條路沒有人問**：
 * `tryAstBranches` 只在 `subscript_expression` 與 `field_expression` 被呼叫。
 * 症狀是登錄成功、分支從未執行——**一個沒有人問的判別與沒有寫是一樣的**。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/vector_make', (funcName, argChildren, ctx): SemanticNode | null => {
    const m = /^(?:std::)?vector\s*<(.+)>$/.exec(funcName.trim())
    if (!m) return null
    // ⚠️ **只認兩種**：`vector<T>(n)`（n 個預設值）與 `vector<T>(n, x)`（n 個 x）。
    // 三個以上是迭代器範圍建構——**判不出來就說不是我**，落到殘差比猜好。
    if (argChildren.length > 2) return null
    const size = argChildren[0] ? ctx.lift(argChildren[0]) : null
    const fill = argChildren[1] ? ctx.lift(argChildren[1]) : null
    return createNode('cpp:vector_make', { type: m[1].trim() }, {
      size: size ? [size] : [],
      fill: fill ? [fill] : [],
    })
  })
}
