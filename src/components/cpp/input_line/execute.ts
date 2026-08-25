/**
 * `cpp:input_line` 的 **execute** 路——從共用檔原封剪過來（批次第六批：lift 是 io.ts 的一個帶真邏輯的分支）。
 *
 * ## 🔴 兩個病，一起修（2026-08-21）
 *
 * 1. **它不等使用者。** 原本只有 `ctx.io.read()`，於是在瀏覽器裡按下執行，
 *    提示印出來了，而程式**當場拿空字串跑完**。Python 的 `input()` 犯過
 *    一模一樣的病（spec 173）——這是它在 C++ 這一側。
 * 2. **它看不到 `cin` 的 `failbit`。** `getline` 與 `>>` 是**同一條流**。
 *
 * ⚠️ 而 `getline` 對變數的處置與 `>>` **不一樣**（量出來的，見
 *    `tests/integration/audit-cin-fail-state.test.ts`）：
 *
 * | | 變數 |
 * |---|---|
 * | 流已經失敗 | **完全不動**（sentry 就失敗了） |
 * | 乾淨的流遇 EOF | **清空**（`getline` 先 erase 才發現沒東西） |
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:input_line', async (node, ctx) => {
      // 🟢 讀進去的那一格是**一個位置**（2026-08-25）——`getline(cin, o.name)` 合法。
      //    🪦 在此之前是 `ctx.scope.set(name)`／`declare(name)`，於是
      //    `o.name` 會在作用域裡**長出一個叫 `o.name` 的變數**，而那個欄位沒動。
      const targetNode = (node.children.target ?? [])[0]
      // 流已經失敗：`getline` 立刻回，變數一個字都不動
      if (ctx.cinFailed) return
      if (!targetNode) return
      // 🔴 兩層：先讀預餵的，沒有才【等】使用者
      const line = ctx.io.read() ?? (await ctx.awaitInput())
      if (line === null) ctx.failCin()
      const value: RuntimeValue = { type: 'string', value: line ?? '' }
      // ⚠️ **`getline` 也會宣告一個還不存在的變數**（這個直譯器的既有行為）——
      //    所以先試位置，解不出來（例如那個名字還沒宣告）才 declare。
      try {
        const place = await resolvePlace(targetNode, ctx)
        place.write(value)
      } catch {
        const name = String(targetNode.properties?.name ?? 'str')
        ctx.scope.declare(name, value)
      }
    })
}
