/**
 * 把 Python 接到核心上——**產生器那一路**。
 *
 * ⚠️ 執行器與跳過宣告今天仍由 `registerCppLanguage()` 順帶做
 * （它們的內部是 `componentExecuteRegistrars()` 與 `componentComponents()`，
 * **兩個都是掃全部膠囊的 glob**）。
 * 🔴 那是一筆已知的錯位，記在 `knowledge/history/121`——
 * **一個語言中立的登記，如果它的呼叫點掛在某個語言的名字底下，
 * 那麼「有沒有被呼叫」就變成那個語言的內部細節。**
 */
import { registerLanguage } from '../../core/projection/code-generator'
import type { NodeGenerator } from '../../core/projection/code-generator'
import { componentGenerateRegistrars } from '../../core/component/paths'
import type { StylePreset } from '../../core/types'

export function registerPythonLanguage(): void {
  registerLanguage('python', (style: StylePreset) => {
    const g = new Map<string, NodeGenerator>()
    // ⚠️ **`style` 一定要傳**——共用產生器裡有一批 helper 是捕獲 `style` 的閉包，
    // 剪出去的膠囊拿不到那個閉包，只能自己從 `style` 算。
    for (const reg of componentGenerateRegistrars())
      (reg as (m: typeof g, s: StylePreset) => void)(g, style)
    return g
  })
}
