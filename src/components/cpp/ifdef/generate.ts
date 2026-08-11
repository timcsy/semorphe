/** `cpp:ifdef` 的 **generate** 路——從共用檔原封剪過來（批次第二十三批：前置處理指令 → 身分）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // ⚠️ **產生器讀 `name`、執行器讀 `condition`——同一顆元件，兩條路各讀各的。**
    //
    // 沒有人發現，是因為辨識器**兩個都寫**（`{ condition: name, name }`）。
    // 那不是相容層，是重複；而重複讓兩條路的分歧變成隱形的。
    //
    // 只要有一條路徑只產出其中一個（例如抽取器），另一條就會靜靜地退到 `'MACRO'`。
    // 已收斂成 `condition`——參數規格護欄逼出來的。
    g.set('cpp:ifdef', (node, _ctx) => {
      const name = node.properties.condition ?? 'MACRO'
      return `#ifdef ${name}\n`
    })
}
