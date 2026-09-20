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
 *
 * ## 🔴 第三個病（2026-09-20）：**它在運算式位置什麼都不回**
 *
 * `getline(cin, s)` 回的是 `istream&`，而 `while (getline(cin, s))` 用的是
 * 它的 `operator bool`（＝`!fail()`）。這個執行器**一個值都不回**，
 * 於是那個條件拿到 `undefined` ⟹ 迴圈**一次都不進去**。
 *
 * ```
 * while (getline(cin, s)) { … }    g++ 「[ab] [cd]」   我們 「」
 * ```
 *
 * ⚠️ 而**語句位置一直是對的**，同族的 `cin >> n` 當條件也一直是對的
 *（`cpp:input` 回 `{ int, 讀到幾個 }`）——所以三條最像的路都綠，
 * 只有這一條在說謊。語料 `AP325/3/3_2.cpp` 因此**一個字都沒印**。
 *
 * 🔴 而它在語料的報表上**看起來像「測資餵不夠」**：那個分類器問
 * 「我們的輸出是不是參照輸出的前綴」，而**空字串是每一個字串的前綴**。
 *
 * > **一個「前綴就算少了尾巴」的判準，對「我們一個字都沒印」保持沉默。**
 *
 * 🟢 回的值照 `cpp:input` 的形狀（`{ type: 'int' }`，讓 `while` 取真假）：
 * 讀到了回 1、EOF 或流已失敗回 0。⚠️ **而「寫什麼進變數」一格都沒動**
 * ——上面那張表是量出來的，這一刀只補「回什麼」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { resolvePlace } from '../../../interpreter/lvalue'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:input_line', async (node, ctx) => {
      // 🟢 讀進去的那一格是**一個位置**（2026-08-25）——`getline(cin, o.name)` 合法。
      //    🪦 在此之前是 `ctx.scope.set(name)`／`declare(name)`，於是
      //    `o.name` 會在作用域裡**長出一個叫 `o.name` 的變數**，而那個欄位沒動。
      const targetNode = (node.slots.target ?? [])[0]
      // 🟢 `istream&` 的 `operator bool`——照 `cpp:input` 的形狀回，見檔頭第三個病。
      const STREAM_BAD: RuntimeValue = { type: 'int', value: 0 }
      const STREAM_OK: RuntimeValue = { type: 'int', value: 1 }
      // 流已經失敗：`getline` 立刻回，變數一個字都不動
      if (ctx.cinFailed) return STREAM_BAD
      if (!targetNode) return STREAM_BAD
      // 🔴 兩層：先讀預餵的，沒有才【等】使用者
      const line = ctx.io.read() ?? (await ctx.awaitInput())
      if (line === null) ctx.failCin()
      // ⚠️ **EOF 時仍然寫空字串進去**——那是上面那張表量出來的既有行為，不要順手改掉。
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
      return line === null ? STREAM_BAD : STREAM_OK
    })
}
