/**
 * **`vector` 與 `deque` 共用的宣告產碼**——五種形式：`T<…> name;`／`= {…}`／`= e`／`(n)`／`(n, x)`。
 *
 * 從 `lang/runtime/sequence-declare.ts` 搬過來（第 242 刀，6c-4 的前置）：產碼那一半原本和執行的 `declareSequence` 住在同一個檔，
 * 而 runtime 那個資料夾要隨直譯器刪掉——不搬的話，刪的那天 vector／deque 會產不出程式碼。共用的理由見原檔檔頭（兩份逐字相同的實作會漂移）。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

/** 產碼：`template<T> name;`／`= {…}`／`= e`／`(n)`／`(n, x)` 五種形式。 */
export function generateSequenceDeclare(
  template: string, fallbackName: string,
): NodeGenerator {
  return (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? fallbackName
    // 初始化列表要一起產回去。**少了它的話，來回轉換會靜靜地把
    // `vector<int> v = {3,1,4}` 變成 `vector<int> v;`**——那是合法程式，
    // 只是不是使用者寫的那一段。
    const values = node.slots.values ?? []
    if (values.length > 0) {
      const items = values.map((v) => generateExpression(v, ctx)).join(', ')
      return `${indent(ctx)}${template}<${type}> ${name} = {${items}};\n`
    }
    // 初始值是一整個運算式（`= f()`）——與上面同一個病，同一個處方
    const source = (node.slots.source ?? [])[0]
    if (source) {
      return `${indent(ctx)}${template}<${type}> ${name} = ${generateExpression(source, ctx)};\n`
    }
    // `vector<int> v(5)` —— 建構子引數。⚠️ 原本產不回來（lift 也接不住，**兩邊對稱**）。
    const size = (node.slots.size ?? [])[0]
    if (size) {
      // `vector<int> v(5, 7)` —— 第二個引數是「每一格是什麼」。
      // ⚠️ 少了它的話產出 `v(5)`，那**編得過而且看起來很像**，只是每一格變成 0。
      const fill = (node.slots.fill ?? [])[0]
      const args = fill
        ? `${generateExpression(size, ctx)}, ${generateExpression(fill, ctx)}`
        : generateExpression(size, ctx)
      return `${indent(ctx)}${template}<${type}> ${name}(${args});\n`
    }
    return `${indent(ctx)}${template}<${type}> ${name};\n`
  }
}
