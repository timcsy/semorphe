/**
 * `cpp:range_sort` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 *
 * ⚠️ **兩個引數與三個引數是同一顆身分**——第三個是比較器，而
 * 「按什麼順序」是**參數不是身分**（與 `container_push` 把容器種類當參數同形）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerCallBranch('cpp/range_sort', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (funcName !== 'sort' && funcName !== 'std::sort' && funcName !== 'stable_sort' && funcName !== 'std::stable_sort') {
      return null
    }
    if (argChildren.length !== 2 && argChildren.length !== 3) return null
    const beginText = argChildren[0]?.text ?? 'v.begin()'
    const endText = argChildren[1]?.text ?? 'v.end()'
    // 比較器是**一個運算式**（lambda 或函式名），所以它是接點不是屬性
    // ——與 `begin`／`end` 不同：那兩個今天是文字，因為迭代器範圍還沒結構化。
    const cmp = argChildren[2] ? ctx.lift(argChildren[2]) : null
    return cmp
      ? createNode('cpp:range_sort', { begin: beginText, end: endText }, { comparator: [cmp] })
      : createNode('cpp:range_sort', { begin: beginText, end: endText })
  })
}
