/**
 * `<cstdlib>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 6 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 6 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:random_next', async () => ({ type: 'int' as const, value: Math.floor(Math.random() * 32768) }))

 // seed ignored in JS








}
