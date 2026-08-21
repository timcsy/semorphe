/**
 * `python:array_make_for` 的 **execute** 路。
 *
 * ⚠️ **那個名字只在這個運算式裡活著**——跑完要還原。
 * 不還原的話 `[x for x in xs]` 之後外面的 `x` 會變成最後一格的值，
 * 而那與 Python 的行為不同（Python 3 的生成式有自己的作用域）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:array_make_for', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'x')
    const seq = await ctx.evaluate(node.children.iterable[0])
    const items: RuntimeValue[] =
      seq.type === 'array' ? [...(seq.value as RuntimeValue[])]
      : seq.type === 'string' ? [...String(seq.value)].map((c) => ({ type: 'string' as const, value: c }))
      : seq.type === 'object' ? [...(seq.value as ObjectFields).keys()].map((k) => ({ type: 'string' as const, value: k }))
      : null as never
    if (!items) {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `這種東西走訪不了（${seq.type}）` })
    }

    const had = ctx.scope.has(name)
    const saved = had ? ctx.scope.get(name) : null
    const out: RuntimeValue[] = []
    try {
      for (const it of items) {
        if (ctx.scope.has(name)) ctx.scope.set(name, it)
        else ctx.scope.declare(name, it)
        const cond = (node.children.condition ?? [])[0]
        if (cond && !ctx.toBool(await ctx.evaluate(cond))) continue
        out.push(await ctx.evaluate(node.children.expression[0]))
      }
    } finally {
      // 還原——見檔頭：那個名字只在這個運算式裡活著
      if (had && saved) ctx.scope.set(name, saved)
    }
    return { type: 'array', value: out }
  })
}
