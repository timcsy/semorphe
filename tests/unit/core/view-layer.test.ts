/**
 * @vitest-environment happy-dom
 *
 * **視圖宣告自己在哪一層，宿主決定那一層長什麼樣。**
 *
 * ## 它從哪來（2026-08-26）
 *
 * 「哪個面板放哪裡」本來寫死在**兩個宿主各一份**
 * （`ui/layout/mobile-tab-bar.ts` 的四元素陣列、`ui/app-shell.ts` 的容器 id）
 * ——加第三個宿主就是第三份。
 *
 * 🔴 **而路線圖那一條寫的是「面板宣告【偏好】不宣告位置」，那句話不夠**：
 * 偏好會讓順序變成任意的，而那個順序是**語義**——`concepts/理解的層次.md`
 * 逐字記著使用者的話「代表理解的不同層次……**不是誰比較重要**」。
 *
 * > **一份「各自宣告偏好」的機制，會把一個有意義的排列變成一場協商。**
 *
 * → 宣告的是**層**（封閉的四個值），順序由 `LAYER_ORDER` 決定。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測畫面**——分頁列的圖示與字是宿主的呈現，由 `mobile-tab-bar.test.ts` 釘。
 * - **不檢測桌機那一側**——它今天還是用容器 id（那是這一項的下一條驗收）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { LAYER_ORDER, type UnderstandingLayer, type ViewHost } from '../../../src/core/view-host'
import { registerView, resetViews, viewsByLayer } from '../../../src/core/view-registry'

function fakeView(id: string, layer?: UnderstandingLayer): ViewHost {
  return {
    viewId: id,
    viewType: id,
    capabilities: { editable: false, needsLanguageProjection: false, consumedAnnotations: [], layer },
    initialize: async () => {},
  } as unknown as ViewHost
}

beforeEach(() => resetViews())

describe('視圖的層次', () => {
  it('★ 錨點：四層的順序就是理解的四個層次，而它是封閉的', () => {
    // ⚠️ 這一支釘的是**順序**。改動它要先改 `concepts/理解的層次.md`，
    //    因為那個順序是使用者說的語義，不是實作細節。
    expect(LAYER_ORDER).toEqual(['element', 'relation', 'space', 'state'])
  })

  it('🔴 依層取出來的視圖【照 LAYER_ORDER 排】，不照登記順序', () => {
    // 故意用相反的順序登記
    registerView(fakeView('c', 'state'))
    registerView(fakeView('b', 'space'))
    registerView(fakeView('a', 'element'))
    expect(viewsByLayer().map((g) => g.layer)).toEqual(['element', 'space', 'state'])
  })

  it('🔴 同一層可以有多個視圖——主控台與變數都是「狀態」', () => {
    registerView(fakeView('console', 'state'))
    registerView(fakeView('variables', 'state'))
    const state = viewsByLayer().find((g) => g.layer === 'state')
    expect(state?.views.map((v) => v.viewId)).toEqual(['console', 'variables'])
  })

  it('★ 沒宣告層的視圖不得被塞進任何一層', () => {
    // ⚠️ `layer` 是**選用**的：一個不屬於任何理解層次的視圖（將來的設定面板）
    //    不必假裝有——而那正是 `undefined` 該說的話。
    registerView(fakeView('settings'))
    expect(viewsByLayer()).toEqual([])
  })
})
