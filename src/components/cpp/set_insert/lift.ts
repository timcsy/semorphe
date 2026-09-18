/**
 * `cpp:set_insert` 的 **lift** 路——**一筆資料：「`insert` 這個方法名屬於我」**
 *
 * ⚠️ 登錄的是**容器方法表**，不是一般的方法表。差別是**查詢點**：
 * 容器方法要先依接收者型別分派、並記下 `container_kind`（形態要用）。
 * 塞進早期那張表會被先攔截，而那不會報錯，只會安靜地少掉資訊。
 */
import { registerContainerMethodComponent } from '../../../core/component/method-components'

export function registerLift(): void {
  registerContainerMethodComponent('insert', 'cpp:set_insert', 'cpp/set_insert')
  /**
   * 🟢 **`emplace` 與 `insert` 在關聯容器上是同一件事**（2026-09-18，盲測抓到）。
   *
   * C++ 的差別在**怎麼造那個元素**，而這個直譯器沒有「搬移」這個概念。
   * ⚠️ 而 `emplace` 收的是**建構元素的那些引數**（`mm.emplace(k, v)`），
   *    不是一個大括號——那一層由執行那一路依接收者的種類處理。
   */
  registerContainerMethodComponent('emplace', 'cpp:set_insert', 'cpp/set_insert')
}
