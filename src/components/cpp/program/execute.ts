/**
 * `cpp:program` 的 **execute** 路——**跑完整棵樹，然後呼叫進入點**
 *
 * ⚠️ `'main'` 這個名字留在這裡，而**不是** `func_def` 的性狀：
 * 「哪一個函式是進入點」是**這顆（整個程式）的知識**，不是那顆函式的性質。
 * 一個叫 `main` 的函式在別的語言裡可能什麼都不是。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { 建func_call } from '../func_call/lift'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:program', async (node, ctx) => {
      const body = node.children.body ?? []
      await ctx.executeBody(body)
      if (ctx.functions.has('main')) {
        // ⚠️ 這裡原本包了一層叫 `execFuncCall` 的 local——**而同一個檔案裡
        // 二十行外還有一個同名的執行器**。名字一樣、意思不同，剪錯一個不會報錯。
        await ctx.executeNode(建func_call('main', []))
      }
    })
}
