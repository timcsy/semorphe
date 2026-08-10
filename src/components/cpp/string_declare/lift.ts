/**
 * `cpp:string_declare` 的 **lift** 路——**一筆資料：「`string` 這個型別名屬於我」**
 *
 * ⚠️ 與容器樣板表分開，因為**語法位置不同**：容器是 `vector<int> v;`
 * （template_type），這些是 `string x;`（type_identifier，可能包在 `std::` 裡）。
 * 判別邏輯不同，所以是兩張表——**位置決定形狀**。
 */
import { registerPlainTypeConcept } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerPlainTypeConcept('string', 'cpp:string_declare', 'cpp/string_declare')
}
