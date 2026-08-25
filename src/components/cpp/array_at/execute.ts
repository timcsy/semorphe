/** `cpp:array_at` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { defaultValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  // 🔴 **與執行器同一個生命週期**——左值解析要用到執行環境，
  //    而「這種節點可以被寫回」與「這種節點怎麼求值」是同一顆元件的兩面。
  registerLvalue()

  register('cpp:array_at', async (node, ctx) => {
      const name = String(node.properties.obj)
      const indexNodes = node.children.index
      if (!indexNodes || indexNodes.length === 0) return defaultValue('int')

      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)
      const container = ctx.scope.get(name)

      // String subscript: s[i] returns char
      if (container.type === 'string' && typeof container.value === 'string') {
        if (index < 0 || index >= container.value.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
        }
        return { type: 'char', value: container.value[index] }
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      return container.value[index]
    })
}

/**
 * **我可以被寫回**——下標存取（`a[i]`）。
 *
 * ⚠️ **索引在解析的當下求一次值，之後不再求**——
 * `swap(a[i], a[j])` 若在寫回時重新求 `i`，中途被改掉的 `i` 會讓它寫到別格。
 *
 * 🟢 **巢狀自然成立**：`a[i][j]` 的容器是 `a[i]`，而求它的值回傳的是
 * **同一個陣列**（值型別用參照語義）——所以這裡先問接點、再退回名字。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:array_at', async (node, ctx: ExecutionContext) => {
    // 先問接點（`a[i][j]` 的外層容器是一顆節點），沒有才退回字串屬性。
    const objNode = (node.children.obj ?? [])[0]
    const name = String(node.properties.obj ?? '')
    const container = objNode ? await ctx.evaluate(objNode) : ctx.scope.get(name)
    if (container.type !== 'array' || !Array.isArray(container.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name || '這個東西'} 不是容器` })
    }
    const idxNode = (node.children.index ?? [])[0]
    const idx = idxNode ? Math.trunc(ctx.toNumber(await ctx.evaluate(idxNode))) : 0
    const cells = container.value as RuntimeValue[]
    if (idx < 0 || idx >= cells.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(idx) })
    }
    return { read: () => cells[idx], write: (v) => { cells[idx] = v as RuntimeValue } }
  })
}
