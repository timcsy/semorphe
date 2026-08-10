/**
 * `<utility>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 1 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 1 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  _register: (concept: string, executor: ConceptExecutor) => void,
): void {

}
