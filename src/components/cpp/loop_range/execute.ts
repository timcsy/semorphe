/** `cpp:loop_range` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:loop_range', async (node, ctx) => {
      const varName = String(node.properties.var_name ?? 'x')
      const containerName = String(node.properties.container ?? 'vec')
      const body = node.children.body ?? []
      const parentScope = ctx.scope
      const container = ctx.scope.get(containerName)

      // 🔴 **字串也是可以 range-for 的東西**（2026-08-26）。
      //
      // 這裡本來只認 `array`，於是 `for (char c : s)` 的迴圈**一次都不跑**
      // ——而它**沒有出聲**：程式跑完了，輸出是空的。
      //
      // > **一個「條件沒中就整段跳過」的執行器，
      // > 把「還沒支援」變成了「安靜地什麼都不做」。**
      //
      // ⚠️ 抓到它的是第三十二條護欄（行為的誤差），而那條護欄當時
      //    正被一個壞掉的語料收集器藏著一半的語料——**兩個缺陷疊在一起，
      //    上面那個會讓下面那個看不見**。
      // ⚠️ `char` 在這個直譯器裡是**碼位**（見 `cpp:literal_char`／`cpp:string_at`）。
      const items = container.type === 'string' && typeof container.value === 'string'
        ? [...container.value].map((ch) => ({ type: 'char' as const, value: ch.charCodeAt(0) }))
        : (container.type === 'array' && Array.isArray(container.value) ? container.value : null)

      if (items) {
        for (const elem of items) {
          ctx.scope = parentScope.createChild()
          ctx.scope.declare(varName, elem)
          try {
            await ctx.executeBody(body)
          } catch (signal) {
            if (signal instanceof BreakSignal) break
            if (signal instanceof ContinueSignal) continue
            ctx.scope = parentScope
            throw signal
          }
        }
      }
      ctx.scope = parentScope
    })
}
