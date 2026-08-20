/**
 * `cpp:cast_const` 的 **execute** 路
 *
 * 轉型的數值語義是**共用的演算法**（`core/runtime/cast.ts`），
 * 不是另一顆元件的實作——四種命名轉型與 C 風格轉型各自宣告自己用它。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { numericCast } from '../../../languages/cpp/core/runtime/cast'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:cast_const', async (node, ctx) => {
    // 退路與宣告的 `default` 一致（第二十三條護欄，硬性零）。
    // ⚠️ 共用迴圈裡它們四顆的退路全都寫 `'int'`——**與宣告不符，而護欄看不見**：
    // 一個 `for` 迴圈註冊出來的四個執行器，來源位置是同一行，
    // 分不出是哪一顆。**膠囊化把它拆開，護欄立刻指名了三顆。**
    const targetType = String(node.properties.target_type ?? 'int*')
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    // ⚠️ `charIsChar: true`——命名轉型的 `char` 回整數。這是既有行為，
    // 與 C 風格轉型不同；**搬家不重寫**（要改就另開一個 commit）。
    return numericCast(targetType, val, ctx.toNumber(val), { charIsChar: true })
  })
}
