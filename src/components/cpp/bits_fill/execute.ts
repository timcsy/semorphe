/** `cpp:bits_fill` 的 **execute** 路——把整排變成 0／1／相反。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:bits_fill', async (node, ctx) => {
    const objNode = (node.slots.obj ?? [])[0]
    const row = objNode ? await ctx.evaluate(objNode) : null
    if (!row || row.type !== 'array' || !Array.isArray(row.value)) {
      /** ⚠️ 訊息要說得出是誰——2026-09-19 因為三句說不出「誰」的訊息花掉一輪。 */
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `這個接收者不是一排位元（它是 ${row ? row.type : '空的'}）`
          + `——「全部歸零／設為 1／反轉」要的是一排位元`,
      })
    }
    /**
     * ⚠️ 那一格裝的是**使用者寫的方法名**（`reset`／`set`／`flip`）——
     * 由共用的方法路由填，見 `component.json` 的 `_properties_why`。
     */
    const method = String(node.properties.method ?? 'reset')
    const cells = row.value as { type: string; value: unknown }[]
    const apply = (c: { value: unknown }): void => {
      // ⚠️ **就地改**，不換掉整個陣列——別人手上可能拿著同一個參考
      c.value = method === 'reset' ? 0 : method === 'set' ? 1 : (Number(c.value) ? 0 : 1)
    }
    /**
     * 🔴 **「第幾格」接上時只改那一格**（2026-09-20，盲測抓到）。
     * 在此之前那個引數被丟掉，於是 `bs.set(3)` **把整排設成 1**——
     * 而它不出聲：印出來是 8 而不是 1。
     */
    const posNode = (node.slots.pos ?? [])[0]
    if (posNode) {
      const i = Math.trunc(ctx.toNumber(await ctx.evaluate(posNode)))
      if (!Number.isFinite(i) || i < 0 || i >= cells.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(i) })
      }
      apply(cells[i])
      return
    }
    for (const c of cells) apply(c)
  })
}
