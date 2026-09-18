/**
 * `cpp:range_find` 的 **lift** 路——**一個帶真邏輯的分支**（引數個數是判別的一部分）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftRangeEnds } from '../../../languages/cpp/lang/runtime/range-lift'

const NAMES = new Set(['find', 'std::find'])

export function registerLift(): void {
  registerCallBranch('cpp/range_find', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    if (!NAMES.has(funcName)) return null
    /**
     * ⚠️ **引數個數不對就不是我**——猜的話會產出一個引數掉了的節點，
     *    而那在產生器那一路看起來完全正常。
     * ⚠️ 而這幾個名字都很短，使用者自己也寫得出同名的函式
     *    （`int find(int x)`）：判不出來就讓開。
     */
    if (argChildren.length !== 3) return null
    const ends = liftRangeEnds(argChildren, ctx)
    if (!ends) return null
    const value = ctx.lift(argChildren[2])
    if (!value) return null
    return createNode('cpp:range_find', {}, { ...ends, value: [value] })
  })
}
