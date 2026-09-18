/** `cpp:io_flush` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // ⚠️ 註冊鍵是**元件身分**，回傳值是**產出的 C++ 程式碼**——同族那顆換行的
  //    曾經因為這兩個被一起改掉而產出 `cout << x << lang:endl;`。
  g.set('cpp:io_flush', () => 'flush')
}
