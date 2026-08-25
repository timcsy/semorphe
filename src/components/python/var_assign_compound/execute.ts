/**
 * `python:var_assign_compound` 的 **execute** 路——取值、運算、寫回。
 *
 * 🔴 **運算那一步走同族算術元件的 `apply.ts`**，不自己算：
 * `/=` 是真除法、`%=` 跟著除數的正負號、還有一個 `//=`
 * ——這四條規則這個專案各踩過一次，而**複製一份就是再踩一次的邀請**。
 *
 * ⚠️ 共用的那支複合指派執行器（C++ 在用的那個）**不能重用**：它的 `/=`
 * 是整數除法、`%=` 是 C 的取餘、而且沒有 `//=`。
 *
 * ## 🪦 這裡本來有一個【寫在執行器裡的 parser】
 *
 * 2026-08-25 之前左邊是一個字串，於是這支執行器用 regex 手拆它：
 *
 * ```
 * /^([A-Za-z_]\w*)\[(.+)\]$/     ← 認 nums[0]
 * name.lastIndexOf('.')          ← 認 self.n
 * ```
 *
 * 而它的註解自己承認「索引是一個字面或一個變數名——**複雜的運算式還沒收**」。
 * `nums[i+1] += 1` 在那一版是壞的，而**沒有任何東西會出聲**。
 *
 * > **一個需要 parse 回結構才能用的字串，就不該是字串。**
 *
 * 換成接點之後這整段消失，而支援的左值形狀從「三種」變成
 * 「**任何宣告了自己怎麼被寫回的節點**」——見 `core/component/lvalue-nodes.ts`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { applyPythonBinary } from '../arithmetic/apply'
import { resolvePlace } from '../../../interpreter/lvalue'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign_compound', async (node, ctx) => {
    const targetNode = (node.children.target ?? [])[0]
    if (!targetNode) {
      // 認得出來而拆不開＝上游給了一個沒有左邊的節點，**出聲不要猜**
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這一行沒有左邊' })
    }
    const op = String(node.properties.operator ?? '+=').replace(/=$/, '')
    // 🔴 **順序照 CPython**：`a[i] += f()` 先定住容器與索引、載入 `a[i]`，
    //    **然後**才算右邊，最後用**同一個**位置存回去。
    //    反過來的話 `f()` 改掉 `i` 會讓它讀一格、寫另一格。
    const place = await resolvePlace(targetNode, ctx)
    const cur = place.read()
    const rhs = await ctx.evaluate(node.children.value[0])
    place.write(applyPythonBinary(op, cur, rhs, ctx))
  })
}
