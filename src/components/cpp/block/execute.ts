/**
 * `cpp:block` 的 **execute** 路——**一個獨立的 `{ … }` 是一個作用域**
 *
 * ## 🔴 它在 2026-08-13 之前不存在，而後果不只是解構子
 *
 * 辨識器把**所有** `compound_statement` 展平（`lifter.ts` 的
 * 「Flatten _compound nodes」）。那對 `if (c) { a; b; }` 是對的——body 就是
 * 那個結構的作用域。**而對一個獨立的 `{ … }` 是錯的**：它自己就是作用域。
 *
 * ```cpp
 * int main() { { int x = 1; } cout << x; }   // 真編譯器：編譯錯誤
 *                                            // 展平之後：印出 1
 * ```
 *
 * 症狀最先是從**解構子**露出來的（第三十二條護欄的誤差第 3 筆）：
 * `{ S s; }` 的 `~S()` 印在 `main end` **之後**而不是之前
 * ——`s` 掛在 main 的作用域上，所以 main 結束才收尾。
 *
 * > **一個作用域少了，症狀不是「變數不見」而是「變數活太久」
 * > ——而活太久不會報錯。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:block', async (node, ctx) => {
    const outer = ctx.scope
    ctx.scope = outer.createChild()
    try {
      await ctx.executeBody(node.children.body ?? [])
    } finally {
      // ⚠️ 走 `exitScope` 而不是直接還原——**作用域結束時要跑解構式**，
      // 而那個知識住在 `onScopeExit`（`languages/cpp/core/executors/structs.ts`）。
      // 那個函式的註解逐字：「**每一個建立作用域的地方都要走這裡**
      // ——漏掉任何一個，那裡宣告的物件就永遠不會被收尾，**而症狀是沒有症狀**」。
      await ctx.exitScope(ctx.scope, outer)
    }
  })
}
