/**
 * 兩類「執行不了」的概念——而它們**不是同一種東西**。
 *
 * 這一份原本住在核心直譯器（`src/interpreter/interpreter.ts` 的兩份寫死清單）。
 * 搬過來的理由是 P9：核心層不該認得任何 `cpp_` 開頭的概念身分。
 *
 * ## ⚠️ 這是「搬」，不是「宣告」
 *
 * 下面那十個物件導向概念**仍然是殼**——完備性護欄照樣把它們數進 `execute`
 * 那一欄的殼。搬移只改變了它們住在哪裡，沒有改變任何一個判定。
 *
 * 這一點是刻意的。`history/018` 記著上一次差點犯的錯：
 *
 * > 「把它們都宣告掉不是落實那條判準，是**拿那條判準當藉口**：把缺陷洗成
 * > 設計，然後讓護欄替它背書。」
 *
 * 十個裡有十個是「直譯器不支援物件導向」，不是「物件導向不需要執行」。
 * 幫它們加上 `skipPaths: ['execute']` 會讓完備性的數字下降而系統一點都沒變。
 * **等 OOP 真的實作了再處理它們。**
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

/**
 * 「我們看不懂這段」的兜底容器。
 *
 * 原本註冊成空操作，於是使用者寫的一段程式**什麼都沒發生而且沒有任何提示**
 * ——那正是「靜默降級是 bug 的藏身之處」講的形狀，而這裡藏的是使用者自己的
 * 程式碼。
 *
 * 出聲的形式是可被 `unknownConceptHandler` 接管的錯誤，與未知概念同一條路徑：
 * 使用者可以選擇跳過或中止，**但不會不知道**。
 */
const RAW_CODE_CONTAINERS = ['cpp_raw_code', 'cpp_raw_expression'] as const

/**
 * 直譯器不支援物件導向。這十個是**殼**，不是宣告——見檔頭。
 *
 * `cpp_include_local` 曾經也在這份清單裡，但它有真的宣告
 * （`concepts.json` 的 `skipPaths: ['execute']`, `reason: 'declarative'`），
 * 而直譯器會讀那份宣告（`interpreter.ts` 的 `isSkipped`）。
 * 所以那一筆是 053 之後的**殘留**，已刪除——不是搬過來。
 */
const OOP_NOT_IMPLEMENTED = [
  'cpp_class_def',
  'cpp_struct_declare',
  'cpp_constructor',
  'cpp_destructor',
  'cpp_virtual_method',
  'cpp_pure_virtual',
  'cpp_override_method',
  'cpp_operator_overload',
  'cpp_namespace_def',
  'cpp_lambda',
] as const

export function registerUnimplementedExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  for (const c of RAW_CODE_CONTAINERS) {
    register(c, async (node) => {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
        '%1': String(node.properties?.code ?? '(不明)').slice(0, 60),
      })
    })
  }

  const noop: ConceptExecutor = async () => {}
  for (const c of OOP_NOT_IMPLEMENTED) register(c, noop)
}
