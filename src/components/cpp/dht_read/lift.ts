/**
 * `cpp:dht_read` 的 **lift** 路——**濕度與溫度是同一顆概念的兩個參數**。
 *
 * 🔴 `readHumidity()` 與 `readTemperature()` 的形狀完全相同，差別只有「量什麼」。
 * 與零件那一批的結論同一條：**量什麼不是身分，是參數。**
 *
 * ⚠️ 而分支綁**接收者的宣告型別**（`DHT`）：`read*` 是很普通的方法名前綴，
 * 而型別是宣告出來的，不是猜的。**型別查不到時不認**——留在通用的方法呼叫。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

const QUANTITY: Record<string, string> = {
  readHumidity: 'humidity',
  readTemperature: 'temperature',
}

export function registerLift(): void {
  registerMethodBranch('cpp/dht_read', (obj, method, argChildren, ctx): SemanticNode | null => {
    const quantity = QUANTITY[method]
    if (!quantity) return null
    // ⚠️ `readTemperature(true)` 是華氏——**不吃引數的那一版才是這顆**。
    //    帶引數的留在通用方法呼叫，否則那個 `true` 會安靜地不見。
    if (argChildren.length > 0) return null
    if (!obj || ctx.data.getType(obj) !== 'dht') return null
    return createNode('cpp:dht_read', { obj, quantity }, {})
  })
}
