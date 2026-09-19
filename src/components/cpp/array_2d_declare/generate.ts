/** `cpp:array_2d_declare` 的 **generate** 路——從共用檔原封剪過來（批次第十七批：宣告子分支）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:array_2d_declare', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'arr'
      /**
       * 🔴 **維度從接點來**（2026-09-19）。
       * ⚠️ **空的要產出空字串不是預設值**：`int a[][3] = {…}` 是合法的 C++，
       *    而補一個 `3` 進去會**改掉學生的程式**。
       *    這與同族的範圍那一族不同（那裡空的要補 `v.begin()`，因為 `sort(, )` 編不過）。
       */
      const dim = (slot: string): string => {
        const n = (node.slots[slot] ?? [])[0]
        return n ? generateExpression(n, ctx) : ''
      }
      const rows = dim('rows')
      const cols = dim('cols')
      // 初始值三態，與一維陣列同一條契約：欄位不存在 → 無初始化；
      // `[]` → `= {}`；有內容 → `= {…}`。
      const values = node.slots.values
      const init = values === undefined ? '' : ` = {${values.map((v) => generateExpression(v, ctx)).join(', ')}}`
      return `${indent(ctx)}${type} ${name}[${rows}][${cols}]${init};\n`
    })
}
