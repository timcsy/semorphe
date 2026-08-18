/**
 * `cpp:pin_attach` 的 **generate** 路——**一行常數宣告，就這樣**。
 *
 * ## ⚠️ `pinMode` 刻意【不】由這裡產出
 *
 * 探索報告第二節查證過：`pinMode` 要落在使用者自己的 `setup()` 裡，
 * 而鷹架機制只認得它自己的四段（imports／preamble／entryPoint／epilogue）
 * ——Arduino 的 `entryShell` 是 `'none'`，`setup` 對鷹架是一個普通的頂層函式。
 *
 * 🟢 拍板的是「**自動長出一顆看得見的 `pinMode` 積木**」＝ UI 層的動作。
 * 產生器完全不必知道這件事，**五路保持乾淨**。
 *
 * > **一顆概念如果要在兩個位置產出程式碼，先問「第二個位置能不能是一顆積木」
 * > ——看得見的東西比藏在產生器裡的東西好改。**
 *
 * ## 🔴 `device` 不影響輸出
 *
 * 「接的是 LED 還是繼電器」在程式碼裡**沒有對應**——`const int ledPin = 13;`
 * 就是它的全部。device 只活在積木的標籤上，而它從**名字**重新讀得回來
 * （`lift-strategy.ts`）。⚠️ 這符合 Sc2：積木不得引入程式碼中不存在的概念
 * ——device 引入的不是概念，是**同一個概念的一個讀法**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pin_attach', (node, ctx) => {
    const name = String(node.properties.name ?? 'ledPin')
    const pin = String(node.properties.pin ?? '13')
    // 🔴 **形式要回得去原樣**——`style` 記的是學生原本怎麼寫的。
    //    ⚠️ `#define` 沒有分號也沒有縮排（前置處理指令一律頂格），
    //    而把它縮排會讓某些編譯器與 linter 抱怨。
    switch (node.properties.style) {
      case 'define':
        return `#define ${name} ${pin}\n`
      case 'plain':
        return `${indent(ctx)}int ${name} = ${pin};\n`
      default:
        return `${indent(ctx)}const int ${name} = ${pin};\n`
    }
  })
}
