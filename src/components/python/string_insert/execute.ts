/**
 * `python:string_insert` 的 **execute** 路——求值 ＋ 套格式。
 *
 * ## 支援到哪裡，以及**為什麼不多做**
 *
 * 只實作 `.Nf`（小數位數）——它是教學語料裡唯一常見的一種（分數、平均、金額）。
 *
 * 🔴 **而認不得的格式【丟錯】，不是靜默照原樣印**。
 * 靜默的話 `f"{x:>10}"` 會印出沒有補齊的字，而畫面上看不出哪裡不對
 * ——第三十三條護欄要防的就是這種「與合法結果無法區分的預設值」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:string_insert', async (node, ctx) => {
    const value = (node.children.value ?? [])[0]
    const v = value ? await ctx.evaluate(value) : { type: 'string' as const, value: '' }
    const format = String(node.properties.format ?? '')
    if (format === '') return { type: 'string', value: String(v.value) }

    const fixed = /^\.(\d+)f$/.exec(format)
    if (fixed) return { type: 'string', value: ctx.toNumber(v).toFixed(Number(fixed[1])) }

    throw new RuntimeError(RUNTIME_ERRORS.UNSUPPORTED_FORMAT, { '%1': format })
  })
}
