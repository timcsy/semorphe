/** `cpp:var_assign` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { setMember } from '../../../interpreter/executors/variables'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:var_assign', async (node, ctx) => {
      const name = String(node.properties.obj)
      const valueNodes = node.children.value
      if (!valueNodes || valueNodes.length === 0) return
      const val = await ctx.evaluate(valueNodes[0])

      // `p.x = 7` —— 指派到結構的一個欄位。
      //
      // ⚠️ **辨識器把它編成一個帶點號的名字**（`name: "p.x"`），不是拆開的
      // `{ name: 'p', member: 'x' }`。第一版只認拆開的形狀，而**沒有任何
      // 生產者會產出那個形狀**——單元測試手寫節點時通過了，從真實原始碼跑
      // 卻完全沒有效果。那正是「測試通過卻什麼都沒測到」。
      //
      // 兩種都認：`member` 屬性（若未來有生產者）與帶點號的名字（現況）。
      // 字串編碼結構是既有的技術債（同 `func_def` 的參數），不在這一刀的範圍。
      const member = node.properties.member
      if (member !== undefined) {
        setMember(ctx.scope.get(name), String(member), val, name)
        return
      }
      const dot = name.indexOf('.')
      if (dot > 0 && ctx.scope.has(name.slice(0, dot))) {
        const objName = name.slice(0, dot)
        setMember(ctx.scope.get(objName), name.slice(dot + 1), val, objName)
        return val
      }

      ctx.scope.set(name, val)
      // **指派是一個運算式，它求值成被指派的值。**
      //
      // 第一版什麼都不回，於是 `while ((p = f()) != 0)` 這種寫法裡的比較
      // 拿到 undefined —— 判定為假，**迴圈一次都不跑**，而程式照樣「跑完」
      // 印出後面的東西。那是靜默降級最典型的形狀。
      return val
    })
}
