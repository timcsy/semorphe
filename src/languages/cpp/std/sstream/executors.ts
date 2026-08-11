/**
 * `istringstream` 的執行——從一個字串讀資料。
 *
 * ## 表示法
 *
 * 串流的狀態是「**還沒讀的 token**」。宣告時把來源字串切開存進去，
 * 每次讀取取走一個。用陣列表示，`>>` 那一路就不需要新的值型別。
 *
 * ⚠️ 同模組的 `cpp_stringstream_declare` 被宣告成 `declarative`
 * （刻意不執行）。**那個宣告對輸入串流不成立**——宣告一個串流卻什麼都不做，
 * 之後 `in >> x` 就沒東西可讀。與 091 的列舉是同一個病：
 * 「刻意不執行」的理由**經不起一支會用到它的程式**。
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerExecutors(
  _register: (concept: string, executor: ConceptExecutor) => void,
): void {

}
