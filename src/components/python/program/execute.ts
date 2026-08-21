/**
 * `python:program` 的 **execute** 路——**從上到下跑，沒有進入點**。
 *
 * ## 🔴 這一顆與 C++ 那顆的差別，正是兩個語言的差別
 *
 * ```
 * C++      跑完整棵樹【登記】函式，然後【呼叫進入點】（main，或 setup/loop）
 * Python   ⚠️ 沒有進入點 —— 模組層的語句【就是】程式，由上而下執行一次
 * ```
 *
 * 所以這裡**不找 `main`**、也不需要知道目標是什麼。
 * `def` 在執行到那一行時把函式登記起來（見 `func_def/execute.ts`），
 * 而它下面的語句照樣繼續跑——**那是 Python 的規則，不是簡化**。
 *
 * > **「哪一個函式是進入點」是【整個程式】的知識，
 * > 而 Python 的答案是「沒有」——那也是一個答案，不是缺一塊。**
 *
 * ⚠️ 在這一顆存在之前（spec 168–169），**Python 的每一段程式都在根節點就掛**
 * （`RUNTIME_ERR_UNKNOWN_COMPONENT: python:program`），
 * 而後果比「不能跑」更大：**17 顆元件的執行器存在、被登記了、卻從來沒被跑過一次**。
 * 那是這個專案記過的病——**機制有了，沒人接上**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:program', async (node, ctx) => {
    // ⚠️ **就這一行。** 而它短是因為語言本來就這樣，不是因為少做了什麼
    // ——如果哪天要支援 `if __name__ == "__main__"`，那是【那顆元件】的事，不是這裡的。
    await ctx.executeBody(node.children.body ?? [])
  })
}
