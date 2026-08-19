/**
 * spec 152：**`layer` 這一格已退場，而它不准回來。**
 *
 * ## 為什麼它該走
 *
 * 233 顆元件都宣告 `layer`（universal 31 · lang-core 82 · lang-library 120），
 * **而生產路徑一個消費者都沒有**：`toolbox-builder` 早已改成問那條等價邊，
 * `listByLayer()` 只有測試在叫，其餘兩處只是抄欄位。
 *
 * 而 `draft/通解與特解` 把錯誤的性質講清楚了：
 *
 * > **齊次解是【算子】的性質，不是【解】的性質**
 * > ——「某個 y 是不是通解」這個問法本身不成立。
 * > 所以 `layer: universal` 是把**商空間的元素**寫成**某個元素的欄位**：
 * > **型別根本不對。**
 *
 * ## ⚠️ 而它有一個真消費者藏在護欄裡（差點漏掉）
 *
 * 中立性護欄用它豁免 universal 概念，理由是「拔掉 C++ 後依然存在」
 * ——🔴 **假的**（`cpp:if` 不會依然存在）。豁免已一併移除。
 *
 * > **一條理由為假、而目前沒有生效的規則，是一顆等著在第一次被觸發時
 * > 給出錯誤答案的地雷。**
 */
import { describe, it, expect } from 'vitest'

const files = import.meta.glob('../../src/components/*/*/component.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

describe('spec 152 · `layer` 不准回來', () => {
  it('★ 錨點：真的掃到了元件（否則下面是空集合的空話）', () => {
    expect(Object.keys(files).length, '一顆元件都沒掃到').toBeGreaterThan(200)
  })

  it('🔴 沒有任何 `component.json` 帶 `layer`', () => {
    const offenders = Object.entries(files)
      .filter(([, m]) => 'layer' in m.default)
      .map(([p]) => p.replace('../../src/components/', ''))
    expect(offenders,
      '`layer` 長回來了——⚠️ 它是把商空間的元素寫成某個元素的欄位，型別不對').toEqual([])
  })

  it('🔴 也沒有 `_layer_why`（理由留著等於欄位留著）', () => {
    const offenders = Object.entries(files)
      .filter(([, m]) => '_layer_why' in m.default)
      .map(([p]) => p.replace('../../src/components/', ''))
    expect(offenders).toEqual([])
  })
})
