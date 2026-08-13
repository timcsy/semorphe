/**
 * 視圖登錄表。
 *
 * ⚠️ 這支測試存在的理由，是 `view-registry.ts` 取代掉的那兩條線
 * **一條都沒有測試**——`app.ts` 的硬編沒有，四個面板的 `connectBus` 也沒有。
 * 而那正是為什麼「`connectBus` 從來沒有人呼叫」可以活這麼久：
 *
 * > **一段沒有人呼叫的程式碼，與一段被呼叫而正確的程式碼，
 * > 在一套沒有測到它的測試裡看起來一樣。**
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registerView, registeredViews, viewsWith, viewsConsuming, connectViews, resetViews, isViewHost, registerViewsIn } from '../../../src/core/view-registry'
import { SemanticBus } from '../../../src/core/semantic-bus'
import type { ViewHost, ViewCapabilities } from '../../../src/core/view-host'

function fakeView(viewId: string, caps: Partial<ViewCapabilities> = {}): ViewHost & { received: string[] } {
  const received: string[] = []
  return {
    viewId,
    viewType: viewId,
    capabilities: { editable: false, needsLanguageProjection: false, consumedAnnotations: [], ...caps },
    received,
    initialize: async () => {},
    dispose: () => {},
    onSemanticUpdate: (e) => received.push(`semantic:${e.source}`),
    onExecutionState: () => received.push('execution'),
  }
}

describe('視圖登錄表', () => {
  beforeEach(() => resetViews())

  it('登錄之後查得到', () => {
    const a = fakeView('a')
    registerView(a)
    expect(registeredViews()).toEqual([a])
  })

  it('★ 同一個實例登錄兩次是冪等的（不是錯誤）', () => {
    const a = fakeView('a')
    registerView(a)
    registerView(a)
    expect(registeredViews()).toHaveLength(1)
  })

  it('★ id 撞名必須爆——靜默覆蓋的症狀是「某個面板不再更新」', () => {
    registerView(fakeView('a'))
    expect(() => registerView(fakeView('a'))).toThrow(/登錄兩次/)
  })

  it('capabilities 查得到——這是那份宣告的第一個讀取者', () => {
    registerView(fakeView('可編輯', { editable: true }))
    registerView(fakeView('唯讀'))
    registerView(fakeView('讀標註', { consumedAnnotations: ['control_flow'] }))

    expect(viewsWith('editable').map((v) => v.viewId)).toEqual(['可編輯'])
    expect(viewsWith('needsLanguageProjection')).toEqual([])
    expect(viewsConsuming('control_flow').map((v) => v.viewId)).toEqual(['讀標註'])
    expect(viewsConsuming('沒人讀的標註')).toEqual([])
  })

  it('★ connectViews：兩個契約事件都要派送到每一個視圖', () => {
    const a = fakeView('a')
    const b = fakeView('b')
    registerView(a)
    registerView(b)
    const bus = new SemanticBus()
    connectViews(bus)

    bus.emit('semantic:update', { source: 'blocks', code: 'int x;' })
    bus.emit('execution:state', { state: 'running' })

    expect(a.received).toEqual(['semantic:blocks', 'execution'])
    expect(b.received).toEqual(a.received)
  })

  it('★ 反向：沒登錄的視圖收不到——證明它派的是登錄表，不是「全部」', () => {
    const unregistered = fakeView('沒登錄')
    const bus = new SemanticBus()
    connectViews(bus)
    bus.emit('semantic:update', { source: 'blocks' })
    expect(unregistered.received).toEqual([])
  })

  it('★ 接線之後才登錄的視圖也收得到——派送讀的是當下的表', () => {
    const bus = new SemanticBus()
    connectViews(bus)
    const late = fakeView('遲到')
    registerView(late)
    bus.emit('semantic:update', { source: 'code' })
    expect(late.received).toEqual(['semantic:code'])
  })
})

/**
 * 自動收集——取代 `app.ts` 裡那份手寫的四元素陣列。
 *
 * ⚠️ 那個陣列上方的註解逐字寫著「加一個視圖 = registerView(它)，**這個檔不用動**」，
 * 而加第五個視圖一定要改它。**這一組測試釘的就是那句話現在為真。**
 */
describe('registerViewsIn：掃容器，不列名', () => {
  beforeEach(() => resetViews())

  it('★ 從容器裡把視圖挑出來——而非視圖的欄位原封不動', () => {
    const container = {
      blocklyPanel: fakeView('blocks'),
      monacoPanel: fakeView('code'),
      bottomPanel: { show: () => {}, hide: () => {} }, // 不是視圖
      mobileMenu: null,
      someNumber: 42,
    }
    const found = registerViewsIn(container)
    expect(found.map((v) => v.viewId).sort()).toEqual(['blocks', 'code'])
    expect(registeredViews()).toHaveLength(2)
  })

  it('★ 反向：不自稱是視圖的東西一律不報——證明它不是「什麼都收」', () => {
    // ⚠️ 沒有這一支的話，一個「把所有東西都當視圖」的實作也會通過上一支。
    for (const notAView of [null, undefined, 42, 'blocks', [], {}, { show: () => {} }, new Date(0)]) {
      expect(isViewHost(notAView), `${String(notAView)} 被誤判成視圖`).toBe(false)
    }
    expect(registerViewsIn({ a: 1, b: 'x', c: {} })).toEqual([])
  })

  it('🔴 有 viewId 卻契約不完整 → 爆，不是靜默排除', () => {
    // 這是這個 guard 存在的理由：部分實作的面板若被靜默略過，
    // 症狀是「那個面板不再更新」而完全沒有錯誤訊息。
    const partialView = {
      viewId: '板子',
      capabilities: { editable: false, needsLanguageProjection: false, consumedAnnotations: [] },
      onSemanticUpdate: () => {},
      // ⚠️ 少了 onExecutionState
    }
    expect(() => isViewHost(partialView)).toThrow(/板子/)
    expect(() => isViewHost(partialView)).toThrow(/onExecutionState/)
  })

  it('🔴 有 viewId 卻沒有 capabilities → 也要爆', () => {
    const noCapabilities = {
      viewId: '圖鑑',
      onSemanticUpdate: () => {},
      onExecutionState: () => {},
    }
    expect(() => isViewHost(noCapabilities)).toThrow(/capabilities/)
  })

  it('★ 入口條件：空容器回空陣列——而呼叫端據此判斷掃描壞了', () => {
    // `app.ts` 用 `length === 0` 當入口條件（build-guardrail 第 9 步）。
    // ⚠️ 錨在「有沒有」而不是「有幾個」——後者會在加第五個視圖那天變紅。
    expect(registerViewsIn({})).toEqual([])
  })
})
