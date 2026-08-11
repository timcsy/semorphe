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
import { registerView, registeredViews, viewsWith, viewsConsuming, connectViews, resetViews } from '../../../src/core/view-registry'
import { SemanticBus } from '../../../src/core/semantic-bus'
import type { ViewHost, ViewCapabilities } from '../../../src/core/view-host'

function 假視圖(viewId: string, caps: Partial<ViewCapabilities> = {}): ViewHost & { 收到: string[] } {
  const 收到: string[] = []
  return {
    viewId,
    viewType: viewId,
    capabilities: { editable: false, needsLanguageProjection: false, consumedAnnotations: [], ...caps },
    收到,
    initialize: async () => {},
    dispose: () => {},
    onSemanticUpdate: (e) => 收到.push(`semantic:${e.source}`),
    onExecutionState: () => 收到.push('execution'),
  }
}

describe('視圖登錄表', () => {
  beforeEach(() => resetViews())

  it('登錄之後查得到', () => {
    const a = 假視圖('a')
    registerView(a)
    expect(registeredViews()).toEqual([a])
  })

  it('★ 同一個實例登錄兩次是冪等的（不是錯誤）', () => {
    const a = 假視圖('a')
    registerView(a)
    registerView(a)
    expect(registeredViews()).toHaveLength(1)
  })

  it('★ id 撞名必須爆——靜默覆蓋的症狀是「某個面板不再更新」', () => {
    registerView(假視圖('a'))
    expect(() => registerView(假視圖('a'))).toThrow(/登錄兩次/)
  })

  it('capabilities 查得到——這是那份宣告的第一個讀取者', () => {
    registerView(假視圖('可編輯', { editable: true }))
    registerView(假視圖('唯讀'))
    registerView(假視圖('讀標註', { consumedAnnotations: ['control_flow'] }))

    expect(viewsWith('editable').map((v) => v.viewId)).toEqual(['可編輯'])
    expect(viewsWith('needsLanguageProjection')).toEqual([])
    expect(viewsConsuming('control_flow').map((v) => v.viewId)).toEqual(['讀標註'])
    expect(viewsConsuming('沒人讀的標註')).toEqual([])
  })

  it('★ connectViews：兩個契約事件都要派送到每一個視圖', () => {
    const a = 假視圖('a')
    const b = 假視圖('b')
    registerView(a)
    registerView(b)
    const bus = new SemanticBus()
    connectViews(bus)

    bus.emit('semantic:update', { source: 'blocks', code: 'int x;' })
    bus.emit('execution:state', { state: 'running' })

    expect(a.收到).toEqual(['semantic:blocks', 'execution'])
    expect(b.收到).toEqual(a.收到)
  })

  it('★ 反向：沒登錄的視圖收不到——證明它派的是登錄表，不是「全部」', () => {
    const 沒登錄 = 假視圖('沒登錄')
    const bus = new SemanticBus()
    connectViews(bus)
    bus.emit('semantic:update', { source: 'blocks' })
    expect(沒登錄.收到).toEqual([])
  })

  it('★ 接線之後才登錄的視圖也收得到——派送讀的是當下的表', () => {
    const bus = new SemanticBus()
    connectViews(bus)
    const 遲到 = 假視圖('遲到')
    registerView(遲到)
    bus.emit('semantic:update', { source: 'code' })
    expect(遲到.收到).toEqual(['semantic:code'])
  })
})
