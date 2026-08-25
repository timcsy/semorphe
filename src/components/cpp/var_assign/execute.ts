/**
 * `cpp:var_assign` 的 **execute** 路。
 *
 * ## 🪦 這裡本來有一段手拆的字串
 *
 * 2026-08-25 之前左邊是 `properties.obj`（一個字串），而執行器這樣拆它：
 *
 * ```
 * const dot = name.indexOf('.')          // ← 只認【一個】點
 * ```
 *
 * 於是 `a.b.c = 1`／`p->x = 1`／`*q = 1`／`a[i][j] = 1` 全部走不通，
 * **而沒有任何東西會出聲**——`ctx.scope.set("p->x", val)` 會安靜地
 * 在作用域裡長出一個叫 `p->x` 的變數。
 *
 * ⚠️ 而它的註解自己寫著：「字串編碼結構是既有的技術債……**不在這一刀的範圍**」。
 *
 * > **一句「不在這一刀的範圍」，如果沒有一條護欄記著它，就是永遠。**
 *
 * 🟢 現在左邊是 `target` 接點，解析走 `resolvePlace`——加一種新的左值形狀
 * **不改這個檔**。見 `knowledge/concepts/左值.md`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { resolvePlace } from '../../../interpreter/lvalue'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:var_assign', async (node, ctx) => {
    const targetNode = (node.children.target ?? [])[0]
    if (!targetNode) {
      // 認得出來而拆不開＝上游給了一個沒有左邊的節點，**出聲不要猜**
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這一行沒有左邊' })
    }
    const valueNodes = node.children.value
    if (!valueNodes || valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])
    const place = await resolvePlace(targetNode, ctx)
    place.write(val)
    // **指派是一個運算式，它求值成被指派的值。**
    //
    // 第一版什麼都不回，於是 `while ((p = f()) != 0)` 這種寫法裡的比較
    // 拿到 undefined —— 判定為假，**迴圈一次都不跑**，而程式照樣「跑完」
    // 印出後面的東西。那是靜默降級最典型的形狀。
    return val
  })
}
