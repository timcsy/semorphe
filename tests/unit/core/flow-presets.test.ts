/**
 * **palette 的一項要生出什麼形狀**——`core/flow/presets.ts`。
 *
 * ## 這支釘的那件事，是一次判斷錯誤的修正
 *
 * 2026-08-27 上午把 palette 去重時，鍵用的是 `componentId`：
 * 「控制」那一格三顆「如果」收成一顆。當時的理由是實測過
 * **三者抽出來的語義樹完全相同**：
 *
 * ```
 * cpp_if {}                            {condition:1, then_body:0, else_body:0}
 * cpp_if {hasElse:true}                {condition:1, then_body:0, else_body:0}
 * cpp_if {elseifCount:1,hasElse:true}  {condition:1, then_body:0, else_body:0}
 * ```
 *
 * 🔴 **而那個量測是對的，結論是錯的**：三者在【剛建好】的時候相同，
 * 因為空插槽在樹裡不存在。`elseifCount` 要表達的不是「多一個空插槽」，
 * 是**一個預先接好的骨架**——而流程視圖生得出那個骨架。
 *
 * > **去重的鍵要等於「按下去會發生什麼」，不是「它是誰」。**
 *
 * ⚠️ 而 `hasElse` 那一顆**確實**該被去重掉：流程的接點是宣告出來的、永遠都在，
 * 所以「有沒有 else 插槽」在那裡不是一個選項。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { presetTree, presetKey, presetSuffixKey, resetPresetIds } from '../../../src/core/flow/presets'
import type { SemanticNode } from '../../../src/core/types'

const shape = (n: SemanticNode): Record<string, number> =>
  Object.fromEntries(Object.entries(n.children).map(([k, v]) => [k, v.length]))

describe('flow/presets', () => {
  beforeEach(() => resetPresetIds())

  it('★ 入口條件：沒有 extraState 就是一顆光的節點', () => {
    const t = presetTree('cpp:if')
    expect(t.componentId).toBe('cpp:if')
    expect(shape(t), '光的節點不該有任何子節點').toEqual({})
  })

  it('🔴 `elseifCount` → 一顆【巢狀】的同種節點，帶 `isElseIf`', () => {
    // 實測 lifter 對 `if…else if…else` 的產出：else-if 是巢狀的 `cpp:if`
    // ＋ `properties.isElseIf === 'true'`。學生不可能猜到這個形狀。
    const t = presetTree('cpp:if', { elseifCount: 1, hasElse: true })
    expect(shape(t), '🔴 else 那一格是空的 → 骨架沒有生出來').toEqual({ else_body: 1 })
    const inner = t.children.else_body[0]
    expect(inner.componentId, '巢狀的那顆要是同一種').toBe('cpp:if')
    expect(inner.properties.isElseIf, '🔴 少了這個旗標，它會被讀成一個獨立的 if').toBe('true')
  })

  it('🔴 `hasElse` 單獨出現時【不】生骨架——它只是一個空插槽', () => {
    // ⚠️ 少了這一條，一個「照抄 extraState」的實作也會通過上面那支，
    //    而它的症狀是 palette 上兩顆做同一件事的按鈕。
    expect(shape(presetTree('cpp:if', { hasElse: true }))).toEqual({})
  })

  it('🔴 去重的鍵：`hasElse` 與素的相同，`elseifCount` 不同', () => {
    const k = (extraState?: Record<string, unknown>): string =>
      presetKey({ category: 'c', blockType: 'cpp_if', extraState }, 'cpp:if')
    expect(k(), '素的').toBe('cpp:if')
    expect(k({ hasElse: true }), '🔴 它與素的生出同一棵樹 → 必須收成一顆').toBe(k())
    expect(k({ elseifCount: 1, hasElse: true }), '🔴 它生出不同的樹 → 不可以被收掉').not.toBe(k())
  })

  it('🔴 名字要看得出差別，而後綴是【介面文字】', () => {
    expect(presetSuffixKey(), '素的沒有後綴').toBeNull()
    expect(presetSuffixKey({ hasElse: true }), 'hasElse 不是一個獨立的入口').toBeNull()
    // 走 `msg()` 的鍵，不是寫死的中文（`principles.md:126`）
    expect(presetSuffixKey({ elseifCount: 1 })).toBe('FLOW_PRESET_ELSEIF')
  })

  it('★ 同一份輸入產出同一份結果——id 不得用亂數', () => {
    // 🔴 `Math.random()` 會讓兩次建立的樹比不起來，而重播與測試都靠這個。
    resetPresetIds()
    const a = JSON.stringify(presetTree('cpp:if', { elseifCount: 2 }))
    resetPresetIds()
    const b = JSON.stringify(presetTree('cpp:if', { elseifCount: 2 }))
    expect(a).toBe(b)
  })

  it('★ 多層 else-if 要一層包一層，不是攤平', () => {
    const t = presetTree('cpp:if', { elseifCount: 2 })
    const l1 = t.children.else_body[0]
    expect(l1.children.else_body?.length, '🔴 第二層攤平了 → 那不是 else-if 鏈').toBe(1)
    expect(l1.children.else_body[0].properties.isElseIf).toBe('true')
  })
})
