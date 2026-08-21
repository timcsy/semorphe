/**
 * `python:map_make_for` 的 **execute** 路。
 *
 * ⚠️ **那些名字只在這個運算式裡活著**——跑完要還原（與同族的串列生成式同一條）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

// 🔴 「鍵原本長什麼樣」只有一份——見那個模組的檔頭。
import { dictKeyOf, makeDict } from '../../../languages/python/dict'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:map_make_for', async (node, ctx) => {
    const names = (node.children.targets ?? []).map((t) => String(t.properties.name ?? ''))
    const seq = await ctx.evaluate(node.children.iterable[0])
    const items: RuntimeValue[] =
      seq.type === 'array' ? [...(seq.value as RuntimeValue[])]
      : seq.type === 'object' ? [...(seq.value as ObjectFields).keys()].map((k) => ({ type: 'string' as const, value: k }))
      : []

    const saved = new Map(names.filter((n) => ctx.scope.has(n)).map((n) => [n, ctx.scope.get(n)]))
    const out: ObjectFields = new Map()
    const keys = new Map<string, RuntimeValue>()
    try {
      for (const it of items) {
        if (names.length > 1) {
          const parts = it.type === 'array' ? (it.value as RuntimeValue[]) : null
          // 🔴 拆不開就丟錯——補 None 會讓真的錯誤看起來像跑成功
          if (!parts || parts.length !== names.length) {
            throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
              '%1': `每一圈要拆成 ${names.length} 格`,
            })
          }
          names.forEach((n, i) => (ctx.scope.has(n) ? ctx.scope.set(n, parts[i]) : ctx.scope.declare(n, parts[i])))
        } else {
          ctx.scope.has(names[0]) ? ctx.scope.set(names[0], it) : ctx.scope.declare(names[0], it)
        }
        const cond = (node.children.condition ?? [])[0]
        if (cond && !ctx.toBool(await ctx.evaluate(cond))) continue
        const k = await ctx.evaluate(node.children.key[0])
        out.set(dictKeyOf(k), await ctx.evaluate(node.children.value[0]))
        keys.set(dictKeyOf(k), k)
      }
    } finally {
      for (const [n, v] of saved) ctx.scope.set(n, v)
    }
    return makeDict(out, keys)
  })
}
