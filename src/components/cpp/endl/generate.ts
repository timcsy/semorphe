/** `cpp:endl` 的 **generate** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // ⚠️ 第一個 `'lang:endl'` 是**元件身分**，第二個是**產出的 C++ 程式碼**。
    // 命名空間遷移把兩個都改了——症狀是產出 `cout << x << lang:endl;`。
    // 同一個字串，兩種意義，而位置分得出來：註冊鍵 vs 回傳值。
    g.set('cpp:endl', (_node, _ctx) => 'endl')
}
