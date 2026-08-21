/**
 * `python:array_make_for` 的 **execute** 路。
 *
 * ⚠️ **那個名字只在這個運算式裡活著**——跑完要還原。
 * 不還原的話 `[x for x in xs]` 之後外面的 `x` 會變成最後一格的值，
 * 而那與 Python 的行為不同（Python 3 的生成式有自己的作用域）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { SemanticNode } from '../../../core/types'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:array_make_for', async (node, ctx) => {
    const out: RuntimeValue[] = []
    // 🔴 **由外而內走**：`outer` 鏈是從內指向外的，所以先攤成「外→內」的順序
    const levels: { name: string; src: SemanticNode }[] = []
    for (let c = (node.children.outer ?? [])[0]; c; c = (c.children.outer ?? [])[0]) {
      levels.unshift({ name: String(c.properties.obj ?? 'row'), src: c.children.iterable[0] })
    }
    levels.push({ name: String(node.properties.obj ?? 'x'), src: node.children.iterable[0] })

    /** 走第 `depth` 層；走到最裡面時算一格出來。 */
    const walk = async (depth: number): Promise<void> => {
      if (depth === levels.length) {
        const cond = (node.children.condition ?? [])[0]
        if (cond && !ctx.toBool(await ctx.evaluate(cond))) return
        out.push(await ctx.evaluate(node.children.expression[0]))
        return
      }
      const { name, src } = levels[depth]
      const seq = await ctx.evaluate(src)
      const items: RuntimeValue[] | null =
        seq.type === 'array' ? [...(seq.value as RuntimeValue[])]
        : seq.type === 'string' ? [...String(seq.value)].map((c) => ({ type: 'string' as const, value: c }))
        : seq.type === 'object' ? [...(seq.value as ObjectFields).keys()].map((k) => ({ type: 'string' as const, value: k }))
        : null
      if (!items) {
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `這種東西走訪不了（${seq.type}）` })
      }
      const had = ctx.scope.has(name)
      const saved = had ? ctx.scope.get(name) : null
      try {
        for (const it of items) {
          if (ctx.scope.has(name)) ctx.scope.set(name, it)
          else ctx.scope.declare(name, it)
          await walk(depth + 1)
        }
      } finally {
        // 還原——見檔頭：那個名字只在這個運算式裡活著
        if (had && saved) ctx.scope.set(name, saved)
      }
    }

    await walk(0)
    return { type: 'array', value: out }
  })
}
