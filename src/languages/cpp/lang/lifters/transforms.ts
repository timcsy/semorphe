import type { TransformRegistry } from '../../../../core/registry/transform-registry'

export function registerCppTransforms(registry: TransformRegistry): void {
  registry.register('cpp:stripComment', (text) => {
    if (text.startsWith('//')) return text.slice(2).trim()
    if (text.startsWith('/*') && text.endsWith('*/')) return text.slice(2, -2).trim()
    return text
  })

  /**
   * 剝掉區塊註解的語法，**包括每一行開頭的 `*` 裝飾**。
   *
   * ## 🔴 少了「剝掉 `*`」那一半的後果：註解每轉一次就長一次
   *
   * ```
   * /*
   *  * HC-SR04 距離計          ← 原文
   *  * * HC-SR04 距離計        ← 轉一次
   *  * * * HC-SR04 距離計      ← 轉兩次
   * ```
   *
   * 因為產生那一側（`cppCommentSyntax.block`）**每一行都會加回 ` * `**，
   * 而剝的時候沒有拿掉它——一加一不減，於是它單調成長。
   *
   * ⚠️ **它 2026-08-18 才被 fuzz 抓到**，而不是被既有測試抓到：
   * 既有語料用的是 `//` 行註解，而 **AI 生成的 sketch 幾乎都以 `/* … *\/` 開頭**。
   *
   * > **一個「每次都多一點」的錯誤，單看一次轉換是對的
   * > ——它只有在【轉第二次】的時候才看得見。**
   */
  registry.register('cpp:stripBlockComment', (text) => {
    if (!text.startsWith('/*') || !text.endsWith('*/')) return text
    const inner = text.slice(2, -2)
    // 單行的 `/* … */` 沒有裝飾可剝
    if (!inner.includes('\n')) return inner.trim()
    // ⚠️ 只剝**行首**的一顆 `*`——內文裡的 `*`（乘法、指標）不得被動到
    return inner
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim()
  })
}
