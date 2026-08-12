/**
 * `cpp:string_find_first_not_of` 的 **execute** 路
 *
 * 找**第一個／最後一個不屬於**那組字元的位置——常用來去頭尾空白。
 *
 * ⚠️ 找不到時回 **-1**，不是 C++ 的 `string::npos`（4294967295）。
 * 理由（092）：**使用者常寫 `!= -1` 來比**，而回 npos 的話那個比較
 * 永遠成立，迴圈停不下來。回 -1 讓兩種寫法都對。
 */
import type { RuntimeValue } from '../../../interpreter/types'
import type { SemanticNode } from '../../../core/types'

const findFromTail = false

export function registerExecute(
  register: (id: string, fn: (node: SemanticNode, ctx: any) => Promise<RuntimeValue | void>) => void,
): void {
  register('cpp:string_find_first_not_of', async (node, ctx) => {
    const str = String(ctx.scope.get(String(node.properties.obj)).value)
    const argNodes = node.children.arg ?? []
    if (argNodes.length === 0) return { type: 'int', value: -1 }
    const set = new Set(String((await ctx.evaluate(argNodes[0])).value))
    const idxs = [...str].map((c, i) => (set.has(c) ? -1 : i)).filter((i) => i >= 0)
    return { type: 'int', value: idxs.length === 0 ? -1 : findFromTail ? idxs[idxs.length - 1] : idxs[0] }
  })
}
