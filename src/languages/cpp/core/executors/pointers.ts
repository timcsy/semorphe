/**
 * 指標的執行路——語言核心的第五面牆。
 *
 * 指標不屬於任何標準函式庫標頭，所以歸語言核心，與 `core/generators/`、
 * `core/lifters/` 並列。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerPointerExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {










  register('cpp:malloc', async (node) => {
    // ⚠️ 退路是 `int*` 不是 `int`——`type` 在這顆元件裡是**轉型型別**（指標），
    // 產生器寫的是 `(${type})malloc(…)`。兩邊曾經不一致，而積木下拉當時給的
    // 是元素型別，於是使用者選 `int` 會產出 `(int)malloc(…)`，不合法的 C++。
    return { type: 'pointer' as any, value: `heap_${node.properties.type ?? 'int*'}` }
  })




}
