/**
 * `<cmath>` 的執行路——**空的，而且是顯式的空**（理由見 `generators.ts`）。
 *
 * 曾經：這一路住在 `src/interpreter/executors/cmath.ts`，讓核心層認識了
 * 三個 C++ 專屬身分；`specs/054` 把它搬回模組，模組的五條路才齊。
 * 而現在三顆都進了膠囊，五條路跟著回到各自的資料夾——
 * **模組是搬家的中途站，不是終點。**
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(_register: (concept: string, executor: ConceptExecutor) => void): void {}
