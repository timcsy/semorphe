/**
 * `cpp:container_append` 的 **lift** 路——**一筆資料：「`push_back` 這個方法名屬於我」**
 *
 * ⚠️ 登錄的是**容器方法表**，不是一般的方法表。差別是**查詢點**：
 * 容器方法要先依接收者型別分派、並記下 `container_kind`（形態要用）。
 * 塞進早期那張表會被先攔截，而那不會報錯，只會安靜地少掉資訊。
 */
import { registerContainerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerContainerMethodComponent('push_back', 'cpp:container_append', 'cpp/container_append')
  /**
   * 🟢 **`emplace_back` 與 `push_back` 是同一件事**（2026-09-18，盲測抓到）。
   *
   * C++ 的差別在**怎麼造那個元素**（就地建構 vs 先造再搬），而這個直譯器
   * 沒有「搬移」這個概念——兩者在語義上是同一個動作。
   *
   * ⚠️ 不登錄的症狀**不是報錯**：它掉到泛用的方法呼叫，然後執行時說
   * 「這個接收者（不是一個物件）」——**錯誤指著接收者，而缺的是方法名**。
   */
  registerContainerMethodComponent('emplace_back', 'cpp:container_append', 'cpp/container_append')
}
