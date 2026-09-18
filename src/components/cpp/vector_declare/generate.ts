/**
 * `cpp:vector_declare` 的 **generate** 路
 *
 * ⚠️ **產碼的形狀與 `deque` 逐字相同**（五種建構形式），所以它住在
 * `runtime/sequence-declare`，而這裡留的是**身分 ＋ 樣板名**。
 * 抄一份的話兩份會漂移，而第三十八條護欄（共用檔的殼與重複）正是為此存在。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateSequenceDeclare } from '../../../languages/cpp/lang/runtime/sequence-declare'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:vector_declare', generateSequenceDeclare('vector', 'vec'))
}
