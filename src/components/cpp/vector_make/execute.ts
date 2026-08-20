/**
 * `cpp:vector_make` 的 **execute** 路
 *
 * ⚠️ **每一格都要獨立的複本**。`vector<vector<int>> g(2, vector<int>(3, 7))`
 * 如果兩列共用同一個陣列物件，`g[0][0] = 9` 會同時改到 `g[1][0]`
 * ——而那個症狀離現場很遠：程式跑完、印出東西、而它是錯的。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { defaultValue } from '../../../interpreter/types'

/** 深拷貝一個執行期值——陣列與物件要複製，純量共用沒有差別 */
function cloneValue(v: RuntimeValue): RuntimeValue {
  if (v.type === 'array' && Array.isArray(v.value)) {
    return { ...v, value: v.value.map((x) => cloneValue(x as RuntimeValue)) }
  }
  if (v.type === 'object' && v.value instanceof Map) {
    const m = new Map<string, RuntimeValue>()
    for (const [k, x] of v.value) m.set(k, cloneValue(x))
    return { ...v, value: m }
  }
  return { ...v }
}

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:vector_make', async (node, ctx) => {
    const elemType = String(node.properties.type ?? 'int')
    const sizeNode = (node.children.size ?? [])[0]
    const fillNode = (node.children.fill ?? [])[0]
    const n = sizeNode ? Math.trunc(ctx.toNumber(await ctx.evaluate(sizeNode))) : 0
    const fill = fillNode ? await ctx.evaluate(fillNode) : defaultValue(elemType)
    const cells: RuntimeValue[] = []
    for (let i = 0; i < (n > 0 ? n : 0); i++) cells.push(cloneValue(fill))
    return { type: 'array', value: cells, elemType }
  })
}
