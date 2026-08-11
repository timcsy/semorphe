/**
 * `<string>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/strings.ts`，讓核心層認識了 17 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  _register: (concept: string, executor: ConceptExecutor) => void,
): void {








  // `find_first_not_of` / `find_last_not_of` 已元件化——執行那一路搬進
  // `src/components/cpp/string_find_{first,last}_not_of/execute.ts`。

























  // cstring (C-style string functions)
}
