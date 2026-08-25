/**
 * `python:container_at` 的 **execute** 路——串列、字典、字串各一種取法。
 *
 * 🔴 **取不到就丟錯，不回預設值**：Python 的 `nums[99]` 是 IndexError、
 * `d["沒有"]` 是 KeyError。回一個 0 或空字串的話，錯誤會被帶到下一步去算，
 * 而畫面上看不出哪裡開始錯的。
 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { dictSet } from '../../../languages/python/dict'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('python:container_at', async (node, ctx) => {
    const target = await ctx.evaluate(node.children.target[0])
    const key = await ctx.evaluate(node.children.key[0])

    if (target.type === 'object') {
      const fields = target.value as ObjectFields
      const k = String(key.value)
      const got = fields.get(k)
      if (got === undefined) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': k })
      return got
    }

    // 串列與字串共用「負數從尾巴算」的規則（Python 的 `a[-1]`）
    const len = target.type === 'string' ? String(target.value).length : (target.value as RuntimeValue[]).length
    let i = Math.trunc(ctx.toNumber(key))
    if (i < 0) i += len
    if (i < 0 || i >= len) throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(key.value) })
    if (target.type === 'string') return { type: 'string', value: String(target.value)[i] }
    return (target.value as RuntimeValue[])[i]
  })
}

/**
 * **我可以被寫回**——容器的一格（`a[0]`／`d[k]`／`grid[1][1]`）。
 *
 * 🔴 **求值的是「容器」那一格，不是整個左邊**：整個左邊求值會**讀出**那一格的值。
 * 🟢 **巢狀因此自然成立**：`grid[1][1]` 的容器是 `grid[1]`，而它又是一顆
 * `container_at`——求它的值回傳的是**同一個串列**（值型別用參照語義）。
 *
 * ⚠️ **字典可以用指派新增一個鍵，串列不行**——那是 Python 的規則，
 * 而兩者在這裡是同一個節點型別，所以判別在**執行期看容器是什麼**。
 * 🔴 而讀與寫的規則不同：讀不到的鍵**讀**要丟 `KEY_NOT_FOUND`，**寫**要新增。
 */
export function registerLvalue(): void {
  declareLvalue('python:container_at', async (node, ctx: ExecutionContext) => {
    const container = await ctx.evaluate(node.children.target[0])
    const key = await ctx.evaluate(node.children.key[0])

    if (container.type === 'object') {
      const fields = container.value as ObjectFields
      const k = String(key.value)
      return {
        read: () => {
          const got = fields.get(k)
          if (got === undefined) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': k })
          return got
        },
        // ⚠️ **走 `dictSet`**——它同時記住那個鍵原本長什麼樣（`count[3]` 的 3 是整數）
        write: (v) => { dictSet(container, key, v as never) },
      }
    }
    if (container.type !== 'array') {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個東西不能用位置存進去' })
    }
    const xs = container.value as RuntimeValue[]
    let i = Math.trunc(ctx.toNumber(key))
    if (i < 0) i += xs.length
    // 🔴 **串列不能用指派長出新的一格**（Python 是 IndexError）
    if (i < 0 || i >= xs.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(key.value) })
    }
    return { read: () => xs[i], write: (v) => { xs[i] = v as RuntimeValue } }
  })
}
