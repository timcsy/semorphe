/**
 * **過渡表**：還沒元件化的容器
 *
 * `cpp:vector_declare` 已經搬進膠囊，自己登錄 `vector`。其餘六顆還住在
 * `std/*` 模組裡，沒有地方可以登錄自己——這張表替它們登錄。
 *
 * ## 退場條件
 *
 * **每搬一顆進膠囊，就從這裡刪掉一列。** 這張表歸零的那天就刪掉這個檔。
 *
 * ⚠️ 它是**過渡**不是設計。留著不刪的話，它會變成第二個
 * 「加一顆容器要來這裡登記一次」的地方——而那正是 E 項花了一整輪清掉的東西。
 * 護欄看得到它（`containerTemplateSources()` 會回報每一筆是誰登錄的）。
 */
import { registerContainerTemplate } from '../../core/component/container-templates'

/** 尚未元件化的容器。**只准變短。** */
const 尚未元件化: [樣板名: string, conceptId: string][] = [
  ['stack', 'cpp:stack_declare'],
  ['queue', 'cpp:queue_declare'],
  ['priority_queue', 'cpp:priority_queue_declare'],
  ['set', 'cpp:set_declare'],
  ['map', 'cpp:map_declare'],
  ['pair', 'cpp:pair_declare'],
]

export function registerPendingContainers(): void {
  for (const [t, id] of 尚未元件化) registerContainerTemplate(t, id, '(尚未元件化)')
}
