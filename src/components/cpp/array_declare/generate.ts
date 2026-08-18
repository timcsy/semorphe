/** `cpp:array_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十八批：四個重複建立點收成一個建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_declare', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'arr'
      const sizeNodes = node.children.size ?? []
      // 🔴 **沒有大小就產出 `[]`——不得編一個出來。**
      //
      // 這裡原本是 `?? '10'`，而那讓
      //
      // ```cpp
      // int melody[]   = {262, 294, 330, 349, 392, 440, 494, 523};   // 原文
      // int melody[10] = {262, 294, 330, 349, 392, 440, 494, 523};   // 產出
      // ```
      //
      // ⚠️ **那不是排版差異，是語義改變**：`sizeof(melody)/sizeof(melody[0])`
      // 從 8 變成 10 —— 學生的旋律迴圈會多播兩個垃圾音。
      // 而 `int a[] = {…}` 是 C++ 合法的寫法，**大小本來就該由初始值決定**。
      //
      // 🔴 這是「靜默降級反模式」的又一個實例：一個看起來合理的預設值
      // （`10`）把「這裡沒有資料」偽裝成「這裡的資料是 10」。
      // 2026-08-18 由 fuzz 抓到（AI 生的蜂鳴器範例幾乎都用不寫大小的陣列）。
      const size = sizeNodes.length > 0
        ? generateExpression(sizeNodes[0], ctx)
        : String(node.properties.size ?? '')
      // 初始值三態：欄位不存在 → 無初始化；[] → `= {}`；有內容 → `= {…}`
      const values = node.children.values
      const init = values === undefined ? '' : ` = {${values.map(v => generateExpression(v, ctx)).join(', ')}}`
      return `${indent(ctx)}${type} ${name}[${size}]${init};\n`
    })
}
