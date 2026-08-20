/** `cpp:var_declare_const` 的 **execute** 路——從共用檔原封剪過來（批次第二十二批：修飾詞 → 身分的登錄）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../interpreter/executors/variables'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  // const/constexpr 的**執行期**行為確實與 var_declare 相同——不可變是編譯期
    // 的約束，這個直譯器不強制它。身分保留：碼形態不同（`const int` vs `int`），
    // 而修飾詞要不要變成參數，取決於參數規格化（C 項）。
    register('cpp:var_declare_const', execVarDeclare)
}
