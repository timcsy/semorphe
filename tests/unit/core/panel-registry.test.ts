/**
 * 🔴 面板登錄表的四條「要出聲」（spec 170 · T005）。
 *
 * 而第四條是**入口條件**：一份宣告都沒有時要喊。沒有它的話，`glob` 壞掉時
 * 整個應用會安靜地變成空白。
 *
 * > **一個沒有人宣告的登記處【就是殼】，而它綠得跟真的一樣。**
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerPanel, resetPanelsForTest, allPanels, panelsOfLayer, panelsFor,
  layersOf, assertPanelsSane,
} from '../../../src/core/host/panel-registry'
import type { PanelSpec } from '../../../src/core/host/panel-spec'
import type { HostProfile } from '../../../src/core/host/host-profile'
import type { UnderstandingLayer } from '../../../src/core/view-host'

const spec = (id: string, layer: UnderstandingLayer, extra: Partial<PanelSpec> = {}): PanelSpec => ({
  id, layer, nameKey: `LAYER_${layer.toUpperCase()}`,
  mount: () => ({}),
  ...extra,
})

beforeEach(() => resetPanelsForTest())

describe('🔴 四條「要出聲」', () => {
  it('🔴 一份宣告都沒有——入口條件，不喊的話畫面會安靜地空白', () => {
    const problems = assertPanelsSane()
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('一個面板都沒有登記')
  })

  it('🔴 兩份宣告用同一個 id', () => {
    registerPanel(spec('blocks', 'space'))
    registerPanel(spec('blocks', 'relation'))
    expect(assertPanelsSane().join()).toContain('撞名')
  })

  it('🔴 層認不得', () => {
    registerPanel(spec('weird', 'nowhere' as UnderstandingLayer))
    expect(assertPanelsSane().join()).toContain('層認不得')
  })

  it('🔴 名字沒有翻譯——不得印出鍵名', () => {
    registerPanel(spec('blocks', 'space', { nameKey: 'NO_SUCH_KEY' }))
    expect(assertPanelsSane((k) => k !== 'NO_SUCH_KEY').join()).toContain('沒有翻譯')
  })

  it('健康的時候一句話都不說', () => {
    registerPanel(spec('blocks', 'space'))
    registerPanel(spec('flow', 'relation'))
    expect(assertPanelsSane()).toEqual([])
  })
})

describe('順序：照 LAYER_ORDER，層內照 order', () => {
  it('🔴 不靠登記的順序——那是 glob 的鍵順序，而它不保證', () => {
    registerPanel(spec('blocks', 'space'))
    registerPanel(spec('code', 'element'))
    registerPanel(spec('console', 'state'))
    registerPanel(spec('flow', 'relation'))
    expect(allPanels().map((p) => p.id)).toEqual(['code', 'flow', 'blocks', 'console'])
  })

  it('層內照 order（小的在前）', () => {
    registerPanel(spec('variables', 'state', { order: 2 }))
    registerPanel(spec('console', 'state', { order: 1 }))
    expect(panelsOfLayer('state').map((p) => p.id)).toEqual(['console', 'variables'])
  })
})

describe('🔴 一層可以有多份宣告——那是分頁，不是兩格', () => {
  it('state 有兩份', () => {
    registerPanel(spec('console', 'state'))
    registerPanel(spec('variables', 'state'))
    expect(panelsOfLayer('state')).toHaveLength(2)
    // ⚠️ 而「有幾層」仍然是 1——版面的格子是層，不是宣告
    expect(layersOf({} as HostProfile)).toEqual(['state'])
  })
})

describe('這個宿主上有哪些——問能力，不問宿主的名字', () => {
  const webish = { features: { codeEditorPane: true } } as HostProfile
  const idish = { features: { codeEditorPane: false } } as HostProfile

  beforeEach(() => {
    registerPanel(spec('code', 'element', {
      availableIn: (p) => p.features.codeEditorPane,
    }))
    registerPanel(spec('blocks', 'space'))
  })

  it('程式碼那一格在網頁版在', () => {
    expect(panelsFor(webish).map((p) => p.id)).toEqual(['code', 'blocks'])
    expect(layersOf(webish)).toEqual(['element', 'space'])
  })

  it('🔴 在 IDE 裡它不在——而那不是「藏起來」，是不在那裡', () => {
    expect(panelsFor(idish).map((p) => p.id)).toEqual(['blocks'])
    expect(layersOf(idish)).toEqual(['space'])
  })

  it('⚠️ 一層都不剩時是空陣列，不是拋錯', () => {
    resetPanelsForTest()
    registerPanel(spec('code', 'element', { availableIn: () => false }))
    expect(layersOf(idish)).toEqual([])
  })
})
