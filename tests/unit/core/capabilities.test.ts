/**
 * 能力介面的登錄表（spec 179，重構階段 1）。
 *
 * 判準來自使用者 2026-10-31：降級路徑要「有系統、不混雜、方便深嵌入完成之後替換」。
 * ⟹ 核心只認能力；每項能力挑登錄表裡第一個宣告了它的提供者；沒有就回帶缺項的結果，不回 undefined。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerProvider, resetProvidersForTest, provide, SessionStop, openSession,
  type Provider,
} from '../../../src/core/capabilities'

const sessionOnly: Provider = {
  id: 'fake-session',
  declares: { session: { granularity: 'statement', setInput: true, setVariable: false, steps: false, stepping: false, interactiveInput: false, hardware: false } },
  createSession: () => ({}) as never,
}
const sessionAndSteps: Provider = {
  id: 'fake-full',
  declares: { session: { granularity: 'node', setInput: false, setVariable: true, steps: true, stepping: true, interactiveInput: true, hardware: false } },
  createSession: () => ({}) as never,
}

describe('能力登錄表', () => {
  beforeEach(() => resetProvidersForTest())

  it('★ 每項能力挑登錄表裡【第一個】宣告了它的提供者', () => {
    registerProvider(sessionOnly)
    registerProvider(sessionAndSteps)
    const s = provide('session')
    expect(s.provenance).toBe('fake-session')
    const steps = provide('steps')
    expect(steps.provenance, '第一個沒宣告步數 → 落到第二個').toBe('fake-full')
  })

  it('★ 結果說得出少了什麼——提供者給的執行沒有步數、不能改變數', () => {
    registerProvider(sessionOnly)
    expect(provide('session').missing).toEqual(['steps', 'setVariable', 'stepping', 'interactiveInput'])
  })

  it('🔴 沒有任何提供者：回帶缺項的結果，不是 undefined', () => {
    const v = provide('verdict')
    expect(v).toEqual({ provider: null, provenance: null, missing: ['verdict'] })
  })

  it('★ 型別查詢沒有提供者時也一樣說得出缺什麼', () => {
    registerProvider(sessionAndSteps)
    expect(provide('types')).toEqual({ provider: null, provenance: null, missing: ['types'] })
  })

  it('★ 同一個提供者登記兩次不會重複', () => {
    registerProvider(sessionOnly)
    registerProvider(sessionOnly)
    registerProvider(sessionAndSteps)
    expect(provide('steps').provenance).toBe('fake-full')
  })
})

describe('SessionStop——控制器只認這一種停止', () => {
  it('★ 帶種類與 i18n 鍵，nodeId 可以沒有', () => {
    const s = new SessionStop('runtime', 'RUNTIME_ERR_DIV_ZERO', { a: '1' }, 'n1')
    expect(s).toBeInstanceOf(Error)
    expect([s.kind, s.i18nKey, s.params, s.nodeId]).toEqual(['runtime', 'RUNTIME_ERR_DIV_ZERO', { a: '1' }, 'n1'])
    expect(new SessionStop('aborted', 'RUNTIME_ERR_ABORTED').nodeId).toBeNull()
  })
})

/**
 * spec 205 T003／T008：JS 直譯器拿掉之後，「還在準備」與「接不了」要分得開——前者呼叫端說「準備中」再試，後者照實說原因。
 */
describe('開一次執行：還在準備 vs 接不了', () => {
  beforeEach(() => resetProvidersForTest())
  const tree = { id: 'p', componentId: 'cpp:program', properties: {}, slots: {} } as never
  const opts = { maxSteps: 10 } as never
  const declines = (d: { declined: string; nodeId?: string; pending?: true }): Provider => ({
    id: 'cella', declares: { session: { granularity: 'node', setInput: true, setVariable: true, steps: true, stepping: true, interactiveInput: true, hardware: false } }, createSession: () => d,
  })

  it('★ 還在準備：pending 原樣帶出來（呼叫端靠它決定等不等）', () => {
    registerProvider(declines({ declined: '判斷功能還在載入', pending: true }))
    const o = openSession(opts, tree)
    expect(o.session).toBeNull()
    expect(o.declined).toEqual([{ provider: 'cella', reason: '判斷功能還在載入', pending: true }])
  })
  it('🔴 接不了：沒有 pending，nodeId 照帶（畫面要指得到那一行）', () => {
    registerProvider(declines({ declined: 'Cella 還不支援：VLA', nodeId: 'n7' }))
    const o = openSession(opts, tree)
    expect(o.declined).toEqual([{ provider: 'cella', reason: 'Cella 還不支援：VLA', nodeId: 'n7' }])
    expect(o.declined[0].pending).toBeUndefined()
  })
})
