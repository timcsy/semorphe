/**
 * `cpp:container_pop` 的 **lift** 路——**一筆登錄，而且是登在「晚查」那張表上**
 *
 * ⚠️ `method-components.ts` 有**三張表**，而它們不能合併：
 *
 * ```
 * methodConceptFor(方法名)         早——路由器一拿到方法名就查，直接建節點
 * containerMethodConcept(方法名)   晚——要先做型別分派、還要記下 container_kind
 * typedMethodConcept(型別, 方法名)  晚——只有接收者型別查得到時才問
 * ```
 *
 * 這顆登在**晚查**那張表：`st.push(x)` 與 `q.push(x)` 執行行為相同，
 * 而積木上該說「推到頂端」還是「加到尾端」不同——那是**形態**，
 * 由共用檔在那個查詢點記下 `container_kind`。
 *
 * 登在早查那張表的話節點會建出來，**而形態沒了**，症狀是
 * 「來回轉換之後堆疊的積木變成通用容器」。
 *
 * > **兩個查詢點就是兩張表。合併會讓其中一個查詢點的前置工作被跳過，
 * > 而那不會報錯。**
 */
import { registerContainerMethodConcept } from '../../../core/component/method-components'

export function registerLift(): void {
  registerContainerMethodConcept('pop', 'cpp:container_pop', 'cpp/container_pop')
}
