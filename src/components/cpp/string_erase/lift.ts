/**
 * `cpp:string_erase` 的 **lift** 路——**一個帶真邏輯的分支**
 *
 * 判別本身是這顆元件的知識（引數個數／函式名的多種寫法），不是路由器的知識。
 * 回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

export function registerLift(): void {
  registerMethodBranch('cpp/string_erase', (obj, method, argChildren, ctx): SemanticNode | null => {
    if (method !== 'erase') return null
    if (argChildren.length >= 2) {
        const pos = ctx.lift(argChildren[0])
        const len = ctx.lift(argChildren[1])
        return createNode('cpp:string_erase', { obj }, {
          pos: pos ? [pos] : [],
          len: len ? [len] : [],
        })
      }
      return null // 1 arg → container erase (handled by METHOD_TO_COMPONENT)
  })
}
