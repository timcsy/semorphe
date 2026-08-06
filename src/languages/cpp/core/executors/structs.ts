/**
 * 結構的執行——物件導向的第一片。
 *
 * ## 為什麼住在語言套件
 *
 * `cpp_struct_declare` / `cpp_struct_member_access` 是 C++ 專屬的概念身分。
 * 核心層只提供**機制**（執行期的物件值、型別登記處），語言套件說**哪些概念
 * 用它**——與註解語法、skip 宣告、下拉選單同一個形狀。
 *
 * ## 範圍：一片
 *
 * 只做結構型別與欄位讀寫。方法、建構式、繼承、存取控制仍然是殼，
 * 完備性報表照樣數它們——**切一片不等於把剩下的宣告掉**。
 *
 * 見 specs/071-struct-execute/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { getMember } from '../../../../interpreter/executors/variables'
import type { FieldDecl } from '../../../../interpreter/struct-types'

export function registerStructExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  /**
   * `struct Point { int x; int y; };`
   *
   * 成員宣告本身**不執行**——它們是型別的一部分，不是要跑的敘述。
   * 執行它們的話 `x` 和 `y` 會變成外層作用域的真變數。
   */
  register('cpp_struct_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const fields: FieldDecl[] = []
    for (const m of node.children.members ?? []) {
      const fname = m.properties?.name
      if (fname === undefined) continue
      fields.push({ name: String(fname), type: String(m.properties?.type ?? 'int') })
    }
    ctx.structs.declare(name, fields)
  })

  /** `p.x` */
  register('cpp_struct_member_access', async (node, ctx) => {
    const objName = String(node.properties.obj)
    return getMember(ctx.scope.get(objName), String(node.properties.member), objName)
  })
}
