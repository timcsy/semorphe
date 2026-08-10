/**
 * `cpp:container_append` 的 **lift** 路——**一筆資料：「`push_back` 這個方法名屬於我」**
 *
 * ⚠️ 登錄的是**容器方法表**，不是一般的方法表。差別是**查詢點**：
 * 容器方法要先依接收者型別分派、並記下 `container_kind`（形態要用）。
 * 塞進早期那張表會被先攔截，而那不會報錯，只會安靜地少掉資訊。
 */
import { registerContainerMethodConcept } from '../../../core/component/method-concepts'

export function registerLift(): void {
  registerContainerMethodConcept('push_back', 'cpp:container_append', 'cpp/container_append')
}
